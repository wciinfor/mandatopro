import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return code === '42703' || code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
}

function getProjecaoVotos(lider) {
  const raw = lider?.projecao_votos ?? lider?.projecaoVotos ?? 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Busca top líderes já ordenados pelo banco, limitando a 10.
 * Tenta colunas de ordem possíveis. Retorna array ou lança erro.
 */
async function fetchTopLideres(supabase) {
  const tentativasOrdem = ['projecao_votos', 'projecaoVotos'];

  for (const colOrdem of tentativasOrdem) {
    const { data, error } = await supabase
      .from('liderancas')
      .select('id, nome, projecao_votos, projecaoVotos, area_atuacao, areaAtuacao')
      .order(colOrdem, { ascending: false })
      .limit(10);

    if (!error) {
      return data || [];
    }

    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  // Fallback: sem ordenação, apenas limit 10
  const { data, error } = await supabase
    .from('liderancas')
    .select('id, nome, projecao_votos, projecaoVotos, area_atuacao, areaAtuacao')
    .limit(10);

  if (error) throw error;
  return data || [];
}

/**
 * Carrega a contagem de eleitores de TODOS os 10 líderes em UMA ÚNICA CONSULTA.
 * Elimina o N+1 de 10 queries em paralelo.
 */
async function fetchContagemEleitoresPorLideres(supabase, lideresIds) {
  if (!lideresIds || lideresIds.length === 0) {
    return new Map();
  }

  const colunas = ['lideranca_id', 'liderancaId'];

  for (const col of colunas) {
    const { data, error } = await supabase
      .from('eleitores')
      .select(col)
      .in(col, lideresIds);

    if (!error && Array.isArray(data)) {
      const mapa = new Map();
      data.forEach((row) => {
        const id = row[col];
        if (id) {
          const key = String(id);
          mapa.set(key, (mapa.get(key) || 0) + 1);
        }
      });
      return mapa;
    }

    if (error && !isMissingColumnError(error)) {
      throw error;
    }
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

    // 1. Busca top 10 lideranças (1 consulta SQL)
    const lideres = await fetchTopLideres(supabase);

    const lideresIds = lideres.map((l) => l.id).filter(Boolean);

    // 2. Busca contagem para todos os 10 líderes em UMA ÚNICA CONSULTA SQL
    const contagemMapa = await fetchContagemEleitoresPorLideres(supabase, lideresIds);

    // 3. Monta o resultado final em memória (0 queries adicionais)
    const lideresComCadastros = lideres.map((lider) => {
      const cadastros = contagemMapa.get(String(lider.id)) || 0;
      const projecaoVotos = getProjecaoVotos(lider);
      const percentual = projecaoVotos > 0 ? ((cadastros / projecaoVotos) * 100).toFixed(1) : 0;

      return {
        id: lider.id,
        nome: lider.nome,
        projecaoVotos,
        areaAtividade: lider.area_atuacao || lider.areaAtuacao || '',
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
