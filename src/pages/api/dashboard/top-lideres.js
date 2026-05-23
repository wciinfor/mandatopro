import { createServerClient } from '@/lib/supabase-server';

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
 * Carrega contagem de eleitores para cada líder em paralelo (apenas 10 queries).
 * Resolve N+1 original de até 200 queries individuais.
 */
async function countCadastrosPorLider(supabase, liderId) {
  const tentativas = ['lideranca_id', 'liderancaId'];

  for (const coluna of tentativas) {
    const { count, error } = await supabase
      .from('eleitores')
      .select('id', { count: 'exact', head: true })
      .eq(coluna, liderId);

    if (!error) {
      return count || 0;
    }

    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  return 0;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();

    // Busca top 10 no banco já ordenado — evita buscar 200 e fazer N+1 queries
    const lideres = await fetchTopLideres(supabase);

    // Conta eleitores em paralelo para apenas os 10 líderes retornados
    const lideresComCadastros = await Promise.all(
      lideres.map(async (lider) => {
        const cadastros = await countCadastrosPorLider(supabase, lider.id);
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
      })
    );

    const top = lideresComCadastros
      .sort((a, b) => {
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
