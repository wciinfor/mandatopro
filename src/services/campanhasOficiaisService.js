/**
 * Serviço base responsável pelo gerenciamento de Campanhas de Disparos Oficiais.
 */
export class CampanhasOficiaisService {
  /**
   * Obtém lista de campanhas cadastradas no sistema
   * @param {Object} [filters]
   * @returns {Promise<Array<import('@/lib/model-campanhas-oficiais').CampanhaOficial>>}
   */
  static async listarCampanhas(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`/api/comunicacao-oficial/campanhas?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Falha ao obter lista de campanhas.');
    }
    return response.json();
  }

  /**
   * Cria um novo registro de campanha oficial
   * @param {Object} campanhaData
   * @returns {Promise<import('@/lib/model-campanhas-oficiais').CampanhaOficial>}
   */
  static async criarCampanha(campanhaData) {
    const response = await fetch('/api/comunicacao-oficial/campanhas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campanhaData)
    });
    if (!response.ok) {
      throw new Error('Falha ao cadastrar nova campanha oficial.');
    }
    return response.json();
  }

  /**
   * Atualiza informações e status de uma campanha (ex: pausar, agendar)
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<boolean>}
   */
  static async atualizarCampanha(id, updates) {
    const response = await fetch(`/api/comunicacao-oficial/campanhas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) {
      throw new Error('Falha ao atualizar parâmetros da campanha.');
    }
    return response.json();
  }
}
