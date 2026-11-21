/**
 * VibeWhats API Service - Cliente HTTP Isolado e Seguro
 * 
 * Encapsula a comunicação com a API VibeWhats (https://api.vibewhats.site).
 * Totalmente desacoplado dos clientes Meta, YCloud, WaBlast e Wafly.
 * Implementa mascaramento rigoroso de tokens em logs e tratamento defensivo de erros.
 * 
 * URL base: https://api.vibewhats.site/instances/{ID}/token/{TOKEN}
 */

export class VibeWhatsApiService {
  /**
   * @param {Object} config
   * @param {string} config.instance - Identificador da instância (ID)
   * @param {string} config.token - Token de autenticação da instância
   * @param {string} [config.clientToken] - Token de cliente opcional (header Client-Token)
   * @param {string} [config.baseUrl='https://api.vibewhats.site'] - URL base do serviço
   * @param {number} [config.timeoutMs=15000] - Tempo limite em milissegundos
   */
  constructor({
    instance,
    token,
    clientToken,
    baseUrl = 'https://api.vibewhats.site',
    timeoutMs = 15000
  } = {}) {
    this.instance = String(instance || '').trim();
    this.token = String(token || '').trim();
    this.clientToken = String(clientToken || '').trim();
    this.baseUrl = String(baseUrl || 'https://api.vibewhats.site').replace(/\/+$/, '');
    this.timeoutMs = Number(timeoutMs) || 15000;
  }

  /**
   * Normaliza o telefone do destinatário mantendo apenas dígitos para números individuais
   * @param {string} phone
   * @returns {string}
   */
  _normalizePhone(phone) {
    const raw = String(phone || '').trim();
    if (!raw) return '';

    if (raw.endsWith('@newsletter') || raw.endsWith('-group') || raw.endsWith('@g.us')) {
      return raw;
    }

    return raw.replace(/\D/g, '');
  }

  /**
   * Mascara segredos e tokens sensíveis de URLs e mensagens de erro
   * @param {string} text
   * @returns {string}
   */
  _redact(text) {
    if (!text || typeof text !== 'string') return text;
    let sanitized = text;

    sanitized = sanitized.replace(/\/token\/[^/\s?]+/gi, '/token/[REDACTED_VIBEWHATS_TOKEN]');

    if (this.token && this.token.length >= 4) {
      sanitized = sanitized.split(this.token).join('[REDACTED_VIBEWHATS_TOKEN]');
    }

    if (this.clientToken && this.clientToken.length >= 4) {
      sanitized = sanitized.split(this.clientToken).join('[REDACTED_VIBEWHATS_CLIENT_TOKEN]');
    }

    return sanitized;
  }

  /**
   * Valida a presença de ID e Token antes de realizar chamadas
   * @private
   */
  _validateCredentials() {
    if (!this.instance) {
      throw {
        success: false,
        error: 'VibeWhatsApiService: instance é obrigatório',
        statusCode: 400,
        provider: 'VIBEWHATS'
      };
    }

    if (!this.token) {
      throw {
        success: false,
        error: 'VibeWhatsApiService: token é obrigatório',
        statusCode: 400,
        provider: 'VIBEWHATS'
      };
    }
  }

  /**
   * Executa requisição HTTP segura contra a API VibeWhats
   * @private
   * @param {string} path - Caminho relativo após /instances/{id}/token/{token}
   * @param {Object} options
   */
  async _request(path, { method = 'GET', body = null, isBinary = false } = {}) {
    this._validateCredentials();

    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const endpoint = `/instances/${encodeURIComponent(this.instance)}/token/${encodeURIComponent(this.token)}${cleanPath}`;
    const fullUrl = `${this.baseUrl}${endpoint}`;

    const headers = {
      'Accept': isBinary ? 'image/png, image/*, application/json' : 'application/json'
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.clientToken) {
      headers['Client-Token'] = this.clientToken;
    }

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

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errData = await response.json();
          errorMsg = errData?.message || errData?.error || errorMsg;
        } catch {
          // ignore parsing error
        }

