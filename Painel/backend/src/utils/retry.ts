import { logger } from './logger';

// ──────────────────────────────────────────────────────────────
// RETRY UTILITY — Fase 7
//
// Retry com exponential backoff + jitter para chamadas externas.
// Não use em operações que não sejam idempotentes sem validar.
//
// Uso:
//   const result = await withRetry(() => fetch(...), {
//     maxAttempts: 3,
//     baseDelay:   500,
//     label:       'evolution:sendText',
//   });
// ──────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Número máximo de tentativas (inclui a primeira). Default: 3 */
  maxAttempts?: number;
  /** Delay base em ms para o backoff. Default: 500 */
  baseDelay?: number;
  /** Delay máximo em ms (teto do backoff). Default: 10_000 */
  maxDelay?: number;
  /** Fator multiplicativo do backoff. Default: 2 */
  factor?: number;
  /** Adicionar jitter aleatório (0–50% do delay) para evitar thundering herd. Default: true */
  jitter?: boolean;
  /** Label para logging. Default: 'operation' */
  label?: string;
  /**
   * Predicado para decidir se deve tentar novamente com base no erro.
   * Se omitido, tenta novamente para qualquer erro.
   */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
}

/** Calcula o delay do próximo retry com exponential backoff e jitter opcional. */
export function calcBackoffDelay(
  attempt:   number,
  baseDelay: number,
  maxDelay:  number,
  factor:    number,
  jitter:    boolean,
): number {
  const exponential = Math.min(baseDelay * Math.pow(factor, attempt - 1), maxDelay);
  const noise       = jitter ? exponential * Math.random() * 0.5 : 0;
  return Math.round(exponential + noise);
}

export async function withRetry<T>(
  fn:      () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay   = 500,
    maxDelay    = 10_000,
    factor      = 2,
    jitter      = true,
    label       = 'operation',
    shouldRetry,
  } = options;

  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      const isLast = attempt === maxAttempts;

      // Verificar se devemos tentar novamente
      if (shouldRetry && !shouldRetry(err, attempt)) {
        logger.debug({ label, attempt }, 'Retry: erro não recuperável — desistindo');
        throw err;
      }

      if (isLast) break;

      const delay = calcBackoffDelay(attempt, baseDelay, maxDelay, factor, jitter);
      logger.warn(
        { label, attempt, maxAttempts, delayMs: delay, err },
        `Retry: tentativa ${attempt}/${maxAttempts} falhou — aguardando ${delay}ms`,
      );
      await sleep(delay);
    }
  }

  logger.error(
    { label, maxAttempts, err: lastErr },
    `Retry: todas as ${maxAttempts} tentativas falharam`,
  );
  throw lastErr;
}

/** Predicado padrão: não tenta novamente para erros 4xx (exceto 429) */
export function defaultShouldRetry(err: unknown): boolean {
  if (err instanceof Error && 'statusCode' in err) {
    const code = (err as { statusCode: number }).statusCode;
    if (code >= 400 && code < 500 && code !== 429) return false;
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
