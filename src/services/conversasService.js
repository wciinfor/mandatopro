/**
 * Serviço responsável por gerenciar a lógica de Conversas e Mensagens da Central de Atendimento.
 * Garante que todas as mensagens pertençam e estejam atreladas a uma conversa específica.
 */

export class ConversasService {
  /**
   * Obtém conversas filtradas do banco de dados/API
   * @param {Object} filters
   * @returns {Promise<{success: boolean, data: Array}>}
   */
  static async getConversas(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`/api/atendimento-connect/conversas?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Falha ao buscar conversas no servidor.');
    }
    return response.json();
  }

  /**
   * Cria ou localiza uma conversa ativa para um determinado contato/canal
   * @param {Object} params
   * @param {string} params.contactId
   * @param {string} params.channel
   * @returns {Promise<Object>}
   */
  static async findOrCreateConversa({ contactId, channel }) {
    const response = await fetch('/api/atendimento-connect/conversas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId, channel, status: 'nova' })
    });
    if (!response.ok) {
      throw new Error('Falha ao iniciar conversa.');
    }
    return response.json();
  }

  /**
   * Vincula e registra uma mensagem em uma conversa obrigatória
   * @param {string} conversaId - ID da conversa associada
   * @param {Object} mensagemData - Atributos da mensagem
   * @returns {Promise<Object>}
   */
  static async registrarMensagem(conversaId, mensagemData) {
    const response = await fetch(`/api/atendimento-connect/conversas/${conversaId}/mensagens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mensagemData)
    });
    if (!response.ok) {
      throw new Error('Erro ao registrar mensagem na conversa.');
    }
    return response.json();
  }

  /**
   * Atualiza metadados e atribuição de responsável da conversa
   * @param {string} conversaId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  static async updateConversa(conversaId, updates) {
    const response = await fetch(`/api/atendimento-connect/conversas/${conversaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) {
      throw new Error('Falha ao atualizar parâmetros da conversa.');
    }
    return response.json();
  }
}
