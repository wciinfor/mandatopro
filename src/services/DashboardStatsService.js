import { createServerClient } from '@/lib/supabase-server';

/**
 * DashboardStatsService (Single Source of Truth)
 * Centraliza as regras de estatística do Dashboard e do Live.
 */
export async function getDashboardStatsCore(supabaseAdmin) {
  const supabase = supabaseAdmin || createServerClient();

  const [
    { count: totalEleitores },
    { count: totalLiderancas },
    { count: totalAtendimentos },
    { count: eleitoresHoje },
    { count: eleitoresSemana },
    { count: eleitoresMes },
    { count: campanhasAtivas },
    { count: solicitacoesPendentes },
    { data: ultimosEleitores },
    { data: liderancasLista },
    { data: atendimentosLista },
    { data: solicitacoesLista }
  ] = await Promise.all([
    supabase.from('eleitores').select('id', { count: 'exact', head: true }),
    supabase.from('liderancas').select('id', { count: 'exact', head: true }),
    supabase.from('atendimentos').select('id', { count: 'exact', head: true }),
    supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).toISOString()),
    supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from('campanhas').select('id', { count: 'exact', head: true }).in('status', ['PLANEJAMENTO', 'EXECUCAO']),
    supabase.from('solicitacoes').select('id', { count: 'exact', head: true }).neq('status', 'ATENDIDO'),
    supabase.from('eleitores').select('id, nome, cidade, municipio, bairro, lideranca, created_at').order('created_at', { ascending: false }).limit(10),
    supabase.from('liderancas').select('id, nome, cidade, municipio, bairro').limit(50),
    supabase.from('atendimentos').select('id, assunto, status, data_atendimento, created_at').order('created_at', { ascending: false }).limit(10),
    supabase.from('solicitacoes').select('id, titulo, status, created_at, municipio').order('created_at', { ascending: false }).limit(10)
  ]);

  return {
    totalEleitores: totalEleitores || 0,
    eleitoresAtivos: totalEleitores || 0,
    eleitoresInativos: 0,
    totalLiderancas: totalLiderancas || 0,
    totalAtendimentos: totalAtendimentos || 0,
    campanhasAtivas: campanhasAtivas || 0,
    cadastrosHoje: eleitoresHoje || 0,
    cadastrosSemana: eleitoresSemana || 0,
    cadastrosMes: eleitoresMes || 0,
    solicitacoesPendentes: solicitacoesPendentes || 0,
    ultimosEleitores: ultimosEleitores || [],
    liderancasLista: liderancasLista || [],
    atendimentosLista: atendimentosLista || [],
    solicitacoesLista: solicitacoesLista || []
  };
}
