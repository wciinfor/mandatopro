/**
 * Serviço responsável por controlar o processamento do Motor de Campanhas e
 * gerar a Fila de Execução.
 */
export class MotorCampanhasService {
  /**
   * Inicializa a fila de disparos para uma campanha específica
   * @param {string} campanhaId
   * @param {Array<string>} telefonesDestinatarios
   * @param {string} templateId
   * @param {Object} variaveisMapeadas
   * @param {string | null} dataAgendamento
   */
  static async programarCampanha(campanhaId, telefonesDestinatarios, templateId, variaveisMapeadas, dataAgendamento) {
    const payload = {
      campanhaId,
      telefones: telefonesDestinatarios,
      templateId,
      variaveis: variaveisMapeadas,
      agendadoPara: dataAgendamento
    };

    const response = await fetch('/api/comunicacao-oficial/motor/programar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Falha ao registrar e programar a fila da campanha.');
    }
    return response.json();
  }

  /**
   * Obtém estatísticas e progresso de envio da campanha em tempo real
   * @param {string} campanhaId
   */
  async obterStatusExecucao(campanhaId) {
    const response = await fetch(`/api/comunicacao-oficial/motor/status?campanhaId=${campanhaId}`);
    if (!response.ok) {
      throw new Error('Falha ao monitorar progresso da campanha.');
    }
    return response.json();
  }
}
