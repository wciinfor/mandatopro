import { logger } from './logger';
import { ServiceUnavailableException } from './errors';

// ──────────────────────────────────────────────────────────────
// CIRCUIT BREAKER — Fase 7
//
// Implementa o padrão Circuit Breaker para proteger integrações
// externas (Evolution API, OpenAI) contra falhas em cascata.
//
// Estados:
//   CLOSED    → operação normal; falhas acumuladas contam
//   OPEN      → falhas excederam threshold; chamadas falham rápido
//   HALF_OPEN → testando recuperação; 1 chamada permitida
//
// Transições:
//   CLOSED  → OPEN:      após N falhas consecutivas no windowMs
//   OPEN    → HALF_OPEN: após recoveryTimeout ms
//   HALF_OPEN → CLOSED:  se a chamada de teste passou
//   HALF_OPEN → OPEN:    se a chamada de teste falhou
// ──────────────────────────────────────────────────────────────

export enum CircuitState {
  CLOSED    = 'CLOSED',
  OPEN      = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  /** Número de falhas consecutivas para abrir o circuito. Default: 5 */
  failureThreshold?: number;
  /** Número de sucessos consecutivos no HALF_OPEN para fechar. Default: 2 */
  successThreshold?: number;
  /** Tempo em ms antes de tentar HALF_OPEN após abrir. Default: 30_000 */
  recoveryTimeout?: number;
  /** Janela de tempo em ms para resetar contagem de falhas. Default: 60_000 */
  windowMs?: number;
}

export interface CircuitBreakerStats {
  state:              CircuitState;
  failures:           number;
  successes:          number;
  lastFailureAt:      number | null;
  lastSuccessAt:      number | null;
  openedAt:           number | null;
  totalCalls:         number;
  totalFailures:      number;
  totalSuccesses:     number;
  totalFastFails:     number;
}

export class CircuitBreaker {
  private readonly name:             string;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly recoveryTimeout:  number;
  private readonly windowMs:         number;

  private _state:         CircuitState = CircuitState.CLOSED;
  private _failures:      number = 0;
  private _successes:     number = 0;
  private _openedAt:      number | null = null;
  private _lastFailureAt: number | null = null;
  private _lastSuccessAt: number | null = null;

  // Contadores totais (para métricas)
  private _totalCalls:      number = 0;
  private _totalFailures:   number = 0;
  private _totalSuccesses:  number = 0;
  private _totalFastFails:  number = 0;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name             = name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.recoveryTimeout  = options.recoveryTimeout  ?? 30_000;
    this.windowMs         = options.windowMs         ?? 60_000;
  }

  getState(): CircuitState { return this._state; }

  getStats(): CircuitBreakerStats {
    return {
      state:         this._state,
      failures:      this._failures,
      successes:     this._successes,
      lastFailureAt: this._lastFailureAt,
      lastSuccessAt: this._lastSuccessAt,
      openedAt:      this._openedAt,
      totalCalls:        this._totalCalls,
      totalFailures:     this._totalFailures,
      totalSuccesses:    this._totalSuccesses,
      totalFastFails:    this._totalFastFails,
    };
  }

  reset(): void {
    this._state     = CircuitState.CLOSED;
    this._failures  = 0;
    this._successes = 0;
    this._openedAt  = null;
    logger.info({ circuit: this.name }, 'CircuitBreaker: reset manual para CLOSED');
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this._totalCalls++;

    // OPEN → verificar se é hora de tentar HALF_OPEN
    if (this._state === CircuitState.OPEN) {
      const elapsed = Date.now() - (this._openedAt ?? 0);
      if (elapsed < this.recoveryTimeout) {
        this._totalFastFails++;
        throw new ServiceUnavailableException(this.name);
      }
      // Transição para HALF_OPEN
      this._transitionTo(CircuitState.HALF_OPEN);
    }

    // HALF_OPEN → janela de falhas pode ter expirado no CLOSED
    if (this._state === CircuitState.CLOSED && this._lastFailureAt !== null) {
      const elapsed = Date.now() - this._lastFailureAt;
      if (elapsed > this.windowMs) {
        this._failures = 0;
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  private _onSuccess(): void {
    this._totalSuccesses++;
    this._lastSuccessAt = Date.now();

    if (this._state === CircuitState.HALF_OPEN) {
      this._successes++;
      if (this._successes >= this.successThreshold) {
        this._failures  = 0;
        this._successes = 0;
        this._transitionTo(CircuitState.CLOSED);
      }
    } else {
      // CLOSED: reset da contagem de falhas a cada sucesso
      this._failures = 0;
    }
  }

  private _onFailure(): void {
    this._totalFailures++;
    this._failures++;
    this._lastFailureAt = Date.now();

    if (this._state === CircuitState.HALF_OPEN) {
      // Falha no HALF_OPEN → volta para OPEN imediatamente
      this._successes = 0;
      this._transitionTo(CircuitState.OPEN);
    } else if (this._state === CircuitState.CLOSED) {
      if (this._failures >= this.failureThreshold) {
        this._transitionTo(CircuitState.OPEN);
      }
    }
  }

  private _transitionTo(newState: CircuitState): void {
    const previous = this._state;
    this._state = newState;

    if (newState === CircuitState.OPEN) {
      this._openedAt  = Date.now();
      this._successes = 0;
      logger.warn(
        { circuit: this.name, previous, failures: this._failures },
        'CircuitBreaker: ABERTO — falhas consecutivas excederam threshold',
      );
    } else if (newState === CircuitState.HALF_OPEN) {
      this._successes = 0;
      logger.info(
        { circuit: this.name, previous },
        'CircuitBreaker: HALF_OPEN — testando recuperação',
      );
    } else if (newState === CircuitState.CLOSED) {
      this._openedAt = null;
      logger.info(
        { circuit: this.name, previous },
        'CircuitBreaker: FECHADO — serviço recuperado',
      );
    }
  }
}

// ── Registro global de circuit breakers ────────────────────────
// Permite consulta centralizada para métricas e health checks.

const _registry = new Map<string, CircuitBreaker>();

export function getOrCreateBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  if (!_registry.has(name)) {
    _registry.set(name, new CircuitBreaker(name, options));
  }
  return _registry.get(name)!;
}

export function listBreakers(): { name: string; stats: CircuitBreakerStats }[] {
  return Array.from(_registry.entries()).map(([name, cb]) => ({ name, stats: cb.getStats() }));
}
