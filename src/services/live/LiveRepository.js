import { getDashboardStatsCore } from '../DashboardStatsService';

/**
 * LiveRepository (Sprint A0 — Single Source of Truth)
 * Delegado integralmente para o DashboardStatsService compartilhado.
 * Elimina qualquer duplicação de SQL ou consultas paralelas no MandatoPRO Live.
 */
export const LiveRepository = {
  async fetchLiveRawData(req, supabaseClient) {
    const statsCore = await getDashboardStatsCore(supabaseClient);

    return {
      eleitores: {
        total: statsCore.totalEleitores,
        hoje: statsCore.cadastrosHoje,
        semana: statsCore.cadastrosSemana,
        mes: statsCore.cadastrosMes,
        mesAnterior: 0,
        listaRecente: statsCore.ultimosEleitores
      },
      liderancas: statsCore.liderancasLista,
      atendimentos: statsCore.atendimentosLista,
      solicitacoes: statsCore.solicitacoesLista,
      campanhas: Array(statsCore.campanhasAtivas).fill({ status: 'EXECUCAO' })
    };
  }
};
