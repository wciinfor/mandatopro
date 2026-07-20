/**
 * Definições e modelos de dados para o módulo de Campanhas (WhatsApp Cloud API HSM).
 */

/**
 * @typedef {Object} CampanhaOficial
 * @property {string} id - Identificador único da campanha
 * @property {string} nome - Nome descritivo da campanha de disparos
 * @property {'whatsapp' | 'whatsapp_legacy' | 'instagram'} canal - Canal utilizado para transmissão
 * @property {string} template - Identificador do template HSM (Meta) aprovado
 * @property {string} publico - Segmentação ou lista de contatos destinatários
 * @property {'rascunho' | 'agendado' | 'enviando' | 'concluido' | 'pausado' | 'falho'} status - Status da campanha
 * @property {string | null} agendamento - Timestamp ISO do disparo programado (nulo para disparo imediato)
 * @property {number} total_destinatarios - Contagem de contatos na lista
 * @property {number} enviadas - Total de mensagens disparadas
 * @property {number} entregues - Total de mensagens com status delivered
 * @property {number} lidas - Total de mensagens com status read
 * @property {number} falhas - Total de mensagens que falharam no envio
 * @property {string} created_at - Data de criação da campanha
 */
export const CampanhaStatus = {
  RASCUNHO: 'rascunho',
  AGENDADO: 'agendado',
  ENVIANDO: 'enviando',
  CONCLUIDO: 'concluido',
  PAUSADO: 'pausado',
  FALHO: 'falho'
};
