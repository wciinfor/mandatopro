import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterContextoMandato } from '@/lib/mandato-auth';

export const runtime = 'nodejs';

/**
 * Busca top 10 líderes vinculados ao mandato ativo usando liderancas_mandatos.
 * Contagem de eleitores via eleitores_liderancas_mandatos (sem usar eleitores.lideranca_id).
 */
async function fetchTopLideresPorMandato(supabase, mandatoId) {
  // 1. Obter IDs de lideranças do mandato ativo
  const { data: lmData, error: lmErr } = await supabase
    .from('liderancas_mandatos')
    .select('lideranca_id')
    .eq('mandato_id', mandatoId);

  if (lmErr || !lmData?.length) return [];

  const lideresIds = lmData.map(r => r.lideranca_id);

  // 2. Buscar dados das lideranças
  const { data: liderancas, error: lidErr } = await supabase
    .from('liderancas')
    .select('id, nome, projecao_votos, area_atuacao')
    .in('id', lideresIds)
    .order('projecao_votos', { ascending: false })
    .limit(10);

  if (lidErr) throw lidErr;
  return liderancas || [];
}

/**
 * Contagem de eleitores por liderança usando eleitores_liderancas_mandatos
 * (indexado por mandato_id + lideranca_id — sem usar eleitores.lideranca_id).
 */
async function fetchContagemPorElmMandato(supabase, lideresIds, mandatoId) {
  if (!lideresIds?.length) return new Map();

  const { data, error } = await supabase
    .from('eleitores_liderancas_mandatos')
    .select('lideranca_id')
    .in('lideranca_id', lideresIds)
    .eq('mandato_id', mandatoId);

  if (error || !Array.isArray(data)) return new Map();

  const mapa = new Map();
  data.forEach((row) => {
    if (row.lideranca_id) {
      const key = String(row.lideranca_id);
      mapa.set(key, (mapa.get(key) || 0) + 1);
    }
  });
  return mapa;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const contextoMandato = await obterContextoMandato(req, usuario, supabase);

    // 1. Top 10 lideranças do mandato ativo (2 consultas indexadas controladas)
    const lideres = await fetchTopLideresPorMandato(supabase, contextoMandato.mandatoId);
    const lideresIds = lideres.map((l) => l.id).filter(Boolean);

    // 2. Contagem via eleitores_liderancas_mandatos (sem eleitores.lideranca_id)
    const contagemMapa = await fetchContagemPorElmMandato(supabase, lideresIds, contextoMandato.mandatoId);

    // 3. Monta resultado final
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

