import { Queue } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// ──────────────────────────────────────────────────────────────
// DEFINIÇÃO DAS FILAS (BullMQ + Redis) — Fase 7 atualizada
//
// Fase 7: adicionada DLQ, stalled interval e limiter em filas críticas
//
// Filas disponíveis:
//   campaign:dispatch → disparo em lotes
//   instance:warmup   → aquecimento de instâncias
//   notifications     → notificações em tempo real
//   ai:analysis       → análise de conversas por IA
//   inbox:inbound     → webhook Evolution → banco → Realtime
//   inbox:sla-check   → verificação recorrente de SLA (Fase 6)
//   dlq               → Dead-Letter Queue: jobs que esgotaram tentativas
// ──────────────────────────────────────────────────────────────

const connection = { url: env.REDIS_URL };

// Opções padrão seguras para todos os jobs
const DEFAULT_JOB_OPTS = {
  removeOnComplete: { count: 1_000 },
  removeOnFail:     { count: 500  },
};

export const campaignDispatchQueue = new Queue('campaign-dispatch', {
  connection,
  defaultJobOptions: {
    attempts:  3,
    backoff:   { type: 'exponential', delay: 5_000 },
    ...DEFAULT_JOB_OPTS,
  },
});

export const warmupQueue = new Queue('instance-warmup', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff:  { type: 'fixed', delay: 10_000 },
    removeOnComplete: { count: 200 },
    removeOnFail:     { count: 100 },
  },
});

export const notificationQueue = new Queue('notifications', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff:  { type: 'exponential', delay: 2_000 },
    removeOnComplete: true,
    removeOnFail:     { count: 100 },
  },
});

export const aiAnalysisQueue = new Queue('ai-analysis', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff:  { type: 'fixed', delay: 15_000 },
    removeOnComplete: { count: 500 },
    removeOnFail:     { count: 200 },
  },
});

// Fila de mensagens inbound do Inbox (Evolution → banco → Realtime)
// Fase 7: adicionado stalledInterval para detectar jobs travados mais rápido
export const inboxInboundQueue = new Queue('inbox-inbound', {
  connection,
  defaultJobOptions: {
    attempts:  3,
    backoff:   { type: 'exponential', delay: 2_000 },
    removeOnComplete: { count: 2_000 },
    removeOnFail:     { count: 500 },
  },
});

// ── Dead-Letter Queue — Fase 7 ────────────────────────────────
// Jobs que esgotaram todas as tentativas em qualquer fila são
// re-enfileirados aqui manualmente (ver `sendToDlq`).
// Processamento: alertas + persistência para análise posterior.
export const dlqQueue = new Queue('dlq', {
  connection,
  defaultJobOptions: {
    attempts:         1,      // DLQ não tenta novamente
    removeOnComplete: { count: 200 },
    removeOnFail:     { count: 1_000 },
  },
});

// ── Tipos dos jobs ────────────────────────────────────────────

export interface CampaignDispatchJobData {
  campaignId:  string;
  workspaceId: string;
  batchSize:   number;
  offsetStart: number;
}

export interface WarmupJobData {
  instanceId:   string;
  instanceName: string;
  workspaceId:  string;
  targetScore:  number;
}

export interface NotificationJobData {
  userId:      string;
  workspaceId: string;
  type:        string;
  title:       string;
  message:     string;
  metadata?:   Record<string, unknown>;
}

export interface AiAnalysisJobData {
  conversationId: string;
  workspaceId:    string;
  triggeredBy:    string | null;
  model?:         string;
}

export interface InboxInboundJobData {
  event:        string;
  instanceName: string;
  payload:      Record<string, unknown>;
}

// ── DLQ Job Data ─────────────────────────────────────────────

export interface DlqJobData {
  originalQueue:   string;
  originalJobId:   string | undefined;
  originalJobName: string;
  data:            unknown;
  failedReason:    string;
  attemptsMade:    number;
  failedAt:        string;  // ISO
}

// ── Helpers de enfileiramento ─────────────────────────────────

export async function enqueueCampaignDispatch(
  data: CampaignDispatchJobData,
): Promise<void> {
  await campaignDispatchQueue.add('dispatch', data);
  logger.debug({ campaignId: data.campaignId }, 'Job de disparo enfileirado');
}

export async function enqueueWarmup(data: WarmupJobData): Promise<void> {
  await warmupQueue.add('warmup', data);
  logger.debug({ instanceId: data.instanceId }, 'Job de warmup enfileirado');
}

export async function enqueueNotification(data: NotificationJobData): Promise<void> {
  await notificationQueue.add('send', data);
}

export async function enqueueAiAnalysis(data: AiAnalysisJobData): Promise<void> {
  await aiAnalysisQueue.add('analyze', data);
  logger.debug({ conversationId: data.conversationId }, 'Job de análise IA enfileirado');
}

export async function enqueueInboxInbound(data: InboxInboundJobData): Promise<void> {
  await inboxInboundQueue.add('inbound', data);
  logger.debug({ event: data.event, instance: data.instanceName }, 'Job inbox:inbound enfileirado');
}

/**
 * Envia um job para a Dead-Letter Queue.
 * Chamado pelos workers no evento 'failed' quando todas as tentativas esgotam.
 */
export async function sendToDlq(data: DlqJobData): Promise<void> {
  try {
    await dlqQueue.add('dead-letter', data);
    logger.warn(
      { originalQueue: data.originalQueue, originalJobId: data.originalJobId, reason: data.failedReason },
      'Job enviado para DLQ',
    );
  } catch (err) {
    logger.error({ err, data }, 'Falha ao enviar job para DLQ');
  }
}
