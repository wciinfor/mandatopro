import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario, exigirAcessoModulo } from '@/lib/api-auth';
import { MODULES } from '@/utils/permissions';
import { obterContextoMandato } from '@/lib/mandato-auth';

export const runtime = 'nodejs';

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return code === '42703' || code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
}

/** Contagem de eleitores do mandato ativo via pertencimento */
async function countEleitoresMandato(supabase, pertencimentosPermitidos) {
  const { count, error } = await supabase
    .from('eleitores')
    .select('id', { count: 'exact', head: true })
    .in('pertencimento', pertencimentosPermitidos);
  if (error) { console.error('Erro ao contar eleitores por mandato:', error); return 0; }
  return count || 0;
}

/** Contagem de lideranças do mandato ativo via liderancas_mandatos */
async function countLiderancasMandato(supabase, mandatoId) {
  const { count, error } = await supabase
    .from('liderancas_mandatos')
    .select('lideranca_id', { count: 'exact', head: true })
    .eq('mandato_id', mandatoId);
  if (error) { console.error('Erro ao contar lideranças por mandato:', error); return 0; }
  return count || 0;
}

/** Contagem de atendimentos do mandato ativo: mandato_id = X OR NULL (legados Estadual) */
async function countAtendimentosMandato(supabase, mandatoId) {
  let query = supabase
    .from('atendimentos')
    .select('id', { count: 'exact', head: true });
  if (mandatoId === 1) {
    query = query.or(`mandato_id.eq.${mandatoId},mandato_id.is.null`);
  } else {
    query = query.eq('mandato_id', mandatoId);
  }
  const { count, error } = await query;
  if (error) { console.error('Erro ao contar atendimentos por mandato:', error); return 0; }
  return count || 0;
}

async function fetchEleitoresStatusCounts(supabase, pertencimentosPermitidos = ['ESTADUAL', 'AMBOS']) {
  // Tenta contar por statusCadastro primeiro, depois fallback para status
  const colunas = ['statusCadastro', 'status'];

  for (const col of colunas) {
    const [ativos, inativos] = await Promise.all([
      supabase
        .from('eleitores')
        .select('id', { count: 'exact', head: true })
        .in('pertencimento', pertencimentosPermitidos)
        .eq(col, 'ATIVO'),
      supabase
        .from('eleitores')
        .select('id', { count: 'exact', head: true })
        .in('pertencimento', pertencimentosPermitidos)
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

async function countCampanhasAtivasSafe(supabase, mandatoId) {
  // 1. Obter IDs de campanhas do mandato ativo
  const { data: cmData } = await supabase
    .from('campanhas_mandatos')
    .select('campanha_id')
    .eq('mandato_id', mandatoId);
  const campIds = (cmData || []).map(c => c.campanha_id);
  if (!campIds.length) return 0;

  // 2. Contar ativas dentro dessas campanhas
  const { count, error } = await supabase
    .from('campanhas')
    .select('id', { count: 'exact', head: true })
    .in('id', campIds)
    .in('status', ['PLANEJAMENTO', 'EXECUCAO']);

  if (!error) return count || 0;
  if (!isMissingColumnError(error)) throw error;
  return 0;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);
    exigirAcessoModulo(usuario, MODULES.DASHBOARD);
    const contextoMandato = await obterContextoMandato(req, usuario, supabase);

    // Apenas contagens por mandato ativo
    const [
      totalEleitores,
      totalLiderancas,
      totalAtendimentos,
      statusCounts,
      campanhasAtivas
    ] = await Promise.all([
      countEleitoresMandato(supabase, contextoMandato.pertencimentosPermitidos),
      countLiderancasMandato(supabase, contextoMandato.mandatoId),
      countAtendimentosMandato(supabase, contextoMandato.mandatoId),
      fetchEleitoresStatusCounts(supabase, contextoMandato.pertencimentosPermitidos),
      countCampanhasAtivasSafe(supabase, contextoMandato.mandatoId),
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
