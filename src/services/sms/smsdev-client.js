/**
 * SMSDev API Client — Conector HTTP Seguro para Envio de SMS
 *
 * Comunicação oficial com a API SMSDev (https://api.smsdev.com.br/v1).
 *
 * Características de Segurança:
 * - Utiliza a chave master de servidor `SMSDEV_API_KEY`.
 * - Nunca expõe nem registra credenciais ou tokens em logs.
 * - Mascara números de telefone nos logs operacionais.
 * - Timeout configurável via AbortController.
 * - Classificação estrita de retorno:
 *     1. Aceite pelo provedor (HTTP 200, situacao='OK', id gerado)
 *     2. Rejeição explícita (situacao='ERRO' ou HTTP 4xx com recusa definitiva)
 *     3. Falha incerta de comunicação (Timeout, erro de socket, HTTP 5xx)
 */

const SMSDEV_DEFAULT_BASE_URL = 'https://api.smsdev.com.br/v1';
const SMSDEV_DEFAULT_TIMEOUT_MS = 10000; // 10 segundos

/**
 * Mascara número de telefone para logs seguros.
 * Exemplo: '5591980928129' -> '+55 (91) *****-8129'
 * @param {string} telefone
 * @returns {string}
 */
export function mascararTelefone(telefone = '') {
  const limpo = String(telefone || '').replace(/\D/g, '');
  if (limpo.length >= 10) {
    const ddi = limpo.length === 13 ? `+${limpo.slice(0, 2)} ` : '';
    const dddIndex = limpo.length === 13 ? 2 : 0;
    const ddd = limpo.slice(dddIndex, dddIndex + 2);
    const final4 = limpo.slice(-4);
    return `${ddi}(${ddd}) *****-${final4}`;
  }
  return '***-****';
}

