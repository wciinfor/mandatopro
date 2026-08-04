import { getEleitoresMetrics } from './domains/EleitoresDomainService';
import { getLiderancasMetrics } from './domains/LiderancasDomainService';
import { getCampanhasMetrics } from './domains/CampanhasDomainService';
import { getAtendimentosMetrics } from './domains/AtendimentosDomainService';
import { getSolicitacoesMetrics } from './domains/SolicitacoesDomainService';

/**
 * DashboardStatsService (Agregador Desacoplado)
 * NÃO acessa mais o Supabase diretamente.
 * Apenas agrega os Domain Services oficiais da aplicação.
 */
export async function getDashboardStatsCore(supabaseClient) {
  const [eleitores, liderancas, campanhas, atendimentos, solicitacoes] = await Promise.all([
    getEleitoresMetrics(supabaseClient),
    getLiderancasMetrics(supabaseClient),
    getCampanhasMetrics(supabaseClient),
    getAtendimentosMetrics(supabaseClient),
    getSolicitacoesMetrics(supabaseClient)
  ]);

  return {
    totalEleitores: eleitores.total,
    eleitoresAtivos: eleitores.total,
    eleitoresInativos: 0,
    totalLiderancas: liderancas.total,
    totalAtendimentos: atendimentos.total,
    campanhasAtivas: campanhas.ativasCount,
    cadastrosHoje: eleitores.hoje,
    cadastrosSemana: eleitores.semana,
    cadastrosMes: eleitores.mes,
    solicitacoesPendentes: solicitacoes.pendentesCount,
    ultimosEleitores: eleitores.listaRecente,
    liderancasLista: liderancas.lista,
    atendimentosLista: atendimentos.lista,
    solicitacoesLista: solicitacoes.lista,
    campanhasLista: campanhas.lista
  };
}
