/**
 * Contrato de Interface (ChannelProvider) obrigatório para todos os canais de comunicação.
 * Garante que múltiplos provedores (WhatsApp Business, WhatsApp Legacy, Instagram)
 * exponham a mesma assinatura operacional.
 * 
 * @interface ChannelProvider
 */
export class ChannelProvider {
  /**
   * Lista as conversas ativas do canal
   * @param {Object} [filters]
   * @returns {Promise<Array<import('./model-conversas').Conversa>>}
   */
  async listarConversas(filters = {}) {
    throw new Error('Método "listarConversas" deve ser implementado pelo provedor de canal.');
  }

  /**
   * Obtém as mensagens vinculadas a uma conversa específica
   * @param {string} conversationId
   * @returns {Promise<Array<import('./model-conversas').Mensagem>>}
   */
  async obterMensagens(conversationId) {
    throw new Error('Método "obterMensagens" deve ser implementado pelo provedor de canal.');
  }

  /**
   * Envia uma nova mensagem através do canal
   * @param {string} conversationId
   * @param {Object} payload
   * @param {string} payload.mensagem
   * @param {string} [payload.mediaUrl]
   * @param {string} [payload.mediaTipo]
   * @returns {Promise<import('./model-conversas').Mensagem>}
   */
  async enviarMensagem(conversationId, payload) {
    throw new Error('Método "enviarMensagem" deve ser implementado pelo provedor de canal.');
  }

  /**
   * Marca as mensagens não lidas de uma conversa como lidas
   * @param {string} conversationId
   * @returns {Promise<boolean>}
   */
  async marcarComoLida(conversationId) {
    throw new Error('Método "marcarComoLida" deve ser implementado pelo provedor de canal.');
  }

  /**
   * Vincula um responsável (operador) à conversa
   * @param {string} conversationId
   * @param {Object} operador
   * @param {string} operador.id
   * @param {string} operador.nome
   * @returns {Promise<boolean>}
   */
  async assumirConversa(conversationId, operador) {
    throw new Error('Método "assumirConversa" deve ser implementado pelo provedor de canal.');
  }

  /**
   * Finaliza / Encerra a conversa no canal
   * @param {string} conversationId
   * @returns {Promise<boolean>}
   */
  async encerrarConversa(conversationId) {
    throw new Error('Método "encerrarConversa" deve ser implementado pelo provedor de canal.');
  }
}
