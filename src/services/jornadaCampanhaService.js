/**
 * Serviço responsável por buscar métricas e consultar a jornada executiva e logs
 * de campanhas locais de forma independente.
 */
export class JornadaCampanhaService {
  /**
   * Consulta os dados detalhados da jornada da campanha
   * @param {string} campanhaId
   * @returns {Promise<Object>}
   */
  static async obterDetalhesJornada(campanhaId) {
    const response = await fetch(`/api/comunicacao-oficial/campanhas/${campanhaId}/jornada`);
    if (!response.ok) {
      throw new Error('Falha ao obter logs de jornada da campanha.');
    }
    return response.json();
  }

  /**
   * Consulta a lista de envios associados à campanha com filtros operacionais
   * @param {string} campanhaId
   * @param {Object} [filtros]
   */
  static async listarFilaJornada(campanhaId, filtros = {}) {
    const params = new URLSearchParams(filtros);
    const response = await fetch(`/api/comunicacao-oficial/campanhas/${campanhaId}/fila?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Erro ao listar fila da campanha.');
    }
    return response.json();
  }
}
