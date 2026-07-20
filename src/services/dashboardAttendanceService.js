/**
 * Serviço responsável por buscar dados de KPIs e tempos de resposta da Central de Atendimento.
 */
export class DashboardAttendanceService {
  /**
   * Obtém os indicadores de atendimento reais
   */
  static async obterIndicadoresAtendimento() {
    const response = await fetch('/api/comunicacao-oficial/dashboard/atendimento');
    if (!response.ok) {
      throw new Error('Falha ao obter indicadores reais de atendimento.');
    }
    return response.json();
  }
}
