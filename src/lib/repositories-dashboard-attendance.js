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
    let query = this.supabase
      .from('communication_conversations')
      .select('id, status, channel, provider, unread_count, last_message_at');

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: conversas, error } = await query;

    if (error) {
      console.warn('[DashboardAttendanceRepository] Erro ao consultar communication_conversations:', error.message);
    }

    const lista = conversas || [];
    let novas = 0;
    let emAtendimento = 0;
    let aguardandoEleitor = 0;
    let concluidas = 0;
    let totalNaoLidas = 0;
    const porCanal = {};

    lista.forEach(c => {
      const st = String(c.status || '').toLowerCase();
      if (st === 'nova') novas++;
      else if (st === 'em_atendimento') emAtendimento++;
      else if (st === 'aguardando_eleitor') aguardandoEleitor++;
      else if (st === 'concluida' || st === 'finalizada') concluidas++;

      if (c.unread_count) totalNaoLidas += Number(c.unread_count) || 0;

      const canal = (c.channel || 'whatsapp').toLowerCase();
      porCanal[canal] = (porCanal[canal] || 0) + 1;
    });

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
      totalConversas: lista.length,
      semResponsavel: 0, // Campo assigned_to não existe na tabela communication_conversations
      totalNaoLidas,
      porCanal
    };
  }
}

