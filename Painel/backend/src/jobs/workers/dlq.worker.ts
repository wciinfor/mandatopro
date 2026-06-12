import { Worker, Job }  from 'bullmq';
import { env }          from '../../config/env';
import { logger }       from '../../utils/logger';
import { supabaseAdmin } from '../../config/supabase';
import type { DlqJobData } from '../queue';

// ──────────────────────────────────────────────────────────────
// DLQ WORKER — Fase 7
//
// Processa jobs que esgotaram todas as tentativas em outras filas.
// Responsabilidades:
//   1. Persistir registro de falha no banco (tabela dlq_events)
//   2. Criar alerta inbox_alerts se for job de inbox
//   3. Log estruturado para análise posterior
//
// Não tenta processar novamente — só registra e alerta.
// ──────────────────────────────────────────────────────────────

const connection = { url: env.REDIS_URL };

export const dlqWorker = new Worker<DlqJobData>(
  'dlq',
  async (job: Job<DlqJobData>) => {
    const { originalQueue, originalJobId, originalJobName, data, failedReason, attemptsMade, failedAt } = job.data;

    logger.error(
      { originalQueue, originalJobId, originalJobName, attempts: attemptsMade, reason: failedReason },
      'DLQ: job morto registrado',
    );

    // Persistir no banco para análise posterior
    const { error } = await supabaseAdmin.from('dlq_events').insert({
      original_queue:    originalQueue,
      original_job_id:   originalJobId ?? null,
      original_job_name: originalJobName,
      job_data:          data,
      failed_reason:     failedReason,
      attempts_made:     attemptsMade,
      failed_at:         failedAt,
      created_at:        new Date().toISOString(),
    });

    if (error) {
      // Se a tabela não existir ainda (ambiente de dev), apenas loga
      logger.warn({ err: error }, 'DLQ: falha ao persistir no banco (tabela dlq_events pode não existir)');
    }

    // Se for job do inbox, tentar criar alerta para o workspace
    if (originalQueue.startsWith('inbox-') || originalQueue === 'ai-analysis') {
      const jobData = data as Record<string, unknown>;
      const workspaceId = jobData['workspaceId'] as string | undefined;
      if (workspaceId) {
        await supabaseAdmin.from('inbox_alerts').insert({
          workspace_id: workspaceId,
          alert_type:   'webhook_failing',
          severity:     'critical',
          title:        `Job "${originalJobName}" falhou definitivamente`,
          message:      `Fila: ${originalQueue}. Motivo: ${failedReason.slice(0, 200)}`,
          metadata: {
            original_queue:  originalQueue,
            original_job_id: originalJobId,
            attempts_made:   attemptsMade,
          },
          resolved:   false,
          created_at: new Date().toISOString(),
        }).catch(() => { /* Silencioso */ });
      }
    }
  },
  {
    connection,
    concurrency: 2,
  },
);

dlqWorker.on('completed', (job) => {
  logger.debug({ jobId: job.id }, 'DLQ: job registrado com sucesso');
});

dlqWorker.on('failed', (job, err) => {
  // Se o próprio DLQ falhar, apenas loga — não reenfileira para evitar loop
  logger.error({ jobId: job?.id, err }, 'DLQ: falha ao processar job morto');
});

dlqWorker.on('error', (err) => {
  logger.error({ err }, 'DLQ: erro no worker');
});
