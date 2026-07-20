/**
 * Serviço responsável por buscar dados agregados de performance e KPIs do Dashboard de Campanhas.
 */
export class DashboardCampaignService {
  /**
   * Obtém os indicadores de campanhas de forma local e real
   */
  static async obterIndicadoresCampanha() {
    const response = await fetch('/api/comunicacao-oficial/dashboard/campanhas');
    if (!response.ok) {
      throw new Error('Falha ao obter os indicadores reais de campanhas.');
    }
    return response.json();
  }
}
