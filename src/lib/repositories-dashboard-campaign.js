/**
 * Repository encarregado por efetuar consultas reais e sumarizações estatísticas
 * da volumetria de campanhas e envios oficiais a partir das tabelas locais.
 */
export class DashboardCampaignRepository {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Obtém estatísticas de execução consolidadas a partir da fila de disparos locais
   */
  async obterMétricasGerais() {
    const hojeStart = new Date();
    hojeStart.setHours(0, 0, 0, 0);

    // 1. Campanhas Ativas (status = 'enviando' ou status = 'processando')
    const { count: campanhasAtivas, error: errAtivas } = await this.supabase
      .from('central_atendimento_fila_disparos')
      .select('campaign_id', { count: 'exact', head: true })
      .eq('status', 'processando');

    // 2. Enviadas hoje
    const { count: enviadasHoje, error: errHoje } = await this.supabase
      .from('central_atendimento_fila_disparos')
      .select('id', { count: 'exact', head: true })
      .in('status', ['enviada', 'entregue', 'lida'])
      .gte('finished_at', hojeStart.toISOString());

    // 3. Contadores totais por status na fila de disparos
    const { data: statusCounts, error: errStatus } = await this.supabase
      .from('central_atendimento_fila_disparos')
      .select('status, id');

    if (errAtivas || errHoje || errStatus) {
      throw new Error('Falha ao computar métricas da fila de disparos no Supabase.');
    }

    let entregues = 0;
    let lidas = 0;
    let falhas = 0;

    statusCounts.forEach(item => {
      if (item.status === 'entregue') entregues++;
      if (item.status === 'lida') {
        lidas++;
        entregues++; // Toda lida foi entregue
      }
      if (item.status === 'falhou') falhas++;
    });

    const totalCalculado = statusCounts.length || 1;
    const taxaEntrega = Number(((entregues / totalCalculado) * 100).toFixed(1));
    const taxaLeitura = Number(((lidas / totalCalculado) * 100).toFixed(1));

    return {
      campanhasAtivas: campanhasAtivas || 0,
      mensagensEnviadasHoje: enviadasHoje || 0,
      entregues,
      lidas,
      falhas,
      taxaEntrega,
      taxaLeitura
    };
  }
}
