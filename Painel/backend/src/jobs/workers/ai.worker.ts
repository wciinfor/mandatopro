import { Worker, Job } from 'bullmq';
import { env }                from '../../config/env';
import { logger }             from '../../utils/logger';
import { AiAnalysisJobData }  from '../queue';
import * as repo              from '../../modules/inbox/inbox.repository';
import { analyzeConversation } from '../../modules/inbox/inbox.ai';

// ──────────────────────────────────────────────────────────────
// WORKER AI:ANALYSIS — Fase 5
//
// Processa análise assíncrona de conversas via OpenAI.
// Concorrência = 3 (chamadas à API têm latência mas são baratas).
// Nunca bloqueia o inbox — fire-and-forget da perspectiva da rota.
// ──────────────────────────────────────────────────────────────

const connection = { url: env.REDIS_URL };

export const aiAnalysisWorker = new Worker<AiAnalysisJobData>(
  'ai-analysis',
  async (job: Job<AiAnalysisJobData>) => {
    const { workspaceId, conversationId, model } = job.data;

    logger.info({ conversationId, workspaceId, jobId: job.id }, 'AiWorker: iniciando análise');

    // 1. Marcar como 'processing'
    try {
      await repo.updateAiAnalysis(workspaceId, conversationId, 'processing');
    } catch (err) {
      logger.warn({ err, conversationId }, 'AiWorker: falha ao marcar processing — continuando');
    }

    // 2. Buscar mensagens da conversa
    const rawMessages = await repo.getMessagesForAi(workspaceId, conversationId, 40);

    if (rawMessages.length === 0) {
      logger.warn({ conversationId }, 'AiWorker: sem mensagens — marcando como failed');
      await repo.updateAiAnalysis(workspaceId, conversationId, 'failed', {
        error_message: 'Nenhuma mensagem disponível para análise.',
      });
      return;
    }

    // Converter para o formato esperado pela IA
    const messages = rawMessages
      .filter((m) => m.message?.trim())
      .map((m) => ({
        direction: m.direction as 'inbound' | 'outbound' | 'system' | 'ai',
        text:      m.message!,
      }));

    if (messages.length === 0) {
      await repo.updateAiAnalysis(workspaceId, conversationId, 'failed', {
        error_message: 'Mensagens sem conteúdo de texto para análise.',
      });
      return;
    }

    // 3. Chamar serviço de IA
    const analysisResult = await analyzeConversation({ messages }, model);

    if (!analysisResult) {
      logger.warn({ conversationId }, 'AiWorker: análise retornou null — marcando failed');
      await repo.updateAiAnalysis(workspaceId, conversationId, 'failed', {
        error_message: 'Serviço de IA indisponível. Contate o administrador do sistema.',
      });
      return;
    }

    // 4. Persistir resultado
    await repo.updateAiAnalysis(workspaceId, conversationId, 'completed', {
      ...analysisResult.result,
      model_used:        analysisResult.model,
      messages_analyzed: analysisResult.messagesCount,
      analyzed_at:       new Date().toISOString(),
    });

    logger.info(
      {
        conversationId,
        workspaceId,
        category:   analysisResult.result.category,
        priority:   analysisResult.result.priority,
        leadScore:  analysisResult.result.lead_score,
        sentiment:  analysisResult.result.sentiment,
      },
      'AiWorker: análise concluída e persistida',
    );
  },
  {
    connection,
    concurrency: 3,
  },
);

aiAnalysisWorker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, conversationId: job?.data?.conversationId, err },
    'AiWorker: job falhou',
  );
});

aiAnalysisWorker.on('error', (err) => {
  logger.error({ err }, 'AiWorker: erro no worker');
});
