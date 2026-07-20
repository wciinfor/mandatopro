/**
 * Serviço responsável por consultar resultados de conversão e estatísticas locais de campanhas.
 */
export class ResultadosCampanhaService {
  /**
   * Consulta os dados de funil de conversão e cliques de uma campanha específica
   * @param {string} campanhaId
   * @returns {Promise<import('@/lib/model-resultados-campanhas').ResultadosCampanhaOficial>}
   */
  static async obterResultados(campanhaId) {
    const response = await fetch(`/api/comunicacao-oficial/campanhas/${campanhaId}/resultados`);
    if (!response.ok) {
      throw new Error('Falha ao buscar resultados de conversão da campanha.');
    }
    return response.json();
  }
}
