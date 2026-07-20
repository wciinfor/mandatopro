/**
 * Definições dos novos modelos normalizados para persistência multicanal
 */

/**
 * @typedef {Object} NormalConversa
 * @property {string} id - UUID de controle interno da central de atendimento
 * @property {'meta' | 'legada' | 'instagram' | 'manual'} provider - Provedor da conexão de infraestrutura
 * @property {'whatsapp' | 'whatsapp_legacy' | 'instagram'} channel - Tipo do canal operacional
 * @property {string} external_conversation_id - Identificador único da conversa no provedor externo
 * @property {string} contact_id - Identificador/Telefone do destinatário opt-in
 * @property {'nova' | 'em_atendimento' | 'aguardando_eleitor' | 'resolver_depois' | 'concluida'} status - Estado da conversa
 * @property {string | null} assigned_to - ID do usuário operador
 * @property {number} unread_count - Total de mensagens pendentes
 * @property {string | null} last_message_at - ISO timestamp
 * @property {string | null} last_message_preview - Pré-visualização textual
 * @property {Object} [metadata] - Informações extras da integração
 */

/**
 * @typedef {Object} NormalMensagem
 * @property {string} id - UUID interno
 * @property {string} conversation_id - FK obrigatória vinculada a NormalConversa (internal id)
 * @property {'meta' | 'legada' | 'instagram' | 'manual'} provider - Provedor de infraestrutura
 * @property {string} provider_message_id - Identificador único da mensagem no provedor
 * @property {'whatsapp' | 'whatsapp_legacy' | 'instagram'} channel - Canal de transmissão
 * @property {'entrada' | 'saida' | 'nota'} direction - Direção do fluxo da conversa
 * @property {string} message - Corpo do texto enviado
 * @property {string | null} media_url - URL de anexo se houver
 * @property {string | null} media_type - Tipo MIME de anexo
 * @property {string} status - Estado de entrega
 * @property {string | null} sender_id - ID do remetente (Operador ou nulo)
 * @property {string} created_at - Timestamp de recebimento ou envio
 */
