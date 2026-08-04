import { createServerClient } from '@/lib/supabase-server';

/**
 * Domain Service: EleitoresDomainService
 * Responsável exclusivamente pelo acesso a dados e métricas do domínio de Eleitores.
 */
export async function getEleitoresMetrics(supabaseClient) {
  const supabase = supabaseClient || createServerClient();
  const agora = new Date();
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString();
  const inicioSemana = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();

  const [
    { count: total },
    { count: hoje },
    { count: semana },
    { count: mes },
    { data: listaRecente }
  ] = await Promise.all([
    supabase.from('eleitores').select('id', { count: 'exact', head: true }),
    supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', inicioHoje),
    supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', inicioSemana),
    supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', inicioMes),
    supabase.from('eleitores').select('id, nome, cidade, municipio, bairro, lideranca, created_at').order('created_at', { ascending: false }).limit(10)
  ]);

  return {
    total: total || 0,
    hoje: hoje || 0,
    semana: semana || 0,
    mes: mes || 0,
    listaRecente: listaRecente || []
  };
}
