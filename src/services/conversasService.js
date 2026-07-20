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
   * Obtém conversas normalizadas a partir da tabela communication_conversations
   */
  static async listarConversas(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`/api/comunicacao-oficial/conversas?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Falha ao obter lista de conversas oficiais.');
    }
    return response.json();
  }

  /**
   * Obtém histórico de mensagens normalizadas a partir da tabela communication_messages
   * @param {string} conversaId
   */
  static async obterMensagens(conversaId) {
    const response = await fetch(`/api/comunicacao-oficial/conversas/${conversaId}/mensagens`);
    if (!response.ok) {
      throw new Error('Falha ao obter histórico de mensagens oficiais.');
    }
    return response.json();
  }

  /**
   * Envia uma mensagem oficial através do ChannelProvider e persiste
   */
  static async enviarMensagem(conversaId, payload) {
    const response = await fetch(`/api/comunicacao-oficial/conversas/${conversaId}/mensagens/enviar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error('Falha ao enviar mensagem oficial.');
    }
    return response.json();
  }

  /**
   * Encaminha o evento normalizado da Meta para processamento e gravação física no banco
   * @param {Object} eventoNormalizado
   */
  static async processarEventoMeta(eventoNormalizado) {
    const response = await fetch('/api/comunicacao-oficial/processar-evento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventoNormalizado)
    });
    if (!response.ok) {
      throw new Error('Falha ao processar evento normalizado da Meta no servidor.');
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
