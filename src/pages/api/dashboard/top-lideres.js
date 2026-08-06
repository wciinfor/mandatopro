import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

/**
 * Busca top 10 líderes usando exclusivamente os nomes reais das colunas no banco (snake_case).
 */
async function fetchTopLideres(supabase) {
  const { data, error } = await supabase
    .from('liderancas')
    .select('id, nome, projecao_votos, area_atuacao')
    .order('projecao_votos', { ascending: false })
    .limit(10);

  if (!error) {
    return data || [];
  }

  // Fallback: se projecao_votos falhar, tenta sem ordenação
  const fallback = await supabase
    .from('liderancas')
    .select('id, nome, projecao_votos, area_atuacao')
    .limit(10);

  if (!fallback.error) {
    return fallback.data || [];
  }

  const basic = await supabase
    .from('liderancas')
    .select('id, nome')
    .limit(10);

  if (basic.error) throw basic.error;
  return basic.data || [];
}

/**
 * Carrega a contagem de eleitores de TODOS os 10 líderes em UMA ÚNICA CONSULTA.
 */
async function fetchContagemEleitoresPorLideres(supabase, lideresIds) {
  if (!lideresIds || lideresIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('eleitores')
    .select('lideranca_id')
    .in('lideranca_id', lideresIds);

  if (!error && Array.isArray(data)) {
    const mapa = new Map();
    data.forEach((row) => {
      if (row.lideranca_id) {
        const key = String(row.lideranca_id);
        mapa.set(key, (mapa.get(key) || 0) + 1);
      }
    });
    return mapa;
  }

  return new Map();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    // 1. Busca top 10 lideranças (1 consulta SQL com colunas reais do banco)
    const lideres = await fetchTopLideres(supabase);

    const lideresIds = lideres.map((l) => l.id).filter(Boolean);

    // 2. Busca contagem para todos os 10 líderes em UMA ÚNICA CONSULTA SQL
    const contagemMapa = await fetchContagemEleitoresPorLideres(supabase, lideresIds);

    // 3. Mapeia para o formato esperado pelo frontend (camelCase no JSON, nunca no SQL)
    const lideresComCadastros = lideres.map((lider) => {
      const cadastros = contagemMapa.get(String(lider.id)) || 0;
      const projecaoVotos = Number(lider?.projecao_votos || 0);
      const percentual = projecaoVotos > 0 ? ((cadastros / projecaoVotos) * 100).toFixed(1) : 0;

      return {
        id: lider.id,
        nome: lider.nome,
        projecaoVotos,
        areaAtividade: lider?.area_atuacao || '',
        cadastros,
        percentual: parseFloat(percentual)
      };
    });

    const top = lideresComCadastros.sort((a, b) => {
      if (b.projecaoVotos !== a.projecaoVotos) return b.projecaoVotos - a.projecaoVotos;
      return b.cadastros - a.cadastros;
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

    return res.status(200).json({
      data: top,
      total: top.length
    });
  } catch (error) {
    console.error('Erro ao carregar top líderes:', error);
    return res.status(500).json({
      error: 'Erro ao carregar top líderes',
      message: error.message
    });
  }
}
