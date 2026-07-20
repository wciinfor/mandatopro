/**
 * Tipagens e Definições de Modelos para a camada de Conversas e Mensagens
 * Preparadas para suporte a múltiplos canais na Central de Atendimento.
 */

/**
 * @typedef {Object} Conversa
 * @property {string} id - Identificador único da conversa (UUID ou ID de Provedor)
 * @property {string} contact_id - Referência ao ID do contato (Eleitor / Lead)
 * @property {'whatsapp' | 'whatsapp_legacy' | 'instagram'} channel - Canal de origem do atendimento
 * @property {'nova' | 'em_atendimento' | 'aguardando_eleitor' | 'resolver_depois' | 'concluida'} status - Estado atual na fila
 * @property {string | null} assigned_to - ID do usuário operador atualmente responsável pelo atendimento
 * @property {number} unread_count - Quantidade de mensagens não lidas pelo operador
 * @property {string | null} last_message_at - Timestamp ISO da última mensagem enviada/recebida
 * @property {string} last_message_preview - Pré-visualização textual da última mensagem
 * @property {Object} [metadata] - Parâmetros extras e específicos de cada canal
 */

/**
 * @typedef {Object} Mensagem
 * @property {string} id - ID único da mensagem
 * @property {string} conversa_id - ID da conversa a qual a mensagem obrigatoriamente pertence
 * @property {'entrada' | 'saida' | 'nota'} direcao - Sentido do fluxo (entrada=cliente, saida=operador, nota=sistema/operador interno)
 * @property {string} mensagem - Conteúdo textual da mensagem
 * @property {string | null} media_url - URL de arquivos de mídia anexados
 * @property {string | null} media_tipo - Tipo mime-type da mídia
 * @property {string | null} provider_message_id - ID correspondente no provedor de envio (Meta, etc)
 * @property {string} status - Estado de entrega da mensagem (recebida, enviada, entregue, lida)
 * @property {string | null} usuario_id - Operador que enviou a mensagem (se for saída)
 * @property {string} created_at - Data de criação/recebimento
 */

export const ConversaStatus = {
  NOVA: 'nova',
  EM_ATENDIMENTO: 'em_atendimento',
  AGUARDANDO_ELEITOR: 'aguardando_eleitor',
  RESOLVER_DEPOIS: 'resolver_depois',
  CONCLUIDA: 'concluida'
};

export const CanaisDisponiveis = {
  WHATSAPP: 'whatsapp',
  WHATSAPP_LEGACY: 'whatsapp_legacy',
  INSTAGRAM: 'instagram'
};
