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

    const hojeEnd = new Date();
    hojeEnd.setHours(23, 59, 59, 999);

    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 6);
    seteDiasAtras.setHours(0, 0, 0, 0);

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

    // 2. Itens das Campanhas - Métricas oficiais de disparos (communication_campaign_items)
    // Enviadas: enviado, enviada, sent, entregue, delivered, lido, lida, read
    const statusEnviadas = ['enviado', 'enviada', 'sent', 'entregue', 'delivered', 'lido', 'lida', 'read'];
    // Entregues: entregue, delivered, lido, lida, read
    const statusEntregues = ['entregue', 'delivered', 'lido', 'lida', 'read'];
    // Lidas: lido, lida, read
    const statusLidas = ['lido', 'lida', 'read'];
    // Falhas: falha, falhou, failed, erro
    const statusFalhas = ['falha', 'falhou', 'failed', 'erro'];

    let qEnviadas = this.supabase
      .from('communication_campaign_items')
      .select('*', { count: 'exact', head: true })
      .in('status', statusEnviadas);

    let qEntregues = this.supabase
      .from('communication_campaign_items')
      .select('*', { count: 'exact', head: true })
      .in('status', statusEntregues);

    let qLidas = this.supabase
      .from('communication_campaign_items')
      .select('*', { count: 'exact', head: true })
      .in('status', statusLidas);

    let qFalhas = this.supabase
      .from('communication_campaign_items')
      .select('*', { count: 'exact', head: true })
      .in('status', statusFalhas);

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
      resEnviadas,
      resEntregues,
      resLidas,
      resFalhas,
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
      qEnviadas,
      qEntregues,
      qLidas,
      qFalhas,
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
    const totalEnviadas = resEnviadas.count || 0;
    const entregues = resEntregues.count || 0;
    const lidas = resLidas.count || 0;
    const falhas = resFalhas.count || 0;
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

    // Taxas calculadas sobre os valores reais de disparos de campanhas
    const taxaEntrega = totalEnviadas > 0 ? Number(((entregues / totalEnviadas) * 100).toFixed(1)) : 0;
    const taxaLeitura = totalEnviadas > 0 ? Number(((lidas / totalEnviadas) * 100).toFixed(1)) : 0;

    // Detalhar itens enviados nas top 5 campanhas recentes
    const listaRecentes = resCampanhasRecentes.data || [];
    const queriesItensRecentes = listaRecentes.map(c =>
      this.supabase
        .from('communication_campaign_items')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', c.id)
        .in('status', statusEnviadas)
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
      totalEnviadas,
      mensagensEntrada,
      mensagensSaida,
      entregues,
      lidas,
      falhas,
      taxaEntrega: Math.min(taxaEntrega, 100),
      taxaLeitura: Math.min(taxaLeitura, 100),
      historicoUltimos7Dias,
      porProvedor,
      campanhasRecentes
    };
  }
}
