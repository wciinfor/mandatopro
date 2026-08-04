import { createServerClient } from '@/lib/supabase-server';

/**
 * Domain Service: SolicitacoesDomainService
 * Responsável exclusivamente pelo acesso a dados do domínio de Solicitações.
 */
export async function getSolicitacoesMetrics(supabaseClient) {
  const supabase = supabaseClient || createServerClient();

  const [
    { count: pendentesCount },
    { data: lista }
  ] = await Promise.all([
    supabase.from('solicitacoes').select('id', { count: 'exact', head: true }).neq('status', 'ATENDIDO'),
    supabase.from('solicitacoes').select('id, titulo, status, created_at, municipio').order('created_at', { ascending: false }).limit(10)
  ]);

  return {
    pendentesCount: pendentesCount || 0,
    lista: lista || []
  };
}
