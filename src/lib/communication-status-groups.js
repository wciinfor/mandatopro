/**
 * Estrutura Central de Agrupamento e Semântica de Status de Comunicação
 * 
 * Fonte Única da Verdade para Dashboard, Relatórios e Processamento de Status.
 * Evita divergências entre contagens acumuladas e fechamento matemático.
 */

export const COMMUNICATION_STATUS_GROUPS = {
  // 1. PENDENTES: Ainda não processados para envio
  pending: ['pendente'],

  // 2. AGUARDANDO CONFIRMAÇÃO: Enviados ao provider, mas sem confirmação posterior
  awaiting_confirmation: ['enviado', 'enviada', 'sent'],

  // 3. ENTREGUES EXCLUSIVAS: Confirmação de entrega recebida, mas ainda não lida
  delivered_exclusive: ['entregue', 'delivered'],

  // 4. LIDAS: Confirmação de leitura recebida
  read: ['lido', 'lida', 'read'],

  // 5. FALHAS: Falha confirmada pelo provider ou processamento
  failed: ['falha', 'falhou', 'failed', 'erro'],

  // 6. CANCELADOS: Itens cancelados antes ou durante o ciclo
  cancelled: ['cancelado', 'cancelada', 'cancelled'],

  // --- AGRUPAMENTOS ACUMULADOS PARA MÉTRICAS OFICIAIS ---

  // ENVIADAS (Acumulado): Chegou pelo menos ao estado de envio
  sent_accumulated: [
    'enviado', 'enviada', 'sent',
    'entregue', 'delivered',
    'lido', 'lida', 'read'
  ],

  // ENTREGUES (Acumulado): Entregues com ou sem leitura
  delivered_accumulated: [
    'entregue', 'delivered',
    'lido', 'lida', 'read'
  ]
};
