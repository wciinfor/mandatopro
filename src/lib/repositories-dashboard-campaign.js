import { COMMUNICATION_STATUS_GROUPS } from './communication-status-groups.js';

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
   * @param {number|null} [tenantId=null] - ID do tenant para isolamento multi-tenant
   * @param {Object} [filtros={}] - Filtros opcionais (ex: { provider: 'WABLAST' })
   */
  async obterMétricasGerais(tenantId = null, filtros = {}) {
    const hojeStart = new Date();
    hojeStart.setHours(0, 0, 0, 0);

    const hojeEnd = new Date();
    hojeEnd.setHours(23, 59, 59, 999);

    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 6);
    seteDiasAtras.setHours(0, 0, 0, 0);

    const providerFiltro = filtros?.provider ? String(filtros.provider).toUpperCase().trim() : null;

    // Helper para aplicar filtros de tenant e provider em communication_campaign_items
    const buildItemQuery = (statusList = null) => {
      let q = this.supabase
        .from('communication_campaign_items')
        .select('*', { count: 'exact', head: true });

      if (tenantId) q = q.eq('tenant_id', tenantId);
      if (statusList && statusList.length > 0) q = q.in('status', statusList);

      if (providerFiltro) {
        if (providerFiltro === 'WABLAST') {
          q = q.like('provider_message_id', 'cmt%');
        } else if (providerFiltro === 'META') {
          q = q.like('provider_message_id', 'wamid.%');
        } else if (providerFiltro === 'YCLOUD') {
          q = q.or('provider_message_id.ilike.msg_%,provider_message_id.ilike.ycloud_%');
        }
      }

      return q;
    };

    // 1. Total de Campanhas e Campanhas Ativas (communication_campaigns)
    let qTotalCampanhas = this.supabase
      .from('communication_campaigns')
      .select('*', { count: 'exact', head: true });

    let qCampanhasAtivas = this.supabase
      .from('communication_campaigns')
      .select('*', { count: 'exact', head: true })
      .in('status', ['ativa', 'executando', 'processando', 'na fila', 'agendado', 'em_andamento']);

    if (tenantId) {
      qTotalCampanhas = qTotalCampanhas.eq('tenant_id', tenantId);
      qCampanhasAtivas = qCampanhasAtivas.eq('tenant_id', tenantId);
    }

    // 2. Itens das Campanhas - Contagens exatas por grupo semântico (communication_campaign_items)
    // Fechamento matemático: Total = Pendentes + Aguardando + Entregues Exclusivas + Lidas + Falhas + Canceladas
    const qTotalDestinatarios = buildItemQuery();
    const qPendentes = buildItemQuery(COMMUNICATION_STATUS_GROUPS.pending);
    const qAguardandoConfirmacao = buildItemQuery(COMMUNICATION_STATUS_GROUPS.awaiting_confirmation);
    const qEntreguesExclusivas = buildItemQuery(COMMUNICATION_STATUS_GROUPS.delivered_exclusive);
    const qLidas = buildItemQuery(COMMUNICATION_STATUS_GROUPS.read);
    const qFalhas = buildItemQuery(COMMUNICATION_STATUS_GROUPS.failed);
    const qCanceladas = buildItemQuery(COMMUNICATION_STATUS_GROUPS.cancelled);

    // Métricas acumuladas oficiais
    const qEnviadasAcumuladas = buildItemQuery(COMMUNICATION_STATUS_GROUPS.sent_accumulated);
    const qEntreguesAcumuladas = buildItemQuery(COMMUNICATION_STATUS_GROUPS.delivered_accumulated);

    // 3. Mensagens enviadas hoje (communication_messages de saída)
    let qMsgsHoje = this.supabase
      .from('communication_messages')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'saida')
      .gte('created_at', hojeStart.toISOString())
      .lte('created_at', hojeEnd.toISOString());

    let qMsgsEntradaTotal = this.supabase
      .from('communication_messages')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'entrada');

    let qMsgsSaidaTotal = this.supabase
      .from('communication_messages')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'saida');

    if (tenantId) {
      qMsgsHoje = qMsgsHoje.eq('tenant_id', tenantId);
      qMsgsEntradaTotal = qMsgsEntradaTotal.eq('tenant_id', tenantId);
      qMsgsSaidaTotal = qMsgsSaidaTotal.eq('tenant_id', tenantId);
    }

    // 4. Provedores em communication_messages
    const provedoresLista = ['WABLAST', 'YCLOUD', 'META', 'whatsapp', 'INSTAGRAM'];
    const queriesProvedor = provedoresLista.map(prov => {
      let q = this.supabase
        .from('communication_messages')
        .select('*', { count: 'exact', head: true })
        .eq('provider', prov);
      if (tenantId) q = q.eq('tenant_id', tenantId);
      return q;
    });

    // 5. Histórico dos últimos 7 dias (contagens exatas por dia e direção)
    const diasArray = [];
    for (let i = 0; i < 7; i++) {
      const dStart = new Date(seteDiasAtras);
      dStart.setDate(dStart.getDate() + i);
      dStart.setHours(0, 0, 0, 0);

      const dEnd = new Date(dStart);
      dEnd.setHours(23, 59, 59, 999);

      const key = dStart.toISOString().split('T')[0];
      const diaSemana = dStart.toLocaleDateString('pt-BR', { weekday: 'short' });

      diasArray.push({
        key,
        dia: diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1),
        dStart: dStart.toISOString(),
        dEnd: dEnd.toISOString()
      });
    }

    const queriesHistoricoEntrada = diasArray.map(d => {
      let q = this.supabase
        .from('communication_messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', d.dStart)
        .lte('created_at', d.dEnd)
        .eq('direction', 'entrada');
      if (tenantId) q = q.eq('tenant_id', tenantId);
      return q;
    });

    const queriesHistoricoSaida = diasArray.map(d => {
      let q = this.supabase
        .from('communication_messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', d.dStart)
        .lte('created_at', d.dEnd)
        .eq('direction', 'saida');
      if (tenantId) q = q.eq('tenant_id', tenantId);
      return q;
    });

    // 6. Campanhas Recentes (top 5 ordenadas por data de criação)
    let qCampanhasRecentes = this.supabase
      .from('communication_campaigns')
      .select('id, nome, status, total_destinatarios, created_at, communication_templates(nome), communication_audiences(nome)')
      .order('created_at', { ascending: false })
      .limit(5);

    if (tenantId) qCampanhasRecentes = qCampanhasRecentes.eq('tenant_id', tenantId);

    // Executar todas as consultas em paralelo
    const [
      resTotalCampanhas,
      resCampanhasAtivas,
      resTotalDestinatarios,
      resPendentes,
      resAguardandoConfirmacao,
      resEntreguesExclusivas,
      resLidas,
      resFalhas,
      resCanceladas,
      resEnviadasAcumuladas,
      resEntreguesAcumuladas,
      resMsgsHoje,
      resMsgsEntradaTotal,
      resMsgsSaidaTotal,
      resProvedores,
      resHistEntrada,
      resHistSaida,
      resCampanhasRecentes
    ] = await Promise.all([
      qTotalCampanhas,
      qCampanhasAtivas,
      qTotalDestinatarios,
      qPendentes,
      qAguardandoConfirmacao,
      qEntreguesExclusivas,
      qLidas,
      qFalhas,
      qCanceladas,
      qEnviadasAcumuladas,
      qEntreguesAcumuladas,
      qMsgsHoje,
      qMsgsEntradaTotal,
      qMsgsSaidaTotal,
      Promise.all(queriesProvedor),
      Promise.all(queriesHistoricoEntrada),
      Promise.all(queriesHistoricoSaida),
      qCampanhasRecentes
    ]);

    const totalCampanhas = resTotalCampanhas.count || 0;
    const campanhasAtivas = resCampanhasAtivas.count || 0;

    // Métricas por grupo de status
    const totalDestinatarios = resTotalDestinatarios.count || 0;
    const pendentes = resPendentes.count || 0;
    const aguardandoConfirmacao = resAguardandoConfirmacao.count || 0;
    const entreguesExclusivas = resEntreguesExclusivas.count || 0;
    const lidas = resLidas.count || 0;
    const falhas = resFalhas.count || 0;
    const canceladas = resCanceladas.count || 0;

    // Métricas acumuladas oficiais
    const totalEnviadas = resEnviadasAcumuladas.count || 0;
    const entregues = resEntreguesAcumuladas.count || 0;

    const mensagensEnviadasHoje = resMsgsHoje.count || 0;
    const mensagensEntrada = resMsgsEntradaTotal.count || 0;
    const mensagensSaida = resMsgsSaidaTotal.count || 0;

    // Provedores
    const porProvedor = {};
    provedoresLista.forEach((prov, idx) => {
      const c = resProvedores[idx]?.count || 0;
      if (c > 0) {
        porProvedor[prov] = c;
      }
    });

    // Histórico 7 dias
    const historicoUltimos7Dias = diasArray.map((d, idx) => {
      const ent = resHistEntrada[idx]?.count || 0;
      const sai = resHistSaida[idx]?.count || 0;
      return {
        dia: d.dia,
        data: d.key,
        total: ent + sai,
        entrada: ent,
        saida: sai
      };
    });

    // Taxas calculadas com fórmulas matematicamente corretas:
    // Taxa de Entrega Confirmada: Entregues / (Entregues + Falhas)
    // Evita penalizar mensagens que estão em 'Aguardando Confirmação'
    const totalDesfechosConhecidos = entregues + falhas;
    const taxaEntregaConfirmada = totalDesfechosConhecidos > 0
      ? Number(((entregues / totalDesfechosConhecidos) * 100).toFixed(1))
      : null;

    // Taxa de Leitura: Lidas / Entregues (onde Entregues inclui lidas)
    const taxaLeitura = entregues > 0
      ? Number(((lidas / entregues) * 100).toFixed(1))
      : null;

    // Taxa de Entrega Bruta (legada, caso algum componente ainda consuma)
    const taxaEntrega = totalEnviadas > 0
      ? Number(((entregues / totalEnviadas) * 100).toFixed(1))
      : 0;

    // Detalhar itens enviados nas top 5 campanhas recentes
    const listaRecentes = resCampanhasRecentes.data || [];
    const queriesItensRecentes = listaRecentes.map(c =>
      this.supabase
        .from('communication_campaign_items')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', c.id)
        .in('status', COMMUNICATION_STATUS_GROUPS.sent_accumulated)
    );

    const resItensRecentes = await Promise.all(queriesItensRecentes);

    const campanhasRecentes = listaRecentes.map((c, idx) => {
      const enviadas = resItensRecentes[idx]?.count || 0;
      return {
        id: c.id,
        nome: c.nome,
        template: c.communication_templates?.nome || 'Oficial',
        publico: c.communication_audiences?.nome || 'Destinatários',
        status: c.status || 'Na Fila',
        enviadas,
        totalDestinatarios: c.total_destinatarios || enviadas || 0,
        criadoEm: c.created_at
      };
    });

    return {
      totalCampanhas,
      campanhasAtivas,
      mensagensEnviadasHoje,
      totalDestinatarios,
      totalEnviadas,
      pendentes,
      aguardandoConfirmacao,
      entreguesExclusivas,
      entregues,
      lidas,
      falhas,
      canceladas,
      mensagensEntrada,
      mensagensSaida,
      taxaEntregaConfirmada: taxaEntregaConfirmada !== null ? Math.min(taxaEntregaConfirmada, 100) : null,
      taxaEntrega: Math.min(taxaEntrega, 100),
      taxaLeitura: taxaLeitura !== null ? Math.min(taxaLeitura, 100) : null,
      historicoUltimos7Dias,
      porProvedor,
      campanhasRecentes
    };
  }
}
