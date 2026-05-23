import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return code === '42703' || code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
}

async function countRowsSafe(supabase, table) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.error(`Erro ao contar ${table}:`, error);
    return 0;
  }

  return count || 0;
}

async function fetchEleitoresStatusCounts(supabase) {
  // Tenta contar por statusCadastro primeiro, depois fallback para status
  const colunas = ['statusCadastro', 'status'];

  for (const col of colunas) {
    const [ativos, inativos] = await Promise.all([
      supabase
        .from('eleitores')
        .select('id', { count: 'exact', head: true })
        .eq(col, 'ATIVO'),
      supabase
        .from('eleitores')
        .select('id', { count: 'exact', head: true })
        .eq(col, 'INATIVO'),
    ]);

    if (!ativos.error && !inativos.error) {
      return { eleitoresAtivos: ativos.count || 0, eleitoresInativos: inativos.count || 0 };
    }

    // Se o erro não for de coluna inexistente, lança
    if (ativos.error && !isMissingColumnError(ativos.error)) throw ativos.error;
    if (inativos.error && !isMissingColumnError(inativos.error)) throw inativos.error;
  }

  return { eleitoresAtivos: 0, eleitoresInativos: 0 };
}

async function countCampanhasAtivasSafe(supabase) {
  const { count, error } = await supabase
    .from('campanhas')
    .select('id', { count: 'exact', head: true })
    .in('status', ['PLANEJAMENTO', 'EXECUCAO']);

  if (!error) {
    return count || 0;
  }

  if (!isMissingColumnError(error)) {
    throw error;
  }

  const tentativas = ['id, status', '*'];

  for (const selectClause of tentativas) {
    const fallback = await supabase
      .from('campanhas')
      .select(selectClause);

    if (fallback.error) {
      if (!isMissingColumnError(fallback.error)) {
        throw fallback.error;
      }
      continue;
    }

    return (fallback.data || []).filter((item) => {
      const status = String(item?.status || '').toUpperCase();
      return status === 'PLANEJAMENTO' || status === 'EXECUCAO';
    }).length;
  }

  return 0;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();

    // Apenas contagens simples — aniversariantes são carregados separadamente no frontend
    const [
      totalEleitores,
      totalLiderancas,
      totalAtendimentos,
      statusCounts,
      campanhasAtivas
    ] = await Promise.all([
      countRowsSafe(supabase, 'eleitores'),
      countRowsSafe(supabase, 'liderancas'),
      countRowsSafe(supabase, 'atendimentos'),
      fetchEleitoresStatusCounts(supabase),
      countCampanhasAtivasSafe(supabase),
    ]);

    const { eleitoresAtivos, eleitoresInativos } = statusCounts;

    // Cache de 2 minutos no edge da Vercel
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

    return res.status(200).json({
      totalEleitores,
      eleitoresAtivos,
      eleitoresInativos,
      totalLiderancas,
      campanhasAtivas,
      totalAtendimentos,
    });
  } catch (error) {
    console.error('Erro ao buscar estatisticas do dashboard:', error);
    return res.status(500).json({ error: 'Erro ao buscar estatisticas do dashboard' });
  }
}
