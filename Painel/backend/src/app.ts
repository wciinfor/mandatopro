import Fastify    from 'fastify';
import cors       from '@fastify/cors';
import helmet     from '@fastify/helmet';
import rateLimit  from '@fastify/rate-limit';
import websocket  from '@fastify/websocket';
import crypto     from 'node:crypto';

import { env }                from './config/env';
import { logger }             from './utils/logger';
import { errorHandlerPlugin } from './middleware/error_handler';
import { registerRoutes }     from './api';
import { inboxWsRoutes }      from './modules/inbox/inbox.ws';
import { httpRequestsTotal, httpRequestDurationMs } from './utils/metrics';

export async function buildApp() {
  const fastify = Fastify({
    loggerInstance: logger,
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
  });

  // ── Segurança ──────────────────────────────────────────────
  await fastify.register(helmet, {
    global: true,
    // CSP restritivo para endpoints de API (não servem HTML)
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'none'"],
        scriptSrc:   ["'none'"],
        styleSrc:    ["'none'"],
        imgSrc:      ["'none'"],
        connectSrc:  ["'none'"],
        fontSrc:     ["'none'"],
        objectSrc:   ["'none'"],
        frameSrc:    ["'none'"],
        baseUri:     ["'none'"],
        formAction:  ["'none'"],
      },
    },
    // Headers de segurança adicionais
    crossOriginEmbedderPolicy: false,  // API pública não precisa
    crossOriginOpenerPolicy:   { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy:            { policy: 'strict-origin-when-cross-origin' },
    // Evita MIME-sniffing
    noSniff: true,
    // Força HTTPS em produção (1 ano)
    hsts: env.NODE_ENV === 'production'
      ? { maxAge: 31_536_000, includeSubDomains: true }
      : false,
  });

  await fastify.register(cors, {
    origin:      env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await fastify.register(rateLimit, {
    max:        env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: (_req, ctx) => ({
      success: false,
      error: {
        code:    'RATE_LIMIT_EXCEEDED',
        message: `Muitas requisições. Tente novamente em ${ctx.after}.`,
      },
      meta: { requestId: '', timestamp: new Date().toISOString() },
    }),
  });

  // ── WebSocket (inbox realtime — typing + presença) ─────────
  await fastify.register(websocket);
  await fastify.register(inboxWsRoutes);

  // ── Error handler global ───────────────────────────────────
  await fastify.register(errorHandlerPlugin);

  // ── Rotas ──────────────────────────────────────────────────
  await registerRoutes(fastify);

  // ── Hooks de métricas HTTP ─────────────────────────────────
  // onRequest: marca o timestamp de início na request
  fastify.addHook('onRequest', (request, _reply, done) => {
    (request as unknown as Record<string, unknown>)['_startMs'] = Date.now();
    done();
  });

  // onResponse: registra métricas de latência e contador
  fastify.addHook('onResponse', (request, reply, done) => {
    const start  = (request as unknown as Record<string, number>)['_startMs'] ?? Date.now();
    const dur    = Date.now() - start;
    const method = request.method;
    // Normalizar rota para evitar alta cardinalidade nos labels
    const route  = request.routeOptions?.url ?? request.url.split('?')[0] ?? 'unknown';
    const status = String(reply.statusCode);

    httpRequestsTotal.inc({ method, route, status });
    httpRequestDurationMs.observe(dur, { method, route });
    done();
  });

  return fastify;
}

