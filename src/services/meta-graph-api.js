const DEFAULT_GRAPH_VERSION = process.env.META_GRAPH_VERSION
  || process.env.NEXT_PUBLIC_META_GRAPH_VERSION
  || 'v21.0';
const REQUIRED_EMBEDDED_SIGNUP_SCOPES = ['whatsapp_business_management'];
const VALID_SYSTEM_USER_TOKEN_TYPES = ['SYSTEM_USER', 'BUSINESS'];

function calcularExpiracao(expiresIn) {
  const seconds = Number(expiresIn || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export class MetaGraphApiError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'MetaGraphApiError';
    this.details = details;
  }
}

export default class MetaGraphApiService {
  constructor(options = {}) {
    this.appId = options.appId || process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || '';
    this.appSecret = options.appSecret || process.env.META_APP_SECRET || '';
    this.graphVersion = options.graphVersion || DEFAULT_GRAPH_VERSION;
    this.baseUrl = options.baseUrl || 'https://graph.facebook.com';
  }

  assertAppCredentials() {
    if (!this.appId || !this.appSecret) {
      throw new MetaGraphApiError('META_APP_ID e META_APP_SECRET sao obrigatorios para trocar o codigo do Embedded Signup.');
    }
  }

  buildUrl(path, query = {}) {
    const normalizedPath = String(path || '').replace(/^\/+/, '');
    const url = new URL(`${this.baseUrl}/${this.graphVersion}/${normalizedPath}`);

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });

    return url;
  }

  async request(path, options = {}) {
    const { query = {}, method = 'GET', body, accessToken } = options;
    const url = this.buildUrl(path, query);

    const headers = {
      Accept: 'application/json'
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) {
      const message = data?.error?.message || `Erro na Meta Graph API: HTTP ${response.status}`;
      throw new MetaGraphApiError(message, data?.error || data);
    }

    return data;
  }

  async exchangeEmbeddedSignupCode(code) {
    this.assertAppCredentials();

    const authorizationCode = String(code || '').trim();
    if (!authorizationCode) {
      throw new MetaGraphApiError('Codigo de autorizacao do Embedded Signup nao informado.');
    }

    const data = await this.request('oauth/access_token', {
      query: {
        client_id: this.appId,
        client_secret: this.appSecret,
        code: authorizationCode,
        redirect_uri: process.env.META_OAUTH_REDIRECT_URI || undefined
      }
    });

    if (!data?.access_token) {
      throw new MetaGraphApiError('A Meta nao retornou um System User Access Token.', data);
    }

    return {
      accessToken: data.access_token,
      tokenType: data.token_type || null,
      expiresIn: data.expires_in || null,
      expiresAt: calcularExpiracao(data.expires_in),
      obtainedAt: new Date().toISOString(),
      raw: data
    };
  }

  async debugToken(inputToken) {
    this.assertAppCredentials();

    const token = String(inputToken || '').trim();
    if (!token) {
      throw new MetaGraphApiError('Token nao informado para validacao.');
    }

    const data = await this.request('debug_token', {
      query: {
        input_token: token,
        access_token: `${this.appId}|${this.appSecret}`
      }
    });

    return data?.data || {};
  }

  validarDebugToken(debugData = {}, expectedWabaId = '') {
    const errors = [];
    const scopes = Array.isArray(debugData.scopes) ? debugData.scopes : [];
    const granularScopes = Array.isArray(debugData.granular_scopes) ? debugData.granular_scopes : [];
    const targetIds = granularScopes.flatMap(scope => Array.isArray(scope?.target_ids) ? scope.target_ids.map(String) : []);
    const tokenType = String(debugData.type || '').toUpperCase();
    const expiresAt = Number(debugData.expires_at || 0);
    const dataAccessExpiresAt = Number(debugData.data_access_expires_at || 0);
    const wabaId = String(expectedWabaId || '');

    if (!debugData.is_valid) {
      errors.push('Token invalido no debug_token.');
    }

    if (String(debugData.app_id || '') !== String(this.appId)) {
      errors.push('Token pertence a outro App ID.');
    }

    if (!VALID_SYSTEM_USER_TOKEN_TYPES.includes(tokenType)) {
      errors.push(`Tipo de token inesperado: ${debugData.type || 'indefinido'}.`);
    }

    REQUIRED_EMBEDDED_SIGNUP_SCOPES.forEach(scope => {
      if (!scopes.includes(scope)) {
        errors.push(`Scope obrigatorio ausente: ${scope}.`);
      }
    });

    if (!granularScopes.length) {
      errors.push('granular_scopes ausente no debug_token.');
    }

    if (!targetIds.length) {
      errors.push('target_ids ausente em granular_scopes.');
    }

    if (wabaId && !targetIds.includes(wabaId)) {
      errors.push('WABA ID retornado pelo Embedded Signup nao consta nos target_ids do token.');
    }

    if (expiresAt && expiresAt * 1000 <= Date.now()) {
      errors.push('Token expirado.');
    }

    if (dataAccessExpiresAt && dataAccessExpiresAt * 1000 <= Date.now()) {
      errors.push('Acesso aos dados expirado.');
    }

    return {
      valid: errors.length === 0,
      errors,
      scopes,
      granularScopes,
      targetIds,
      tokenType: debugData.type || '',
      expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
      dataAccessExpiresAt: dataAccessExpiresAt ? new Date(dataAccessExpiresAt * 1000).toISOString() : null
    };
  }

  async validarWaba(accessToken, wabaId) {
    const id = String(wabaId || '').trim();
    if (!id) {
      throw new MetaGraphApiError('WABA ID nao informado para validacao.');
    }

    const data = await this.request(id, {
      accessToken,
      query: {
        fields: 'id,name,account_review_status'
      }
    });

    if (String(data?.id || '') !== id) {
      throw new MetaGraphApiError('WABA retornado pela Meta nao corresponde ao WABA informado.', data);
    }

    return data;
  }

  async obterBusiness(accessToken, businessId) {
    const id = String(businessId || '').trim();
    if (!id) {
      throw new MetaGraphApiError('Business Manager ID nao informado.');
    }

    return this.request(id, {
      accessToken,
      query: {
        fields: 'id,name,verification_status'
      }
    });
  }

  async obterNumeroWhatsapp(accessToken, phoneNumberId) {
    const id = String(phoneNumberId || '').trim();
    if (!id) {
      throw new MetaGraphApiError('Phone Number ID nao informado.');
    }

    return this.request(id, {
      accessToken,
      query: {
        fields: 'id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,name_status,status,country_code'
      }
    });
  }

  async obterPerfilWhatsapp(accessToken, phoneNumberId) {
    const id = String(phoneNumberId || '').trim();
    if (!id) {
      throw new MetaGraphApiError('Phone Number ID nao informado para consultar perfil.');
    }

    const data = await this.request(`${id}/whatsapp_business_profile`, {
      accessToken,
      query: {
        fields: 'about,address,description,email,profile_picture_url,websites,vertical'
      }
    });

    return Array.isArray(data?.data) ? data.data[0] || null : null;
  }

  async registrarNumeroWhatsapp(accessToken, phoneNumberId, pin) {
    const id = String(phoneNumberId || '').trim();
    const registrationPin = String(pin || '').trim();

    if (!id) {
      throw new MetaGraphApiError('Phone Number ID nao informado para registro.');
    }

    if (!/^\d{6}$/.test(registrationPin)) {
      throw new MetaGraphApiError('Informe um PIN de 6 digitos para registrar o numero.');
    }

    return this.request(`${id}/register`, {
      method: 'POST',
      accessToken,
      body: {
        messaging_product: 'whatsapp',
        pin: registrationPin
      }
    });
  }

  isNumeroJaRegistrado(responseOrError = {}) {
    const details = responseOrError?.details || responseOrError;
    const message = String(details?.message || responseOrError?.message || '').toLowerCase();
    const code = Number(details?.code || details?.error_subcode || 0);

    return message.includes('already registered')
      || message.includes('already been registered')
      || message.includes('phone number is already registered')
      || code === 133005;
  }

  isStatusNumeroRegistrado(phone = {}) {
    const status = String(phone?.status || '').toUpperCase();
    return ['CONNECTED', 'REGISTERED'].includes(status);
  }

  async listarNumerosWaba(accessToken, wabaId) {
    const id = String(wabaId || '').trim();
    if (!id) {
      throw new MetaGraphApiError('WABA ID nao informado para consultar numeros.');
    }

    const data = await this.request(`${id}/phone_numbers`, {
      accessToken,
      query: {
        fields: 'id,display_phone_number,verified_name,name_status'
      }
    });

    return Array.isArray(data?.data) ? data.data : [];
  }

  async validarNumeroWaba(accessToken, wabaId, phoneNumberId) {
    const id = String(phoneNumberId || '').trim();
    if (!id) {
      throw new MetaGraphApiError('Phone Number ID nao informado para validacao.');
    }

    const numbers = await this.listarNumerosWaba(accessToken, wabaId);
    const number = numbers.find(item => String(item?.id || '') === id);

    if (!number) {
      throw new MetaGraphApiError('Phone Number ID nao pertence ao WABA autorizado.', {
        phoneNumberId: id,
        wabaId,
        numbers: numbers.map(item => item?.id).filter(Boolean)
      });
    }

    return number;
  }

  async validarEmbeddedSignup({ accessToken, wabaId, phoneNumberId }) {
    const debugData = await this.debugToken(accessToken);
    const tokenValidation = this.validarDebugToken(debugData, wabaId);

    if (!tokenValidation.valid) {
      throw new MetaGraphApiError('Validacao do token falhou.', {
        errors: tokenValidation.errors,
        debugData
      });
    }

    const waba = await this.validarWaba(accessToken, wabaId);
    const phone = await this.validarNumeroWaba(accessToken, wabaId, phoneNumberId);

    return {
      tokenValidation,
      debugData,
      waba,
      phone
    };
  }
}

export function createMetaGraphApiService(options = {}) {
  return new MetaGraphApiService(options);
}
