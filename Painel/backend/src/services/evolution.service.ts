import { env } from '../config/env';
import { ServiceUnavailableException } from '../utils/errors';
import { logger } from '../utils/logger';
import { getOrCreateBreaker, CircuitState } from '../utils/circuit-breaker';
import { withRetry, defaultShouldRetry } from '../utils/retry';
import { evolutionRequestsTotal, circuitBreakerState } from '../utils/metrics';

// ──────────────────────────────────────────────────────────────
// SERVIÇO DE COMUNICAÇÃO COM A EVOLUTION API (WhatsApp)
//
// Fase 7: adicionado circuit breaker + timeout + retry
//
// Proteção contra falhas em cascata:
//   • Circuit breaker: abre após CB_FAILURE_THRESHOLD falhas
//   • Timeout: REQUEST_TIMEOUT_MS ms por chamada (AbortController)
//   • Retry: até 2 tentativas adicionais com exponential backoff
//   • Métricas: contadores para success/error/fast_fail
// ──────────────────────────────────────────────────────────────

const BREAKER_NAME = 'evolution-api';

export class EvolutionService {
  private readonly baseUrl: string;
  private readonly apiKey:  string;

  constructor() {
    this.baseUrl = env.EVOLUTION_API_URL;
    this.apiKey  = env.EVOLUTION_API_KEY;
  }

  private _updateBreakerMetric(): void {
    const breaker = getOrCreateBreaker(BREAKER_NAME);
    const stateMap: Record<CircuitState, number> = {
      [CircuitState.CLOSED]:    0,
      [CircuitState.HALF_OPEN]: 1,
      [CircuitState.OPEN]:      2,
    };
    circuitBreakerState.set(stateMap[breaker.getState()], { service: BREAKER_NAME });
  }

  private async _rawRequest<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path:   string,
    body?:  unknown,
  ): Promise<T> {
    const url        = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'apikey':        this.apiKey,
        },
        signal: controller.signal,
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });

      clearTimeout(timer);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        logger.warn({ url, status: res.status, body: text }, 'Evolution API retornou erro');
        throw new ServiceUnavailableException('Evolution API');
      }

      return res.json() as Promise<T>;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ServiceUnavailableException) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        logger.warn({ url, timeoutMs: env.REQUEST_TIMEOUT_MS }, 'Evolution API: timeout');
        throw new ServiceUnavailableException('Evolution API');
      }
      logger.error({ url, err }, 'Falha ao conectar com Evolution API');
      throw new ServiceUnavailableException('Evolution API');
    }
  }

  private async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path:   string,
    body?:  unknown,
    // Desativa retry para operações não idempotentes como GET quando necessário
    retries = 2,
  ): Promise<T> {
    const breaker = getOrCreateBreaker(BREAKER_NAME, {
      failureThreshold: env.CB_FAILURE_THRESHOLD,
      recoveryTimeout:  env.CB_RECOVERY_TIMEOUT_MS,
    });

    try {
      const result = await breaker.execute(() =>
        withRetry(() => this._rawRequest<T>(method, path, body), {
          maxAttempts: retries + 1,
          baseDelay:   500,
          maxDelay:    5_000,
          label:       `evolution:${method}:${path}`,
          shouldRetry: defaultShouldRetry,
        }),
      );

      evolutionRequestsTotal.inc({ status: 'success' });
      this._updateBreakerMetric();
      return result;
    } catch (err) {
      if (err instanceof ServiceUnavailableException && breaker.getState() !== CircuitState.CLOSED) {
        evolutionRequestsTotal.inc({ status: 'fast_fail' });
      } else {
        evolutionRequestsTotal.inc({ status: 'error' });
      }
      this._updateBreakerMetric();
      throw err;
    }
  }

  // ── Gerenciamento de instâncias ──────────────────────────

  async getInstanceStatus(name: string): Promise<unknown> {
    return this.request('GET', `/instance/connectionState/${name}`);
  }

  async createInstance(name: string, token: string): Promise<unknown> {
    return this.request('POST', '/instance/create', {
      instanceName: name,
      token,
      qrcode:      true,
      integration: 'WHATSAPP-BAILEYS',
    }, 0); // não fazer retry em criação
  }

  async deleteInstance(name: string): Promise<unknown> {
    return this.request('DELETE', `/instance/delete/${name}`, undefined, 0);
  }

  async getQrCode(name: string): Promise<unknown> {
    return this.request('GET', `/instance/connect/${name}`);
  }

  async logout(name: string): Promise<unknown> {
    return this.request('DELETE', `/instance/logout/${name}`, undefined, 0);
  }

  // ── Envio de mensagens ───────────────────────────────────

  async sendText(
    instance: string,
    payload: { number: string; text: string; delay?: number },
  ): Promise<unknown> {
    return this.request('POST', `/message/sendText/${instance}`, payload, 1);
  }

  async sendMedia(
    instance: string,
    payload: {
      number:    string;
      mediatype: 'image' | 'video' | 'audio' | 'document';
      media:     string;
      caption?:  string;
    },
  ): Promise<unknown> {
    return this.request('POST', `/message/sendMedia/${instance}`, payload, 1);
  }

  // ── Configuração de webhook ──────────────────────────────

  async setWebhook(instance: string, webhookUrl: string): Promise<unknown> {
    return this.request('POST', `/webhook/set/${instance}`, {
      url:    webhookUrl,
      events: [
        'MESSAGES_UPSERT',
        'CONNECTION_UPDATE',
        'QRCODE_UPDATED',
        'SEND_MESSAGE',
      ],
    }, 1);
  }

  /** Retorna o estado atual do circuit breaker para health checks */
  getBreakerState(): CircuitState {
    return getOrCreateBreaker(BREAKER_NAME).getState();
  }
}

export const evolutionService = new EvolutionService();
