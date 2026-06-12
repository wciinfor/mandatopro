import { FastifyInstance } from 'fastify';
import { supabaseAdmin }  from '../../config/supabase';
import { sendOk }         from '../../utils/response';
import { listBreakers }   from '../../utils/circuit-breaker';
import {
  campaignDispatchQueue,
  inboxInboundQueue,
  aiAnalysisQueue,
} from '../../jobs/queue';

// ──────────────────────────────────────────────────────────────
// HEALTH ROUTES — Fase 7
//
// GET /health         → liveness probe (load balancer, uptime bot)
// GET /health/ready   → readiness probe (K8s / Docker)
// GET /health/detailed → diagnóstico completo (supabase, redis, queues, circuit breakers)
// ──────────────────────────────────────────────────────────────

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {

  // ── Liveness — responde 200 enquanto o processo está vivo ───
  fastify.get('/health', async (_request, reply) => {
    return sendOk(reply, {
      status:    'ok',
      service:   'disparo-pro-api',
      version:   process.env.npm_package_version ?? '1.0.0',
      timestamp: new Date().toISOString(),
      uptime:    Math.floor(process.uptime()),
    });
  });

  // ── Readiness — verifica se a API está pronta para receber tráfego ──
  fastify.get('/health/ready', async (_request, reply) => {
    let supabaseOk = false;
    try {
      const { error } = await supabaseAdmin.from('workspaces').select('id').limit(1);
      supabaseOk = !error;
    } catch { /* */ }

    const ready = supabaseOk;
    const status = ready ? 200 : 503;

    reply.status(status).send({
      success: ready,
      data: { ready, supabase: supabaseOk ? 'ok' : 'error' },
      meta: { requestId: reply.request.id as string, timestamp: new Date().toISOString() },
    });
  });

  // ── Detailed — diagnóstico completo (não exposto ao público) ─
  fastify.get('/health/detailed', async (_request, reply) => {
    const checks: Record<string, 'ok' | 'error' | 'degraded'> = {};
    const details: Record<string, unknown> = {};

    // ── Supabase ─────────────────────────────────────────────
    try {
      const t0 = Date.now();
      const { error } = await supabaseAdmin.from('workspaces').select('id').limit(1);
      checks['supabase'] = error ? 'error' : 'ok';
      details['supabase_latency_ms'] = Date.now() - t0;
    } catch {
      checks['supabase'] = 'error';
    }

    // ── Redis / BullMQ — depth das filas principais ──────────
    try {
      const [inboxWaiting, aiWaiting, campaignWaiting] = await Promise.all([
        inboxInboundQueue.getWaitingCount(),
        aiAnalysisQueue.getWaitingCount(),
        campaignDispatchQueue.getWaitingCount(),
      ]);
      const [inboxFailed, aiFailed, campaignFailed] = await Promise.all([
        inboxInboundQueue.getFailedCount(),
        aiAnalysisQueue.getFailedCount(),
        campaignDispatchQueue.getFailedCount(),
      ]);
      checks['redis'] = 'ok';
      details['queues'] = {
        'inbox-inbound':    { waiting: inboxWaiting,    failed: inboxFailed    },
        'ai-analysis':      { waiting: aiWaiting,       failed: aiFailed       },
        'campaign-dispatch':{ waiting: campaignWaiting, failed: campaignFailed },
      };
    } catch {
      checks['redis'] = 'error';
    }

    // ── Circuit Breakers ─────────────────────────────────────
    try {
      const breakers = listBreakers();
      const openBreakers = breakers.filter((b) => b.stats.state !== 'CLOSED');
      checks['circuit_breakers'] = openBreakers.length > 0 ? 'degraded' : 'ok';
      details['circuit_breakers'] = breakers.map((b) => ({
        name:     b.name,
        state:    b.stats.state,
        failures: b.stats.failures,
      }));
    } catch {
      checks['circuit_breakers'] = 'error';
    }

    // ── Memória do processo ───────────────────────────────────
    const mem = process.memoryUsage();
    details['memory'] = {
      heap_used_mb:  Math.round(mem.heapUsed  / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
      rss_mb:        Math.round(mem.rss       / 1024 / 1024),
    };

    const allValues       = Object.values(checks);
    const hasError        = allValues.includes('error');
    const hasDegraded     = allValues.includes('degraded');
    const overallStatus   = hasError ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';
    const httpStatus      = hasError ? 503 : 200;

    reply.status(httpStatus).send({
      success: !hasError,
      data: {
        status: overallStatus,
        checks,
        details,
        uptime:    Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      meta: { requestId: reply.request.id as string, timestamp: new Date().toISOString() },
    });
  });
}

