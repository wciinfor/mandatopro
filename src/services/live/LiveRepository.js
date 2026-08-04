import { createServerClient } from '@/lib/supabase-server';

/**
 * LiveRepository
 * Camada única centralizada responsável por consultar o banco de dados Supabase para o MandatoPRO Live.
 * Evita queries duplicadas e otimiza a performance com buscas em paralelo.
 */
export const LiveRepository = {
  async fetchLiveRawData(req) {
    const supabase = createServerClient();
    
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString();
    const inicioSemana = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 7).toISOString();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
    const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).toISOString();
    const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999).toISOString();

    const [
      { count: totalEleitores },
      { count: cadastrosHoje },
      { count: cadastrosSemana },
      { count: cadastrosMes },
      { count: cadastrosMesAnterior },
      { data: ultimosEleitores },
      { data: liderancas },
      { data: atendimentos },
      { data: solicitacoes },
      { data: campanhas }
    ] = await Promise.all([
      supabase.from('eleitores').select('id', { count: 'exact', head: true }),
      supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', inicioHoje),
      supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', inicioSemana),
      supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', inicioMes),
      supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', inicioMesAnterior).lte('created_at', fimMesAnterior),
      supabase.from('eleitores').select('id, nome, cidade, municipio, bairro, lideranca, created_at').order('created_at', { ascending: false }).limit(10),
      supabase.from('liderancas').select('id, nome, cidade, municipio, bairro').limit(50),
      supabase.from('atendimentos').select('id, assunto, status, data_atendimento, created_at').order('created_at', { ascending: false }).limit(10),
      supabase.from('solicitacoes').select('id, titulo, status, created_at, municipio').order('created_at', { ascending: false }).limit(10),
      supabase.from('campanhas').select('id, nome, status, local, created_at').limit(5)
    ]);

    return {
      eleitores: {
        total: totalEleitores || 0,
        hoje: cadastrosHoje || 0,
        semana: cadastrosSemana || 0,
        mes: cadastrosMes || 0,
        mesAnterior: cadastrosMesAnterior || 0,
        listaRecente: ultimosEleitores || []
      },
      liderancas: liderancas || [],
      atendimentos: atendimentos || [],
      solicitacoes: solicitacoes || [],
      campanhas: campanhas || []
    };
  }
};
