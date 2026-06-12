import { FastifyRequest, FastifyReply } from 'fastify';
import { env }                         from '../config/env';

// ──────────────────────────────────────────────────────────────
// RATE LIMIT POR WORKSPACE — Fase 7
//
// Token bucket simples em memória para limitar requests de um
// workspace específico, independente do IP.
//
// Garante isolamento de recursos multi-tenant: um workspace
// gerando flood não afeta outros workspaces.
//
// Configuração via env:
//   WORKSPACE_RATE_LIMIT_MAX       (default: 300 req)
//   WORKSPACE_RATE_LIMIT_WINDOW_MS (default: 60_000 ms)
//
// Uso no route handler:
//   preHandler: [verifyAuth, verifyWorkspace, workspaceRateLimit]
// ──────────────────────────────────────────────────────────────

interface TokenBucket {
  tokens:     number;
  lastRefill: number;
}

// Map: workspaceId → bucket
// Limite de 10.000 entradas para evitar memory leak em multi-tenant massivo.
const _buckets = new Map<string, TokenBucket>();
const _MAX_WORKSPACES = 10_000;

function _getOrCreate(workspaceId: string): TokenBucket {
  if (_buckets.has(workspaceId)) return _buckets.get(workspaceId)!;

  // Evitar crescimento indefinido do Map
  if (_buckets.size >= _MAX_WORKSPACES) {
    // Remove a entrada mais antiga (primeira inserida)
    const oldest = _buckets.keys().next().value;
    if (oldest) _buckets.delete(oldest);
  }

  const bucket: TokenBucket = {
    tokens:     env.WORKSPACE_RATE_LIMIT_MAX,
    lastRefill: Date.now(),
  };
  _buckets.set(workspaceId, bucket);
  return bucket;
}

function _refill(bucket: TokenBucket): void {
  const now     = Date.now();
  const elapsed = now - bucket.lastRefill;

  if (elapsed >= env.WORKSPACE_RATE_LIMIT_WINDOW_MS) {
    bucket.tokens    = env.WORKSPACE_RATE_LIMIT_MAX;
    bucket.lastRefill = now;
  }
}

/**
 * Verifica se o workspace ainda tem tokens disponíveis.
 * Retorna true se permitido, false se bloqueado.
 */
export function isWorkspaceAllowed(workspaceId: string): boolean {
  const bucket = _getOrCreate(workspaceId);
  _refill(bucket);

  if (bucket.tokens > 0) {
    bucket.tokens--;
    return true;
  }
  return false;
}

/**
 * Fastify preHandler: bloqueia se o workspace excedeu o rate limit.
 * Injeta o header Retry-After na resposta 429.
 */
export async function workspaceRateLimit(
  request: FastifyRequest,
  reply:   FastifyReply,
): Promise<void> {
  const { workspaceId } = request.workspaceCtx;
  if (!workspaceId) return; // não aplicar se workspace não resolvido

  if (!isWorkspaceAllowed(workspaceId)) {
    const retryAfterMs = env.WORKSPACE_RATE_LIMIT_WINDOW_MS;
    reply
      .status(429)
      .header('Retry-After', String(Math.ceil(retryAfterMs / 1000)))
      .send({
        success: false,
        error: {
          code:    'WORKSPACE_RATE_LIMIT_EXCEEDED',
          message: `Seu workspace excedeu o limite de ${env.WORKSPACE_RATE_LIMIT_MAX} requisições por ${retryAfterMs / 1000}s.`,
        },
        meta: {
          requestId: request.id as string,
          timestamp: new Date().toISOString(),
        },
      });
  }
}

// ── Flood protection para webhooks por instance name ──────────

const _webhookBuckets = new Map<string, TokenBucket>();

/**
 * Verifica flood de webhook por instance.
 * Limite mais alto (padrão 500/60s) pois são eventos externos.
 */
export function isWebhookAllowed(instanceName: string): boolean {
  if (!instanceName) return true;

  if (!_webhookBuckets.has(instanceName)) {
    if (_webhookBuckets.size >= _MAX_WORKSPACES) {
      const oldest = _webhookBuckets.keys().next().value;
      if (oldest) _webhookBuckets.delete(oldest);
    }
    _webhookBuckets.set(instanceName, {
      tokens:     env.WEBHOOK_RATE_LIMIT_MAX,
      lastRefill: Date.now(),
    });
  }

  const bucket = _webhookBuckets.get(instanceName)!;
  const now    = Date.now();
  if (now - bucket.lastRefill >= env.WEBHOOK_RATE_LIMIT_WINDOW_MS) {
    bucket.tokens    = env.WEBHOOK_RATE_LIMIT_MAX;
    bucket.lastRefill = now;
  }

  if (bucket.tokens > 0) {
    bucket.tokens--;
    return true;
  }
  return false;
}
