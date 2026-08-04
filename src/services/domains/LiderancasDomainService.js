import { createServerClient } from '@/lib/supabase-server';

/**
 * Domain Service: LiderancasDomainService
 * Responsável exclusivamente pelo acesso a dados do domínio de Lideranças.
 */
export async function getLiderancasMetrics(supabaseClient) {
  const supabase = supabaseClient || createServerClient();

  const [
    { count: total },
    { data: lista }
  ] = await Promise.all([
    supabase.from('liderancas').select('id', { count: 'exact', head: true }),
    supabase.from('liderancas').select('id, nome, cidade, municipio, bairro').limit(50)
  ]);

  return {
    total: total || 0,
    lista: lista || []
  };
}
