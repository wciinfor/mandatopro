import { getEleitoresMetrics } from '../domains/EleitoresDomainService';
import { getLiderancasMetrics } from '../domains/LiderancasDomainService';
import { getCampanhasMetrics } from '../domains/CampanhasDomainService';
import { getAtendimentosMetrics } from '../domains/AtendimentosDomainService';
import { getSolicitacoesMetrics } from '../domains/SolicitacoesDomainService';

/**
 * LiveRepository (Pass-Through Desacoplado)
 * Consome puramente os Domain Services oficiais da aplicação.
 */
export const LiveRepository = {
  async fetchLiveRawData(req, supabaseClient) {
    const [eleitores, liderancas, campanhas, atendimentos, solicitacoes] = await Promise.all([
      getEleitoresMetrics(supabaseClient),
      getLiderancasMetrics(supabaseClient),
      getCampanhasMetrics(supabaseClient),
      getAtendimentosMetrics(supabaseClient),
      getSolicitacoesMetrics(supabaseClient)
    ]);

    return {
      eleitores: {
        total: eleitores.total,
        hoje: eleitores.hoje,
        semana: eleitores.semana,
        mes: eleitores.mes,
        mesAnterior: 0,
        listaRecente: eleitores.listaRecente
      },
      liderancas: liderancas.lista,
      atendimentos: atendimentos.lista,
      solicitacoes: solicitacoes.lista,
      campanhas: campanhas.lista
    };
  }
};
