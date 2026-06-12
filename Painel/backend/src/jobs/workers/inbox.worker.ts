import { Worker, Job } from 'bullmq';
import { env }               from '../../config/env';
import { logger }            from '../../utils/logger';
import { InboxInboundJobData, inboxInboundQueue, sendToDlq } from '../queue';
import {
  handleMessagesUpsert,
  handleMessageUpdate,
} from '../../modules/inbox/inbox.webhook.handler';

// ──────────────────────────────────────────────────────────────
// WORKER DO INBOX INBOUND — Fase 7 atualizado
//
// Fase 7: adicionada integração com DLQ após falha definitiva
// ──────────────────────────────────────────────────────────────

const connection = { url: env.REDIS_URL };

const HANDLERS: Record<string, (raw: Record<string, unknown>) => Promise<void>> = {
  MESSAGES_UPSERT:  handleMessagesUpsert,
  MESSAGE_UPDATE:   handleMessageUpdate,
};

export const inboxInboundWorker = new Worker<InboxInboundJobData>(
  'inbox:inbound',
  async (job: Job<InboxInboundJobData>) => {
    const { event, instanceName, payload } = job.data;

    const handler = HANDLERS[event];
    if (!handler) {
      logger.debug({ event, instanceName }, 'InboxWorker: evento sem handler, ignorando');
      return;
    }

    try {
      await handler(payload);
    } catch (err) {
      logger.error(
        { event, instanceName, jobId: job.id, err },
        'InboxWorker: falha ao processar job',
      );
      throw err;
    }
  },
  {
    connection,
    concurrency: 5,
  },
);

inboxInboundWorker.on('completed', (job) => {
  logger.debug({ jobId: job.id, event: job.data.event }, 'InboxWorker: job concluído');
});

inboxInboundWorker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, event: job?.data?.event, err },
    'InboxWorker: job falhou definitivamente',
  );

  // Enviar para DLQ após esgotar todas as tentativas
  if (job && (job.attemptsMade >= (job.opts.attempts ?? 3))) {
    void sendToDlq({
      originalQueue:   'inbox-inbound',
      originalJobId:   job.id,
      originalJobName: job.name,
      data:            job.data,
      failedReason:    err.message ?? String(err),
      attemptsMade:    job.attemptsMade,
      failedAt:        new Date().toISOString(),
    });
  }
});

inboxInboundWorker.on('error', (err) => {
  logger.error({ err }, 'InboxWorker: erro no worker');
});

export { inboxInboundQueue };
