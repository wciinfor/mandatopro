import { FastifyInstance } from 'fastify';
import { env }             from '../../config/env';
import { metrics, bullmqQueueDepth, bullmqFailedJobs } from '../../utils/metrics';
import {
  campaignDispatchQueue,
  inboxInboundQueue,
  aiAnalysisQueue,
  notificationQueue,
} from '../../jobs/queue';
import { listBreakers, CircuitState } from '../../utils/circuit-breaker';
import { circuitBreakerState }        from '../../utils/metrics';

// ──────────────────────────────────────────────────────────────
// METRICS ROUTE — Fase 7
//
// GET /metrics  → formato Prometheus text 0.0.4
//
// Segurança: se METRICS_TOKEN estiver configurado, exige Bearer.
// Em produção, expor apenas para o coletor interno (Prometheus/Victoria).
// ──────────────────────────────────────────────────────────────

const QUEUES: Array<{ name: string; queue: { getWaitingCount(): Promise<number>; getFailedCount(): Promise<number> } }> = [
  { name: 'inbox:inbound',     queue: inboxInboundQueue     },
  { name: 'ai:analysis',       queue: aiAnalysisQueue       },
  { name: 'campaign:dispatch', queue: campaignDispatchQueue },
  { name: 'notifications',     queue: notificationQueue     },
];

export async function metricsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/metrics', async (request, reply) => {
    // Verificar autenticação se METRICS_TOKEN configurado
    if (env.METRICS_TOKEN) {
      const authHeader = request.headers['authorization'] ?? '';
      const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (token !== env.METRICS_TOKEN) {
        return reply.status(401).send('Unauthorized');
      }
    }

    // Atualizar métricas de filas dinamicamente (gauge)
    try {
      await Promise.all(
        QUEUES.map(async ({ name, queue }) => {
          const [waiting, failed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getFailedCount(),
          ]);
          bullmqQueueDepth.set(waiting, { queue: name });
          bullmqFailedJobs.set(failed,  { queue: name });
        }),
      );
    } catch { /* Falha silenciosa — BullMQ pode estar indisponível */ }

    // Atualizar métricas de circuit breakers
    try {
      const stateMap: Record<CircuitState, number> = {
        [CircuitState.CLOSED]:    0,
        [CircuitState.HALF_OPEN]: 1,
        [CircuitState.OPEN]:      2,
      };
      for (const { name, stats } of listBreakers()) {
        circuitBreakerState.set(stateMap[stats.state as CircuitState] ?? 0, { service: name });
      }
    } catch { /* */ }

    // Retornar formato Prometheus text
    const text = metrics.toPrometheusText();
    reply
      .status(200)
      .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      .send(text);
  });
}
