/**
 * Serviço base responsável pelo gerenciamento de Públicos e Segmentações.
 */
export class PublicosOficiaisService {
  /**
   * Obtém a lista de públicos cadastrados
   * @param {Object} [filters]
   * @returns {Promise<Array<import('@/lib/model-publicos-oficiais').PublicoOficial>>}
   */
  static async listarPublicos(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`/api/comunicacao-oficial/publicos?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Falha ao obter lista de públicos.');
    }
    return response.json();
  }

  /**
   * Cria um novo grupo de público (audiência reutilizável)
   * @param {Object} publicoData
   * @returns {Promise<import('@/lib/model-publicos-oficiais').PublicoOficial>}
   */
  static async criarPublico(publicoData) {
    const response = await fetch('/api/comunicacao-oficial/publicos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(publicoData)
    });
    if (!response.ok) {
      throw new Error('Falha ao registrar novo público.');
    }
    return response.json();
  }

  /**
   * Sincroniza e recalcula contatos da audiência de acordo com as regras ativas
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  static async recalcularPublico(id) {
    const response = await fetch(`/api/comunicacao-oficial/publicos/${id}/recalcular`, {
      method: 'POST'
    });
    if (!response.ok) {
      throw new Error('Falha ao recalcular audiência.');
    }
    return response.json();
  }
}
