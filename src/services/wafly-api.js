/**
 * Wafly API Service - Cliente HTTP Isolado e Seguro
 * 
 * Encapsula a comunicação com a API REST Bridge da Wafly (https://wafly.com.br/api-bridge-whats).
 * Totalmente desacoplado dos clientes Meta, YCloud e WaBlast.
 * Implementa redaction obrigatório de segredos em logs e tratamento defensivo de erros.
 */

export class WaflyApiService {
  /**
   * @param {Object} config
   * @param {string} config.clientToken - Token de cliente Wafly (enviado no header Client-Token)
   * @param {string} config.instance - Identificador da instância conectada (ex: EE1922ABCDEF)
   * @param {string} config.token - Token específico da instância
   * @param {string} [config.baseUrl='https://wafly.com.br/api-bridge-whats'] - Base URL da API Bridge
   * @param {number} [config.timeoutMs=15000] - Tempo limite em milissegundos
   */
  constructor({
    clientToken,
    instance,
    token,
    baseUrl = 'https://wafly.com.br/api-bridge-whats',
    timeoutMs = 15000
  } = {}) {
    this.clientToken = String(clientToken || '').trim();
    this.instance = String(instance || '').trim();
    this.token = String(token || '').trim();
    this.baseUrl = String(baseUrl || 'https://wafly.com.br/api-bridge-whats').replace(/\/+$/, '');
    this.timeoutMs = Number(timeoutMs) || 15000;
  }

  /**
   * Remove caracteres não numéricos de telefones individuais sem alterar identificadores de grupos/canais
   * @param {string} phone 
   * @returns {string}
   */
  _normalizePhone(phone) {
    const raw = String(phone || '').trim();
    if (!raw) return '';

    // Se for canal/newsletter (ex: abcd1234@newsletter), preserva
    if (raw.endsWith('@newsletter')) {
      return raw;
    }

    // Se for grupo explícito (ex: 120363XXXX-group ou 120363XXXX@g.us), preserva sufixo
    if (raw.endsWith('-group') || raw.endsWith('@g.us')) {
      return raw;
    }

    // Para telefones individuais normais, remove qualquer caractere não-dígito (+, -, (), espaços)
    return raw.replace(/\D/g, '');
  }

  /**
   * Remove tokens, credenciais e parâmetros sensíveis de strings e URLs para evitar vazamento em logs
   * @param {string} text 
   * @returns {string}
   */
  _redact(text) {
    if (!text || typeof text !== 'string') return text;
    let sanitized = text;
    // Mascara qualquer token na URL no padrão /token/{token}/
    sanitized = sanitized.replace(/\/token\/[^/\s?]+/gi, '/token/[REDACTED_WAFLY_TOKEN]');

    if (this.token && this.token.length >= 4) {
      sanitized = sanitized.split(this.token).join('[REDACTED_WAFLY_TOKEN]');
    }

    if (this.clientToken && this.clientToken.length >= 4) {
      sanitized = sanitized.split(this.clientToken).join('[REDACTED_WAFLY_CLIENT_TOKEN]');
    }

    return sanitized;
  }

  /**
   * Valida as credenciais configuradas na instância
   * @private
   */
  _validateCredentials() {
    if (!this.clientToken) {
      throw {
        success: false,
        error: 'WaflyApiService: clientToken é obrigatório',
        statusCode: 400,
        provider: 'WAFLY'
      };
    }

    if (!this.instance) {
      throw {
        success: false,
        error: 'WaflyApiService: instance é obrigatório',
        statusCode: 400,
        provider: 'WAFLY'
      };
    }

    if (!this.token) {
      throw {
        success: false,
        error: 'WaflyApiService: token da instância é obrigatório',
        statusCode: 400,
        provider: 'WAFLY'
      };
    }
  }

