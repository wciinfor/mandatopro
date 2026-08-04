import { createServerClient } from '@/lib/supabase-server';

/**
 * Domain Service: CampanhasDomainService
 * Responsável exclusivamente pelo acesso a dados do domínio de Campanhas.
 */
export async function getCampanhasMetrics(supabaseClient) {
  const supabase = supabaseClient || createServerClient();

  const [
    { count: ativasCount },
    { data: lista }
  ] = await Promise.all([
    supabase.from('campanhas').select('id', { count: 'exact', head: true }).in('status', ['PLANEJAMENTO', 'EXECUCAO']),
    supabase.from('campanhas').select('id, nome, status, local, created_at').limit(10)
  ]);

  return {
    ativasCount: ativasCount || 0,
    lista: lista || []
  };
}
