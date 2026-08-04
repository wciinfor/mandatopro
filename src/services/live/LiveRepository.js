import { createServerClient } from '@/lib/supabase-server';

/**
 * LiveRepository
 * Conectado exatamente com a mesma estratégia de consulta leve que já alimenta o /api/dashboard/stats.js do sistema.
 */
export const LiveRepository = {
  async fetchLiveRawData(req) {
    const supabase = createServerClient();
    
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString();
    const inicioSemana = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 7).toISOString();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();

    const [
      totalEleitoresRes,
      cadastrosHojeRes,
      cadastrosSemanaRes,
      cadastrosMesRes,
      ultimosEleitoresRes,
      liderancasRes,
      atendimentosRes,
      solicitacoesRes,
      campanhasRes
    ] = await Promise.all([
      supabase.from('eleitores').select('id', { count: 'exact', head: true }),
      supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', inicioHoje),
      supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', inicioSemana),
      supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', inicioMes),
      supabase.from('eleitores').select('id, nome, cidade, municipio, bairro, lideranca, created_at').order('created_at', { ascending: false }).limit(10),
      supabase.from('liderancas').select('id, nome, cidade, municipio, bairro').limit(50),
      supabase.from('atendimentos').select('id, assunto, status, data_atendimento, created_at').order('created_at', { ascending: false }).limit(10),
      supabase.from('solicitacoes').select('id, titulo, status, created_at, municipio').order('created_at', { ascending: false }).limit(10),
      supabase.from('campanhas').select('id, nome, status, local, created_at').limit(5)
    ]);

    return {
      eleitores: {
        total: totalEleitoresRes?.count || 0,
        hoje: cadastrosHojeRes?.count || 0,
        semana: cadastrosSemanaRes?.count || 0,
        mes: cadastrosMesRes?.count || 0,
        mesAnterior: 0,
        listaRecente: ultimosEleitoresRes?.data || []
      },
      liderancas: liderancasRes?.data || [],
      atendimentos: atendimentosRes?.data || [],
      solicitacoes: solicitacoesRes?.data || [],
      campanhas: campanhasRes?.data || []
    };
  }
};
