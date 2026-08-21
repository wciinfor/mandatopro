/**
 * YCloud API Service - Fundação Arquitetural Segura
 * 
 * Fornece cliente HTTP autenticado por X-API-Key para comunicação com a API YCloud.
 * Trata erros de forma segura sem expor API Keys ou segredos nos logs.
 */

export default class YCloudApiService {
  /**
   * @param {Object} config
   * @param {string} config.apiKey - Chave de API da YCloud
   * @param {string} [config.baseUrl='https://api.ycloud.com/v1'] - URL base da API YCloud
   * @param {number} [config.timeoutMs=15000] - Timeout em milissegundos
   */
  constructor({ apiKey, baseUrl = 'https://api.ycloud.com/v2', timeoutMs = 15000 } = {}) {
    this.apiKey = String(apiKey || '').trim();
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;

    if (!this.apiKey) {
      throw new Error('YCloudApiService: apiKey é obrigatória');
    }
  }

  /**
   * Executa uma requisição HTTP autenticada à API do YCloud
   * @param {string} endpoint - Caminho do endpoint (ex: '/whatsapp/messages')
   * @param {Object} options - Opções da requisição (method, body, headers)
   */
  async request(endpoint, { method = 'GET', body = null, headers = {} } = {}) {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    
    const reqHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-API-Key': this.apiKey,
      ...headers
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: reqHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = responseData?.error?.message || responseData?.message || `HTTP ${response.status} ${response.statusText}`;
        const error = new Error(`Erro na API YCloud: ${errorMsg}`);
        error.status = response.status;
        error.code = responseData?.error?.code || 'YCLOUD_API_ERROR';
        error.details = responseData;
        throw error;
      }

      return responseData;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutError = new Error(`Requisição à YCloud excedeu o tempo limite (${this.timeoutMs}ms)`);
        timeoutError.code = 'YCLOUD_TIMEOUT';
        throw timeoutError;
      }
      
      // Sanitizar mensagens para nunca vazar API Key
      if (error.message && error.message.includes(this.apiKey)) {
        error.message = error.message.replace(this.apiKey, '[REDACTED_YCLOUD_API_KEY]');
      }
      throw error;
    }
  }

  /**
   * Método base para envio de mensagens (contrato unificado v2)
   */
  async sendMessage(payload) {
    return this.request('/whatsapp/messages', {
      method: 'POST',
      body: payload
    });
  }

  /**
   * Método base para envio de templates (contrato unificado v2)
   */
  async sendTemplate(payload) {
    return this.request('/whatsapp/messages', {
      method: 'POST',
      body: {
        type: 'template',
        ...payload
      }
    });
  }

  /**
   * Consulta os templates WhatsApp cadastrados/aprovados na WABA
   */
  async getTemplates(params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `/whatsapp/templates?${query}` : '/whatsapp/templates';
    return this.request(endpoint, { method: 'GET' });
  }

  /**
   * Método base para consulta de status
   */
  async getStatus() {
    return this.request('/whatsapp/phoneNumbers', { method: 'GET' });
  }
}

export function createYCloudApiService(config) {
  return new YCloudApiService(config);
}