export default class SmsDevClient {
  /**
   * @param {Object} [config]
   * @param {string} [config.apiKey] - Chave da API SMSDev (default: process.env.SMSDEV_API_KEY)
   * @param {string} [config.baseUrl] - URL base da API (default: https://api.smsdev.com.br/v1)
   * @param {number} [config.timeoutMs] - Timeout da requisição em ms (default: 10000)
   */
  constructor({
    apiKey = process.env.SMSDEV_API_KEY,
    baseUrl = SMSDEV_DEFAULT_BASE_URL,
    timeoutMs = SMSDEV_DEFAULT_TIMEOUT_MS
  } = {}) {
    this.apiKey = String(apiKey || '').trim();
    this.baseUrl = String(baseUrl || SMSDEV_DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = Number(timeoutMs) || SMSDEV_DEFAULT_TIMEOUT_MS;
  }

  /**
   * Valida se a chave de API está configurada.
   * @private
   */
  _assegurarApiKey() {
    if (!this.apiKey) {
      const err = new Error('SMSDEV_API_KEY não configurada no servidor.');
      err.code = 'CONFIG_MISSING';
      err.isExplicitRejection = true;
      err.isUncertain = false;
      throw err;
    }
  }

  /**
   * Executa envio de SMS individual através do endpoint /v1/send.
   *
   * @param {Object} params
   * @param {string} params.telefone - Número do destinatário formatado (DDI + DDD + Celular, ex: 5591980928129)
   * @param {string} params.mensagem - Texto da mensagem (máx 160 caracteres padrão)
   * @param {string} params.referId - Identificador único de conciliação / idempotência
   * @returns {Promise<{success: boolean, providerMessageId?: string, isExplicitRejection?: boolean, isUncertain?: boolean, situacao?: string, codigo?: string, descricao?: string, raw?: any}>}
   */
  async enviarSms({ telefone, mensagem, referId }) {
    this._assegurarApiKey();

    const telLimpo = String(telefone || '').replace(/\D/g, '');
    const msgTexto = String(mensagem || '').trim();
    const refer = String(referId || '').trim();

    if (!telLimpo) {
      return {
        success: false,
        isExplicitRejection: true,
        isUncertain: false,
        codigo: 'INVALID_NUMBER',
        descricao: 'Número de telefone inválido ou ausente.',
        raw: null
      };
    }

    if (!msgTexto) {
      return {
        success: false,
        isExplicitRejection: true,
        isUncertain: false,
        codigo: 'EMPTY_MESSAGE',
        descricao: 'Mensagem não pode ser vazia.',
        raw: null
      };
    }

    const payload = {
      key: this.apiKey,
      type: 9, // Tipo 9 = SMS padrão na SMSDev
      number: telLimpo,
      msg: msgTexto,
      refer: refer || undefined
    };

    const url = `${this.baseUrl}/send`;
    const telMascarado = mascararTelefone(telLimpo);
    console.log(`[SMSDev Client] Enviando SMS para ${telMascarado} (refer: ${refer || 'N/A'})...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Tratamento de respostas HTTP 4xx (Recusa explícita do cliente/parâmetros)
      if (response.status >= 400 && response.status < 500) {
        const erroJson = await response.json().catch(() => ({}));
        console.warn(`[SMSDev Client] Rejeição explícita HTTP ${response.status} para ${telMascarado}:`, erroJson);
        return {
          success: false,
          isExplicitRejection: true,
          isUncertain: false,
          httpStatus: response.status,
          codigo: erroJson.codigo || `HTTP_${response.status}`,
          descricao: erroJson.descricao || erroJson.message || `Rejeição HTTP ${response.status}`,
          raw: erroJson
        };
      }

      // Tratamento de respostas HTTP 5xx (Falha de infraestrutura do gateway - resultado incerto)
      if (response.status >= 500) {
        console.error(`[SMSDev Client] Erro de servidor HTTP ${response.status} ao enviar para ${telMascarado}. Resultado incerto.`);
        return {
          success: false,
          isExplicitRejection: false,
          isUncertain: true,
          httpStatus: response.status,
          codigo: `HTTP_${response.status}`,
          descricao: `Falha de infraestrutura do servidor SMSDev (HTTP ${response.status}). Estado de envio incerto.`,
          raw: null
        };
      }

      // Parse da resposta JSON (SMSDev pode retornar array de 1 item ou objeto simples)
      const data = await response.json().catch(() => null);

      if (!data) {
        // Resposta sem corpo JSON válido após HTTP 200 é tratada como incerta
        return {
          success: false,
          isExplicitRejection: false,
          isUncertain: true,
          codigo: 'INVALID_JSON_RESPONSE',
          descricao: 'Servidor retornou resposta não interpretável. Estado de envio incerto.',
          raw: null
        };
      }

      const item = Array.isArray(data) ? data[0] : data;
      const situacao = String(item?.situacao || '').toUpperCase();
      const codigo = String(item?.codigo ?? '');
      const descricao = item?.descricao || '';
      const providerId = item?.id ? String(item.id) : null;

      // 1. Cenário de Aceite com Sucesso: situacao='OK' com ID de mensagem
      if (situacao === 'OK' && providerId) {
        console.log(`[SMSDev Client] SMS aceito com sucesso pela SMSDev. ID: ${providerId}`);
        return {
          success: true,
          isExplicitRejection: false,
          isUncertain: false,
          providerMessageId: providerId,
          situacao,
          codigo,
          descricao,
          raw: item
        };
      }

      // 2. Cenário de Rejeição Explícita pelo gateway (ex: situacao='ERRO')
      if (situacao === 'ERRO' || !providerId) {
        console.warn(`[SMSDev Client] Rejeição explícita no payload da SMSDev para ${telMascarado}: ${descricao} (código ${codigo})`);
        return {
          success: false,
          isExplicitRejection: true,
          isUncertain: false,
          providerMessageId: null,
          situacao: situacao || 'ERRO',
          codigo: codigo || 'REJECTED',
          descricao: descricao || 'Mensagem rejeitada pela SMSDev',
          raw: item
        };
      }

      // Fallback seguro caso payload fuja do padrão esperado
      return {
        success: false,
        isExplicitRejection: false,
        isUncertain: true,
        codigo: 'UNKNOWN_RESPONSE_STATE',
        descricao: `Resposta inesperada da SMSDev: ${JSON.stringify(item)}`,
        raw: item
      };

    } catch (networkError) {
      clearTimeout(timeoutId);

      const isTimeout = networkError.name === 'AbortError';
      const detail = isTimeout ? 'Timeout na conexão com a SMSDev (>= 10s)' : networkError.message;

      console.error(`[SMSDev Client] Falha de comunicação de rede para ${telMascarado}: ${detail}. Resultado incerto.`);

      // Falha de rede após submissão de pacote HTTP tem resultado incerto:
      // O gateway pode ter recebido e processado o SMS antes da desconexão.
      return {
        success: false,
        isExplicitRejection: false,
        isUncertain: true,
        codigo: isTimeout ? 'NETWORK_TIMEOUT' : 'NETWORK_ERROR',
        descricao: `Falha de transmissão: ${detail}. Estado do envio incerto na SMSDev.`,
        raw: { error: networkError.message, name: networkError.name }
      };
    }
  }

  /**
   * Consulta o saldo de créditos da conta master na SMSDev.
   * Endpoint: GET /v1/balance?key={apiKey}
   *
   * @returns {Promise<{success: boolean, saldo?: number, raw?: any, error?: string}>}
   */
  async consultarSaldoMaster() {
    this._assegurarApiKey();

    const url = `${this.baseUrl}/balance?key=${encodeURIComponent(this.apiKey)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status} ao consultar saldo master`
        };
      }

      const data = await response.json().catch(() => null);
      const item = Array.isArray(data) ? data[0] : data;

      // SMSDev retorna saldo numérico ou string no payload
      const saldo = item?.saldo !== undefined ? Number(item.saldo) : (typeof item === 'number' ? item : null);

      return {
        success: true,
        saldo,
        raw: item
      };
    } catch (err) {
      clearTimeout(timeoutId);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Consulta o status de entrega (DLR) de uma mensagem enviada na SMSDev.
   * Endpoint: GET /v1/dlr?key={apiKey}&id={providerMessageId}
   *
   * @param {string} providerMessageId - ID gerado pela SMSDev no envio
   * @returns {Promise<{success: boolean, situacao?: string, codigo?: string, descricao?: string, raw?: any}>}
   */
  async consultarStatusDlr(providerMessageId) {
    this._assegurarApiKey();

    if (!providerMessageId) {
      throw new Error('providerMessageId é obrigatório para consulta de status DLR.');
    }

    const url = `${this.baseUrl}/dlr?key=${encodeURIComponent(this.apiKey)}&id=${encodeURIComponent(providerMessageId)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status} ao consultar status DLR`
        };
      }

      const data = await response.json().catch(() => null);
      const item = Array.isArray(data) ? data[0] : data;

      return {
        success: true,
        situacao: item?.situacao,
        codigo: item?.codigo,
        descricao: item?.descricao,
        raw: item
      };
    } catch (err) {
      clearTimeout(timeoutId);
      return {
        success: false,
        error: err.message
      };
    }
  }
}
