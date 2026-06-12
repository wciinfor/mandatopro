import { Queue, Worker, Job } from 'bullmq';
import { env }                from '../../config/env';
import { logger }             from '../../utils/logger';
import { checkAndMarkBreaches, createBreachAlerts } from '../../modules/inbox/inbox.sla';

// ──────────────────────────────────────────────────────────────
// WORKER SLA:CHECK — Fase 6
//
// Job recorrente que executa a cada 2 minutos:
//  1. Busca conversas com SLA de primeira resposta vencido
//  2. Busca conversas com SLA de resolução vencido
//  3. Marca ambos como breached no banco
//  4. Cria alertas inbox_alerts para cada breach novo
//
// Não bloqueia o inbox — opera em background.
// Usa BullMQ repeat para auto-agendar.
// ──────────────────────────────────────────────────────────────

const connection = { url: env.REDIS_URL };

// ── Fila SLA (auto-agendada) ──────────────────────────────────

const slaCheckQueue = new Queue('inbox-sla-check', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 10 },
    removeOnFail:     { count: 20 },
  },
});

// ── Agendar job recorrente na inicialização ───────────────────
// BullMQ dedup por chave de repeat — não cria duplicatas se já existir

(async () => {
  try {
    await slaCheckQueue.add(
      'check',
      {},
      {
        repeat:   { every: 2 * 60_000 },  // a cada 2 minutos
        attempts: 1,
        // Identificador único para dedup
        jobId:    'sla-check-recurring',
      },
    );
    logger.info('SlaWorker: job recorrente agendado (2min)');
  } catch (err) {
    logger.warn({ err }, 'SlaWorker: falha ao agendar job recorrente');
  }
})();

// ── Worker ────────────────────────────────────────────────────

export const slaCheckWorker = new Worker(
  'inbox-sla-check',
  async (_job: Job) => {
    logger.debug('SlaWorker: iniciando verificação de SLA');

    try {
      const breaches = await checkAndMarkBreaches();

      if (breaches.length > 0) {
        await createBreachAlerts(breaches);
        logger.info({ count: breaches.length }, 'SlaWorker: breaches processados e alertas criados');
      } else {
        logger.debug('SlaWorker: nenhum breach detectado');
      }
    } catch (err) {
      logger.error({ err }, 'SlaWorker: erro durante verificação');
      // Não relançar — o job deve sempre completar para manter o ciclo recorrente
    }
  },
  {
    connection,
    concurrency: 1,  // SLA check deve rodar serializado
  },
);

slaCheckWorker.on('completed', (job) => {
  logger.debug({ jobId: job.id }, 'SlaWorker: verificação concluída');
});

slaCheckWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'SlaWorker: job falhou');
});

slaCheckWorker.on('error', (err) => {
  logger.error({ err }, 'SlaWorker: erro no worker');
});