  /**
   * Executa uma chamada HTTP segura para a API da Wafly com mascaramento de tokens
   * @private
   * @param {string} path - Caminho relativo após a rota da instância (ex: '/send-text')
   * @param {Object} options - Parâmetros da requisição HTTP
   */
  async _request(path, { method = 'POST', body = null } = {}) {
    this._validateCredentials();

    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const endpoint = `/instances/${encodeURIComponent(this.instance)}/token/${encodeURIComponent(this.token)}${cleanPath}`;
    const fullUrl = `${this.baseUrl}${endpoint}`;

    const headers = {
      'Client-Token': this.clientToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(fullUrl, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        let errorMsg = responseData?.message || responseData?.error || `HTTP ${response.status} ${response.statusText}`;

        // Mapeamento semântico refinado dos códigos HTTP da Wafly
        if (response.status === 401) {
          errorMsg = 'Credenciais inválidas ou ausentes na API Wafly (verifique clientToken, instance e token)';
        } else if (response.status === 402) {
          errorMsg = 'Assinatura inadimplente ou período de teste expirado na Wafly';
        } else if (response.status === 429) {
          errorMsg = 'Limite de requisições excedido na API Wafly (Rate Limit)';
        } else if (response.status >= 500) {
          errorMsg = `Erro remoto no servidor Wafly: ${errorMsg}`;
        }

        throw {
          success: false,
          error: this._redact(errorMsg),
          statusCode: response.status,
          provider: 'WAFLY',
          details: responseData
        };
      }

      return responseData;
    } catch (err) {
      clearTimeout(timeoutId);

      // Se já for um erro estruturado nosso, repassa
      if (err && err.provider === 'WAFLY') {
        throw err;
      }

      // Timeout / Abort
      if (err?.name === 'AbortError') {
        throw {
          success: false,
          error: `Tempo limite de conexão com a Wafly excedido (${this.timeoutMs}ms)`,
          statusCode: 504,
          provider: 'WAFLY'
        };
      }

      // Falha de rede ou DNS
      throw {
        success: false,
        error: this._redact(err?.message || 'Falha de comunicação com o servidor da Wafly'),
        statusCode: 502,
        provider: 'WAFLY'
      };
    }
  }

  /**
   * Envia uma mensagem de texto via API Wafly
   * Endpoint: POST /instances/{instance}/token/{token}/send-text
   * 
   * @param {Object} params
   * @param {string} params.phone - Telefone do destinatário (apenas dígitos, ex: 5511999999999)
   * @param {string} params.message - Conteúdo do texto a ser enviado
   * @param {number} [params.delayMessage] - Tempo em ms para simular digitação
   * @param {string} [params.messageId] - ID de mensagem existente para resposta (reply)
   * @param {string} [params.editMessageId] - ID de mensagem sua já enviada para editar
   * @param {boolean} [params.fromMe] - Obrigatório se editMessageId for informado
   * @param {boolean} [params.isGroup] - Declara explicitamente que o destino é grupo
   * @param {Array<string>} [params.mentioned] - Telefones mencionados (grupos)
   * @returns {Promise<{ success: boolean, messageId: string, id: string }>}
   */
  async sendText({
    phone,
    message,
    delayMessage,
    messageId,
    editMessageId,
    fromMe,
    isGroup,
    mentioned
  } = {}) {
    // 1. Validação prévia de campos obrigatórios
    const cleanPhone = this._normalizePhone(phone);
    if (!cleanPhone) {
      throw {
        success: false,
        error: 'WaflyApiService: phone é obrigatório e deve conter um número válido',
        statusCode: 400,
        provider: 'WAFLY'
      };
    }

    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) {
      throw {
        success: false,
        error: 'WaflyApiService: message é obrigatório e não pode ser vazio',
        statusCode: 400,
        provider: 'WAFLY'
      };
    }

    // 2. Montagem do payload estrito (apenas envia opcionais se presentes)
    const payload = {
      phone: cleanPhone,
      message: cleanMessage
    };

    if (delayMessage !== undefined && delayMessage !== null) {
      payload.delayMessage = Number(delayMessage);
    }

    if (messageId && typeof messageId === 'string' && messageId.trim()) {
      payload.messageId = messageId.trim();
    }

    if (editMessageId && typeof editMessageId === 'string' && editMessageId.trim()) {
      payload.editMessageId = editMessageId.trim();
      if (fromMe !== undefined) {
        payload.fromMe = Boolean(fromMe);
      }
    }

    if (isGroup !== undefined && isGroup !== null) {
      payload.isGroup = Boolean(isGroup);
    }

    if (Array.isArray(mentioned) && mentioned.length > 0) {
      payload.mentioned = mentioned.map(m => this._normalizePhone(m)).filter(Boolean);
    }

    // 3. Execução da chamada HTTP
    const response = await this._request('/send-text', {
      method: 'POST',
      body: payload
    });

    const returnedId = response?.messageId || response?.id || null;

    if (!returnedId) {
      throw {
        success: false,
        error: 'A API Wafly confirmou o envio mas não retornou um messageId válido',
        statusCode: 502,
        provider: 'WAFLY',
        details: response
      };
    }

    return {
      success: true,
      messageId: returnedId,
      id: returnedId
    };
  }
}

/**
 * Factory helper para instanciar o cliente Wafly a partir de um objeto de credenciais
 * @param {Object} config
 * @returns {WaflyApiService}
 */
export function createWaflyApiService(config = {}) {
  return new WaflyApiService(config);
}

export default WaflyApiService;
