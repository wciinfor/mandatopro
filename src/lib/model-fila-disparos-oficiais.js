/**
 * Definições e modelos de dados para o Motor de Campanhas (Fila de Execução / Jobs de Disparos).
 */

/**
 * @typedef {Object} FilaDisparoOficial
 * @property {string} id - Identificador único do item de disparo
 * @property {string} campaign_id - ID da campanha de disparo oficial vinculada
 * @property {string} contact_id - ID ou telefone do contato destinatário
 * @property {string} template_id - ID do template oficial utilizado
 * @property {'pendente' | 'processando' | 'enviada' | 'entregue' | 'lida' | 'falhou' | 'cancelada'} status - Estado do envio do item
 * @property {string} scheduled_at - Data e hora ISO agendada para início do disparo
 * @property {string | null} started_at - Timestamp de início do processamento pelo motor
 * @property {string | null} finished_at - Timestamp de conclusão (sucesso ou falha definitiva)
 * @property {string | null} provider_message_id - Identificador único de envio fornecido pela Meta Cloud API
 * @property {string | null} delivered_at - Timestamp de quando o contato recebeu a mensagem no celular
 * @property {string | null} read_at - Timestamp de quando o contato visualizou/leu a mensagem no WhatsApp
 * @property {number} attempts - Número de tentativas de envio executadas (máximo 3)
 * @property {string | null} last_error - Mensagem de erro retornada pelo provedor na última tentativa
 * @property {Object} [variaveis_mapeadas] - Objeto com os valores finais preenchidos para as variáveis (ex: {"1": "João"})
 */

export const FilaDisparoStatus = {
  PENDENTE: 'pendente',
  PROCESSANDO: 'processando',
  ENVIADA: 'enviada',
  ENTREGUE: 'entregue',
  LIDA: 'lida',
  FALHOU: 'falhou',
  CANCELADA: 'cancelada'
};
