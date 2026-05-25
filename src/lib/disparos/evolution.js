export class EvolutionApiError extends Error {
  constructor(message, status = 502, details = null) {
    super(message);
    this.name = 'EvolutionApiError';
    this.statusCode = status;
    this.details = details;
  }
}

const DEFAULT_EVOLUTION_API_URL = 'https://api.insystens.online';

function getConfig(options = {}) {
  const apiKey = options.apiKey || process.env.EVOLUTION_API_KEY;
  const configuredBaseUrl = process.env.EVOLUTION_API_URL || process.env.DISPARO_EVOLUTION_API_URL;
  const baseUrl = normalizeEvolutionBaseUrl(configuredBaseUrl || (options.apiKey ? DEFAULT_EVOLUTION_API_URL : ''));

  if (!baseUrl || !apiKey) {
    throw new EvolutionApiError('Evolution API nao configurada no servidor', 400);
  }

  return {
    baseUrl,
    apiKey,
    timeoutMs: Number(process.env.EVOLUTION_REQUEST_TIMEOUT_MS || process.env.REQUEST_TIMEOUT_MS || 15000)
  };
}

function normalizeEvolutionBaseUrl(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return '';

  try {
    const url = new URL(raw);
    if (url.pathname.replace(/\/+$/, '') === '/manager') {
      url.pathname = '';
      url.search = '';
      url.hash = '';
      return url.toString().replace(/\/+$/, '');
    }
  } catch {
    return raw.replace(/\/manager$/i, '');
  }

  return raw.replace(/\/manager$/i, '');
}

async function request(method, path, body, options = {}) {
  const { baseUrl, apiKey, timeoutMs } = getConfig(options);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey
      },
      signal: controller.signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });

    const text = await response.text().catch(() => '');
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new EvolutionApiError('Evolution API retornou erro', response.status, payload || text);
    }

    return payload;
  } catch (error) {
    if (error instanceof EvolutionApiError) throw error;
    if (error?.name === 'AbortError') {
      throw new EvolutionApiError('Tempo limite ao conectar com a Evolution API', 504);
    }
    throw new EvolutionApiError('Falha ao conectar com a Evolution API', 502, error?.message || null);
  } finally {
    clearTimeout(timer);
  }
}

export function criarInstancia(nome, token) {
  return request('POST', '/instance/create', {
    instanceName: nome,
    token,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS'
  });
}

export function obterStatusInstancia(nome, apiKey) {
  return request('GET', `/instance/connectionState/${encodeURIComponent(nome)}`, undefined, { apiKey });
}

export function obterQrCodeInstancia(nome, apiKey) {
  return request('GET', `/instance/connect/${encodeURIComponent(nome)}`, undefined, { apiKey });
}

export function desconectarInstancia(nome, apiKey) {
  return request('DELETE', `/instance/logout/${encodeURIComponent(nome)}`, undefined, { apiKey });
}

export function excluirInstanciaEvolution(nome) {
  return request('DELETE', `/instance/delete/${encodeURIComponent(nome)}`);
}

export function normalizarEstadoEvolution(payload) {
  const state = payload?.instance?.state
    || payload?.state
    || payload?.connectionState
    || payload?.status
    || payload?.instance?.status
    || '';

  const normalized = String(state).toLowerCase();
  if (['open', 'connected', 'connectado', 'conectado'].includes(normalized)) return 'conectada';
  if (['connecting', 'pairing', 'qrcode', 'qr'].includes(normalized)) return 'aguardando_qr';
  if (['close', 'closed', 'disconnected', 'desconectado'].includes(normalized)) return 'desconectada';
  return normalized || 'desconhecido';
}
