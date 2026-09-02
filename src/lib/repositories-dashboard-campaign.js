/**
 * Repository encarregado por efetuar consultas reais e sumarizações estatísticas
 * da volumetria de campanhas e envios oficiais a partir das tabelas reais do MandatoPRO.
 */
export class DashboardCampaignRepository {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Obtém estatísticas de execução consolidadas a partir das tabelas reais
   */
  async obterMétricasGerais(tenantId = null) {
    const hojeStart = new Date();
    hojeStart.setHours(0, 0, 0, 0);

    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 6);
    seteDiasAtras.setHours(0, 0, 0, 0);

    // 1. Campanhas de Comunicação Oficial (communication_campaigns)
    let queryCampanhas = this.supabase
      .from('communication_campaigns')
      .select('id, nome, status, total_destinatarios, created_at, communication_templates(nome), communication_audiences(nome)')
      .order('created_at', { ascending: false });

    if (tenantId) queryCampanhas = queryCampanhas.eq('tenant_id', tenantId);

    const { data: campanhas, error: errCampanhas } = await queryCampanhas;
    if (errCampanhas) {
      console.warn('[DashboardCampaignRepository] Erro ao consultar communication_campaigns:', errCampanhas.message);
    }

    const listaCampanhas = campanhas || [];
    const totalCampanhas = listaCampanhas.length;
    const campanhasAtivas = listaCampanhas.filter(c => ['ativa', 'executando', 'processando', 'na fila', 'agendado'].includes(String(c.status || '').toLowerCase())).length;


    // 2. Itens das Campanhas (communication_campaign_items)
    let queryItens = this.supabase
      .from('communication_campaign_items')
      .select('id, campaign_id, status, created_at, updated_at');

    const { data: itens, error: errItens } = await queryItens;
    if (errItens) {
      console.warn('[DashboardCampaignRepository] Erro ao consultar communication_campaign_items:', errItens.message);
    }

    const listaItens = itens || [];
    let itensEnviados = 0;
    let itensEntregues = 0;
    let itensLidos = 0;
    let itensFalhas = 0;

    listaItens.forEach(item => {
      const st = String(item.status || '').toLowerCase();
      if (['enviado', 'sent'].includes(st)) itensEnviados++;
      if (['entregue', 'delivered'].includes(st)) {
        itensEntregues++;
        itensEnviados++;
      }
      if (['lida', 'read'].includes(st)) {
        itensLidos++;
        itensEntregues++;
        itensEnviados++;
      }
      if (['falha', 'failed', 'erro'].includes(st)) itensFalhas++;
    });

    // 3. Mensagens Oficiais (communication_messages)
    let queryMsgs = this.supabase
      .from('communication_messages')
      .select('id, direction, provider, channel, meta_dados, created_at');
    if (tenantId) queryMsgs = queryMsgs.eq('tenant_id', tenantId);

    const { data: mensagens, error: errMsgs } = await queryMsgs;
    if (errMsgs) {
      console.warn('[DashboardCampaignRepository] Erro ao consultar communication_messages:', errMsgs.message);
    }

    const listaMsgs = mensagens || [];
    let msgsEnviadasHoje = 0;
    let msgsEntrada = 0;
    let msgsSaida = 0;
    let msgsEntregues = 0;
    let msgsLidas = 0;
    let msgsFalhas = 0;
    const porProvedor = {};

    // Agrupamento dos últimos 7 dias
    const historicoDias = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(seteDiasAtras);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'short' });
      historicoDias[key] = { dia: diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1), data: key, total: 0, entrada: 0, saida: 0 };
    }

    listaMsgs.forEach(m => {
      const createdAt = new Date(m.created_at);
      const isHoje = createdAt >= hojeStart;
      const isSaida = m.direction === 'saida';
      const isEntrada = m.direction === 'entrada';

      if (isSaida) {
        msgsSaida++;
        if (isHoje) msgsEnviadasHoje++;

        // Status derivado de meta_dados
        const st = String(m.meta_dados?.status || '').toLowerCase();
        if (st === 'delivered' || st === 'entregue') msgsEntregues++;
        else if (st === 'read' || st === 'lida') {
          msgsLidas++;
          msgsEntregues++;
        } else if (st === 'failed' || st === 'falhou') {
          msgsFalhas++;
        }
      } else if (isEntrada) {
        msgsEntrada++;
      }

      // Provedor
      const prov = (m.provider || 'whatsapp').toUpperCase();
      porProvedor[prov] = (porProvedor[prov] || 0) + 1;

      // Histórico 7 dias
      const dateKey = m.created_at?.split('T')[0];
      if (historicoDias[dateKey]) {
        historicoDias[dateKey].total++;
        if (isEntrada) historicoDias[dateKey].entrada++;
        if (isSaida) historicoDias[dateKey].saida++;
      }
    });

    // Consolidação de métricas totais (somando envios de campanha e mensagens diretas)
    const totalEnviadasConsolidado = Math.max(itensEnviados, msgsSaida);
    const entreguesConsolidado = Math.max(itensEntregues, msgsEntregues);
    const lidasConsolidado = Math.max(itensLidos, msgsLidas);
    const falhasConsolidado = Math.max(itensFalhas, msgsFalhas);

    const baseTaxa = totalEnviadasConsolidado > 0 ? totalEnviadasConsolidado : 1;
    const taxaEntrega = Number(((entreguesConsolidado / baseTaxa) * 100).toFixed(1));
    const taxaLeitura = Number(((lidasConsolidado / baseTaxa) * 100).toFixed(1));

    return {
      totalCampanhas,
      campanhasAtivas,
      mensagensEnviadasHoje: msgsEnviadasHoje,
      totalEnviadas: totalEnviadasConsolidado,
      mensagensEntrada: msgsEntrada,
      mensagensSaida: msgsSaida,
      entregues: entreguesConsolidado,
      lidas: lidasConsolidado,
      falhas: falhasConsolidado,
      taxaEntrega: Math.min(taxaEntrega, 100),
      taxaLeitura: Math.min(taxaLeitura, 100),
      historicoUltimos7Dias: Object.values(historicoDias),
      porProvedor,
      campanhasRecentes: listaCampanhas.slice(0, 5).map(c => {
        const itensCampanha = listaItens.filter(i => i.campaign_id === c.id);
        const enviadas = itensCampanha.filter(i => ['enviado', 'sent', 'entregue', 'delivered', 'lida', 'read'].includes(String(i.status || '').toLowerCase())).length;
        const total = c.total_destinatarios || itensCampanha.length || 0;

        return {
          id: c.id,
          nome: c.nome,
          template: c.communication_templates?.nome || 'Oficial',
          publico: c.communication_audiences?.nome || 'Destinatários',
          status: c.status || 'Na Fila',
          enviadas,
          totalDestinatarios: total,
          criadoEm: c.created_at
        };
      })
    };
  }
}
