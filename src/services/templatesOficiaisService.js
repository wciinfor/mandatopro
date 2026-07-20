/**
 * Serviço base responsável pelo gerenciamento de Templates Oficiais da API de Nuvem da Meta.
 */
export class TemplatesOficiaisService {
  /**
   * Obtém lista de templates cadastrados localmente
   * @param {Object} [filters]
   * @returns {Promise<Array<import('@/lib/model-templates-oficiais').TemplateOficial>>}
   */
  static async listarTemplates(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`/api/comunicacao-oficial/templates?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Falha ao obter lista de templates.');
    }
    return response.json();
  }

  /**
   * Executa a chamada base para sincronizar templates com o Meta Business Suite
   * @returns {Promise<boolean>}
   */
  static async sincronizarComMeta() {
    const response = await fetch('/api/comunicacao-oficial/templates/sincronizar', {
      method: 'POST'
    });
    if (!response.ok) {
      throw new Error('Falha ao sincronizar templates com o gerenciador da Meta.');
    }
    return response.json();
  }
}
