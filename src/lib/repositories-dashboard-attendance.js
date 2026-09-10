/**
 * Repository responsável por consultar os indicadores de atendimento reais
 * diretamente a partir da tabela communication_conversations.
 */
export class DashboardAttendanceRepository {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Consulta os dados em tempo real da central de atendimento a partir de communication_conversations
   */
  async obterMétricasAtendimento(tenantId = null) {
    let qTotal = this.supabase
      .from('communication_conversations')
      .select('*', { count: 'exact', head: true });

    let qNovas = this.supabase
      .from('communication_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'nova');

    let qEmAtendimento = this.supabase
      .from('communication_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'em_atendimento');

    let qAguardandoEleitor = this.supabase
      .from('communication_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'aguardando_eleitor');

    let qConcluidas = this.supabase
      .from('communication_conversations')
      .select('*', { count: 'exact', head: true })
      .in('status', ['concluida', 'finalizada']);

    let qCanalWhatsapp = this.supabase
      .from('communication_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('channel', 'whatsapp');

    let qCanalInstagram = this.supabase
      .from('communication_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('channel', 'instagram');

    if (tenantId) {
      qTotal = qTotal.eq('tenant_id', tenantId);
      qNovas = qNovas.eq('tenant_id', tenantId);
      qEmAtendimento = qEmAtendimento.eq('tenant_id', tenantId);
      qAguardandoEleitor = qAguardandoEleitor.eq('tenant_id', tenantId);
      qConcluidas = qConcluidas.eq('tenant_id', tenantId);
      qCanalWhatsapp = qCanalWhatsapp.eq('tenant_id', tenantId);
      qCanalInstagram = qCanalInstagram.eq('tenant_id', tenantId);
    }

    const [
      resTotal,
      resNovas,
      resEmAtendimento,
      resAguardandoEleitor,
      resConcluidas,
      resWhatsapp,
      resInstagram
    ] = await Promise.all([
      qTotal,
      qNovas,
      qEmAtendimento,
      qAguardandoEleitor,
      qConcluidas,
      qCanalWhatsapp,
      qCanalInstagram
    ]);

    const totalConversas = resTotal.count || 0;
    const novas = resNovas.count || 0;
    const emAtendimento = resEmAtendimento.count || 0;
    const aguardandoEleitor = resAguardandoEleitor.count || 0;
    const concluidas = resConcluidas.count || 0;

    const porCanal = {};
    if (resWhatsapp.count > 0) porCanal['whatsapp'] = resWhatsapp.count;
    if (resInstagram.count > 0) porCanal['instagram'] = resInstagram.count;

    const conversasAbertas = novas + emAtendimento + aguardandoEleitor;

    return {
      // Contratos compatíveis com a dashboard atual:
      conversasAbertas,
      conversasAguardando: aguardandoEleitor,
      tempoMedioResposta: '0m 00s', // Não há histórico de transição de timestamps para cálculo confiável
      // Novas métricas reais detalhadas:
      novas,
      emAtendimento,
      aguardandoEleitor,
      concluidas,
      totalConversas,
      semResponsavel: 0, // Campo assigned_to não existe na tabela communication_conversations
      totalNaoLidas: 0,
      porCanal
    };
  }
}

