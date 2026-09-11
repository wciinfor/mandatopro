/**
 * Serviço responsável por buscar dados agregados de performance e KPIs do Dashboard de Campanhas.
 */
export class DashboardCampaignService {
  /**
   * Obtém os indicadores de campanhas de forma local e real
   * @param {Object} [filtros={}] - Filtros de busca (ex: { provider: 'WABLAST' })
   */
  static async obterIndicadoresCampanha(filtros = {}) {
    const params = new URLSearchParams();
    if (filtros?.provider) params.append('provider', filtros.provider);
    
    const url = `/api/comunicacao-oficial/dashboard/campanhas${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Falha ao obter os indicadores reais de campanhas.');
    }
    return response.json();
  }
}
