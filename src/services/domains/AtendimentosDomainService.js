import { createServerClient } from '@/lib/supabase-server';

/**
 * Domain Service: AtendimentosDomainService
 * Responsável exclusivamente pelo acesso a dados do domínio de Atendimentos.
 */
export async function getAtendimentosMetrics(supabaseClient) {
  const supabase = supabaseClient || createServerClient();

  const [
    { count: total },
    { data: lista }
  ] = await Promise.all([
    supabase.from('atendimentos').select('id', { count: 'exact', head: true }),
    supabase.from('atendimentos').select('id, assunto, status, data_atendimento, created_at').order('created_at', { ascending: false }).limit(10)
  ]);

  return {
    total: total || 0,
    lista: lista || []
  };
}