        if (response.status === 401) {
          errorMsg = 'Credenciais inválidas na API VibeWhats (verifique ID e Token da instância)';
        } else if (response.status === 402) {
          errorMsg = 'Assinatura suspensa ou período de teste expirado na VibeWhats';
        } else if (response.status === 429) {
          errorMsg = 'Limite de requisições excedido na API VibeWhats';
        } else if (response.status >= 500) {
          errorMsg = `Erro remoto no servidor VibeWhats: ${errorMsg}`;
        }

        throw {
          success: false,
          error: this._redact(errorMsg),
          statusCode: response.status,
          provider: 'VIBEWHATS'
        };
      }

      // Se for binário (ex: imagem direta de QR code)
      if (isBinary || contentType.includes('image/')) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mime = contentType.split(';')[0] || 'image/png';
        const base64 = buffer.toString('base64');
        return {
          isBinary: true,
          mime,
          base64: `data:${mime};base64,${base64}`
        };
      }

      const responseData = await response.json().catch(() => ({}));
      return responseData;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err && err.provider === 'VIBEWHATS') {
        throw err;
      }

      if (err?.name === 'AbortError') {
        throw {
          success: false,
          error: `Tempo limite de conexão com a VibeWhats excedido (${this.timeoutMs}ms)`,
          statusCode: 504,
          provider: 'VIBEWHATS'
        };
      }

      throw {
        success: false,
        error: this._redact(err?.message || 'Falha de comunicação com a API VibeWhats'),
        statusCode: 502,
        provider: 'VIBEWHATS'
      };
    }
  }

  /**
   * Consulta o status da conexão da instância VibeWhats
   * Endpoint: GET /instances/{ID}/token/{TOKEN}/status
   * 
   * @returns {Promise<{ success: boolean, connected: boolean, smartphoneConnected: boolean, phone: string|null, status: string, raw: Object }>}
   */
  async getStatus() {
    const response = await this._request('/status', { method: 'GET' });

    const isConnected = Boolean(
      response?.connected === true ||
      String(response?.smartphoneConnected || '').toLowerCase() === 'true' ||
      String(response?.state || '').toLowerCase() === 'open' ||
      String(response?.status || '').toLowerCase() === 'connected'
    );

    const phone = response?.phone || response?.phoneNumber || response?.connectedPhone || null;

    return {
      success: true,
      connected: isConnected,
      smartphoneConnected: Boolean(response?.smartphoneConnected || isConnected),
      phone,
      status: isConnected ? 'CONNECTED' : (response?.state || response?.status || 'DISCONNECTED'),
      raw: response
    };
  }

  /**
   * Obtém a imagem do QR Code para pareamento
   * Endpoint: GET /instances/{ID}/token/{TOKEN}/qr-code/image
   * Fallback: GET /instances/{ID}/token/{TOKEN}/qr-code
   * 
   * @returns {Promise<{ success: boolean, qrCode: string, isImage: boolean }>}
   */
  async getQrCodeImage() {
    try {
      const response = await this._request('/qr-code/image', {
        method: 'GET',
        isBinary: true
      });

      if (response?.base64) {
        return {
          success: true,
          qrCode: response.base64,
          isImage: true
        };
      }

      // Se respondeu JSON com base64 ou campo value
      const rawValue = response?.value || response?.qrcode || response?.qrCode || response?.qr || null;
      if (rawValue) {
        const qrCode = rawValue.startsWith('data:') ? rawValue : `data:image/png;base64,${rawValue}`;
        return {
          success: true,
          qrCode,
          isImage: true
        };
      }
    } catch (err) {
      // Se /qr-code/image falhar, tenta fallback em /qr-code
      try {
        const fallback = await this._request('/qr-code', { method: 'GET' });
        const rawValue = fallback?.value || fallback?.qrcode || fallback?.qrCode || fallback?.qr || null;
        if (rawValue) {
          const qrCode = rawValue.startsWith('data:') ? rawValue : `data:image/png;base64,${rawValue}`;
          return {
            success: true,
            qrCode,
            isImage: true
          };
        }
      } catch {
        // propaga erro original
      }
      throw err;
    }

    throw {
      success: false,
      error: 'A API VibeWhats não retornou imagem válida de QR Code. Verifique se o número já está conectado.',
      statusCode: 400,
      provider: 'VIBEWHATS'
    };
  }

  /**
   * Envia uma mensagem de texto simples
   * Endpoint: POST /instances/{ID}/token/{TOKEN}/send-text
   * 
   * @param {Object} params
   * @param {string} params.phone - Telefone do destinatário (apenas dígitos)
   * @param {string} params.message - Texto da mensagem
   * @param {number} [params.delayMessage] - Tempo de simulação de digitação em ms
   * @returns {Promise<{ success: boolean, messageId: string, zaapId?: string, id: string, raw: Object }>}
   */
  async sendText({ phone, message, delayMessage } = {}) {
    const cleanPhone = this._normalizePhone(phone);
    if (!cleanPhone) {
      throw {
        success: false,
        error: 'VibeWhatsApiService: phone é obrigatório e deve conter número válido',
        statusCode: 400,
        provider: 'VIBEWHATS'
      };
    }

    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) {
      throw {
        success: false,
        error: 'VibeWhatsApiService: message é obrigatório e não pode ser vazio',
        statusCode: 400,
        provider: 'VIBEWHATS'
      };
    }

    const payload = {
      phone: cleanPhone,
      message: cleanMessage
    };

    if (delayMessage !== undefined && delayMessage !== null) {
      payload.delayMessage = Number(delayMessage);
    }

    const response = await this._request('/send-text', {
      method: 'POST',
      body: payload
    });

    const returnedId = response?.messageId || response?.id || response?.zaapId || null;

    if (!returnedId) {
      throw {
        success: false,
        error: 'A API VibeWhats confirmou o recebimento mas não retornou um ID de mensagem válido',
        statusCode: 502,
        provider: 'VIBEWHATS',
        details: response
      };
    }

    return {
      success: true,
      messageId: returnedId,
      zaapId: response?.zaapId || null,
      id: returnedId,
      raw: response
    };
  }

  /**
   * Envia uma mensagem com imagem e legenda opcional
   * Endpoint: POST /instances/{ID}/token/{TOKEN}/send-image
   * 
   * @param {Object} params
   * @param {string} params.phone - Telefone do destinatário (apenas dígitos)
   * @param {string} params.image - URL pública/assinada ou Base64 da imagem
   * @param {string} [params.caption] - Legenda opcional da imagem (com placeholders resolvidos)
   * @param {number} [params.delayMessage] - Tempo de simulação de digitação em ms
   * @returns {Promise<{ success: boolean, messageId: string, zaapId?: string, id: string, raw: Object }>}
   */
  async sendImage({ phone, image, caption, delayMessage } = {}) {
    const cleanPhone = this._normalizePhone(phone);
    if (!cleanPhone) {
      throw {
        success: false,
        error: 'VibeWhatsApiService: phone é obrigatório e deve conter número válido',
        statusCode: 400,
        provider: 'VIBEWHATS'
      };
    }

    const cleanImage = String(image || '').trim();
    if (!cleanImage) {
      throw {
        success: false,
        error: 'VibeWhatsApiService: image é obrigatório (URL ou Base64)',
        statusCode: 400,
        provider: 'VIBEWHATS'
      };
    }

    const payload = {
      phone: cleanPhone,
      image: cleanImage
    };

    if (caption !== undefined && caption !== null && String(caption).trim().length > 0) {
      payload.caption = String(caption).trim();
    }

    if (delayMessage !== undefined && delayMessage !== null) {
      payload.delayMessage = Number(delayMessage);
    }

    const response = await this._request('/send-image', {
      method: 'POST',
      body: payload
    });

    const returnedId = response?.messageId || response?.id || response?.zaapId || null;

    if (!returnedId) {
      throw {
        success: false,
        error: 'A API VibeWhats confirmou o recebimento da imagem mas não retornou um ID de mensagem válido',
        statusCode: 502,
        provider: 'VIBEWHATS',
        details: response
      };
    }

    return {
      success: true,
      messageId: returnedId,
      zaapId: response?.zaapId || null,
      id: returnedId,
      raw: response
    };
  }

  /**
   * Envia uma mensagem com vídeo e legenda opcional
   * Endpoint: POST /instances/{ID}/token/{TOKEN}/send-video
   * 
   * @param {Object} params
   * @param {string} params.phone - Telefone do destinatário (apenas dígitos)
   * @param {string} params.video - URL pública/assinada ou Base64 do vídeo
   * @param {string} [params.caption] - Legenda opcional do vídeo (com placeholders resolvidos)
   * @param {number} [params.delayMessage] - Tempo de simulação de digitação em ms
   * @returns {Promise<{ success: boolean, messageId: string, zaapId?: string, id: string, raw: Object }>}
   */
  async sendVideo({ phone, video, caption, delayMessage } = {}) {
    const cleanPhone = this._normalizePhone(phone);
    if (!cleanPhone) {
      throw {
        success: false,
        error: 'VibeWhatsApiService: phone é obrigatório e deve conter número válido',
        statusCode: 400,
        provider: 'VIBEWHATS'
      };
    }

    const cleanVideo = String(video || '').trim();
    if (!cleanVideo) {
      throw {
        success: false,
        error: 'VibeWhatsApiService: video é obrigatório (URL ou Base64)',
        statusCode: 400,
        provider: 'VIBEWHATS'
      };
    }

    const payload = {
      phone: cleanPhone,
      video: cleanVideo
    };

    if (caption !== undefined && caption !== null && String(caption).trim().length > 0) {
      payload.caption = String(caption).trim();
    }

    if (delayMessage !== undefined && delayMessage !== null) {
      payload.delayMessage = Number(delayMessage);
    }

    const response = await this._request('/send-video', {
      method: 'POST',
      body: payload
    });

    const returnedId = response?.messageId || response?.id || response?.zaapId || null;

    if (!returnedId) {
      throw {
        success: false,
        error: 'A API VibeWhats confirmou o recebimento do vídeo mas não retornou um ID de mensagem válido',
        statusCode: 502,
        provider: 'VIBEWHATS',
        details: response
      };
    }

    return {
      success: true,
      messageId: returnedId,
      zaapId: response?.zaapId || null,
      id: returnedId,
      raw: response
    };
  }

  /**
   * Desconecta o WhatsApp da instância VibeWhats (Padrão Z-API: GET ou POST /disconnect)
   * Endpoint: GET /instances/{ID}/token/{TOKEN}/disconnect
   * 
   * @returns {Promise<{ success: boolean, disconnected: boolean, raw: Object }>}
   */
  async disconnect() {
    let response;
    try {
      response = await this._request('/disconnect', { method: 'GET' });
    } catch (err) {
      // Fallback defensivo para POST se GET retornar 405 Method Not Allowed
      if (err?.statusCode === 405) {
        response = await this._request('/disconnect', { method: 'POST' });
      } else {
        throw err;
      }
    }

    const isSuccess = Boolean(
      response?.connected === false ||
      response?.disconnected === true ||
      response?.success === true ||
      response?.status === 'DISCONNECTED' ||
      response?.value === true ||
      !response?.error
    );

    return {
      success: isSuccess,
      disconnected: true,
      raw: response
    };
  }

  /**
   * Configuração de Webhooks na VibeWhats (preparação de estrutura sem ativação)
   * Endpoints: PUT /update-every-webhooks ou PUT /update-webhook-received
   * 
   * @param {Object} webhookConfig
   * @returns {Promise<Object>}
   */
  async updateWebhooks(webhookConfig = {}) {
    return await this._request('/update-every-webhooks', {
      method: 'PUT',
      body: webhookConfig
    });
  }
}

/**
 * Factory para criar instância do VibeWhatsApiService
 */
export function createVibeWhatsApiService(config = {}) {
  return new VibeWhatsApiService(config);
}

export default VibeWhatsApiService;
