/**
 * WaBlast API Service - Cliente HTTP Isolado para Partner API
 * 
 * Fornece comunicação autenticada via Bearer Token para a Partner API do WaBlast.
 * Trata erros com segurança sem expor API Keys ou session tokens nos logs.
 */

export default class WaBlastApiService {
  /**
   * @param {Object} [config={}]
   * @param {string} [config.apiKey] - Chave de API Partner (wak_...)
   * @param {string} [config.baseUrl='https://api.wablastmessage.com'] - URL base da Partner API
   * @param {number} [config.timeoutMs=15000] - Timeout em milissegundos
   */
  constructor({
    apiKey = process.env.WABLAST_API_KEY,
    baseUrl = process.env.WABLAST_BASE_URL || 'https://api.wablastmessage.com',
    timeoutMs = 15000
  } = {}) {
    this.apiKey = String(apiKey || '').trim();
    this.baseUrl = String(baseUrl || 'https://api.wablastmessage.com').replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
  }

  /**
   * Executa uma requisição HTTP autenticada à Partner API do WaBlast
   * @param {string} endpoint - Caminho do endpoint (ex: '/v1/onboarding/sessions')
   * @param {Object} [options={}] - Opções da requisição (method, body, headers)
   */
  async request(endpoint, { method = 'GET', body = null, headers = {} } = {}) {
    if (!this.apiKey) {
      throw new Error('WaBlastApiService: WABLAST_API_KEY não configurada');
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    const reqHeaders = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...headers
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      reqHeaders['Content-Type'] = 'application/json';
    }

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

      const responseText = await response.text().catch(() => '');
      let responseData = {};
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { rawText: responseText };
      }

      if (!response.ok) {
        let errorMsg = responseData?.error?.message 
          || responseData?.message 
          || (typeof responseData?.error === 'string' ? responseData.error : '')
          || responseData?.rawText 
          || `HTTP ${response.status} ${response.statusText}`;

        if (response.status === 401) {
          errorMsg = `Falha de autenticação na integração WaBlast (401 UNAUTHENTICATED): Chave de API ausente, inválida ou revogada. Atualize a WABLAST_API_KEY no arquivo .env.local e tente novamente. (${errorMsg})`;
        }

        const error = new Error(`Erro na API WaBlast: ${errorMsg}`);
        error.status = response.status;
        error.code = response.status === 401 ? 'UNAUTHENTICATED' : (responseData?.error?.code || responseData?.code || 'WABLAST_API_ERROR');
        error.details = responseData;
        throw error;
      }

      return responseData;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutError = new Error(`Requisição à WaBlast excedeu o tempo limite (${this.timeoutMs}ms)`);
        timeoutError.code = 'WABLAST_TIMEOUT';
        throw timeoutError;
      }

      // Sanitizar mensagens de erro para nunca vazar a API Key
      if (this.apiKey && error.message && error.message.includes(this.apiKey)) {
        error.message = error.message.replace(new RegExp(this.apiKey, 'g'), '[REDACTED_WABLAST_API_KEY]');
      }
      throw error;
    }
  }

  /**
   * Cria uma sessão de onboarding para conectar um tenant via WaBlast
   * POST /v1/onboarding/sessions
   * 
   * @param {Object} params
   * @param {string} params.externalRef - Referência externa do tenant (ex: 'tenant_1')
   * @param {string} params.redirectUri - URL de retorno após o onboarding
   */
  async createOnboardingSession({ externalRef, redirectUri }) {
    if (!externalRef) {
      throw new Error('WaBlastApiService.createOnboardingSession: externalRef é obrigatório');
    }
    if (!redirectUri) {
      throw new Error('WaBlastApiService.createOnboardingSession: redirectUri é obrigatório');
    }

    const payload = {
      external_ref: externalRef,
      redirect_uri: redirectUri
    };

    return this.request('/v1/onboarding/sessions', {
      method: 'POST',
      body: payload
    });
  }

  /**
   * Consulta o status de uma sessão de onboarding
   * GET /v1/onboarding/sessions/{id}
   * 
   * @param {string} sessionId - ID da sessão de onboarding
   */
  async getOnboardingSession(sessionId) {
    if (!sessionId) {
      throw new Error('WaBlastApiService.getOnboardingSession: sessionId é obrigatório');
    }

    return this.request(`/v1/onboarding/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'GET'
    });
  }

  /**
   * Obtém detalhes e números de uma conta conectada
   * GET /v1/accounts/{id}
   * 
   * @param {string} accountId - ID da conta WaBlast
   */
  async getAccount(accountId) {
    if (!accountId) {
      throw new Error('WaBlastApiService.getAccount: accountId é obrigatório');
    }

    return this.request(`/v1/accounts/${encodeURIComponent(accountId)}`, {
      method: 'GET'
    });
  }

  /**
   * Obtém a lista de templates de mensagem de uma conta conectada no WaBlast
   * GET /v1/accounts/{accountId}/templates
   * 
   * @param {string} accountId - ID da conta WaBlast
   * @param {Object} [options={}] - Filtros opcionais (status, etc.)
   */
  async getTemplates(accountId, options = {}) {
    if (!accountId) {
      throw new Error('WaBlastApiService.getTemplates: accountId é obrigatório');
    }

    let endpoint = `/v1/accounts/${encodeURIComponent(accountId)}/templates`;
    if (options.status) {
      endpoint += `?status=${encodeURIComponent(options.status)}`;
    }

    return this.request(endpoint, {
      method: 'GET'
    });
  }

  /**
   * Registra um domínio permitido para redirecionamento no onboarding
   * POST /v1/onboarding/domains
   * 
   * @param {string} domain - Domínio a registrar (ex: 'app.mandatopro.com.br')
   */
  async registerOnboardingDomain(domain) {
    if (!domain) {
      throw new Error('WaBlastApiService.registerOnboardingDomain: domain é obrigatório');
    }

    const payload = {
      domain,
      purpose: 'REDIRECT'
    };

    return this.request('/v1/onboarding/domains', {
      method: 'POST',
      body: payload
    });
  }

  /**
   * Envia uma mensagem via WaBlast Partner API
   * POST /v1/messages
   * 
   * @param {Object} payload - Payload oficial da mensagem
   * @param {Object} [headers={}] - Headers adicionais se aplicável (ex: X-Account-ID)
   */
  async sendMessage(payload, headers = {}) {
    return this.request('/v1/messages', {
      method: 'POST',
      body: payload,
      headers
    });
  }
}

/**
 * Factory helper para instanciar o WaBlastApiService
 * @param {Object} [config]
 * @returns {WaBlastApiService}
 */
export function createWaBlastApiService(config) {
  return new WaBlastApiService(config);
}
