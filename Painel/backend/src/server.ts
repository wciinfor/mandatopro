import { buildApp }   from './app';
import { env }        from './config/env';
import { logger }     from './utils/logger';
import {
  campaignDispatchQueue,
  inboxInboundQueue,
  aiAnalysisQueue,
  notificationQueue,
  dlqQueue,
} from './jobs/queue';

// ──────────────────────────────────────────────────────────────
// BOOTSTRAP DO SERVIDOR — Fase 7
//
// Graceful shutdown melhorado:
//   1. Para de aceitar novas requisições (fastify.close)
//   2. Fecha as conexões com as filas BullMQ
//   3. Aguarda dreno antes de encerrar o processo
// ──────────────────────────────────────────────────────────────

const SHUTDOWN_TIMEOUT_MS = 15_000; // máximo de 15s para drenar conexões

async function bootstrap() {
  const app = await buildApp();

  try {
    const address = await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(
      { address, env: env.NODE_ENV, pid: process.pid },
      '🚀 Disparo Pro API iniciada',
    );
  } catch (err) {
    logger.fatal({ err }, 'Falha crítica ao iniciar o servidor');
    process.exit(1);
  }

  // ── Graceful shutdown ────────────────────────────────────────
  let _shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (_shuttingDown) return;
    _shuttingDown = true;

    logger.info({ signal }, 'Encerrando servidor graciosamente...');

    // Timer de segurança: força saída após SHUTDOWN_TIMEOUT_MS
    const forceExit = setTimeout(() => {
      logger.error('Shutdown forçado: tempo limite excedido');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    try {
      // 1. Para de aceitar novas requisições; aguarda em-andamento
      await app.close();
      logger.info('HTTP: servidor fechado');

      // 2. Fechar conexões das filas BullMQ graciosamente
      await Promise.allSettled([
        campaignDispatchQueue.close(),
        inboxInboundQueue.close(),
        aiAnalysisQueue.close(),
        notificationQueue.close(),
        dlqQueue.close(),
      ]);
      logger.info('BullMQ: filas fechadas');

      clearTimeout(forceExit);
      logger.info('Servidor encerrado com sucesso');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Erro durante graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT',  () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('uncaughtException',  (err) => {
    logger.fatal({ err }, 'uncaughtException — encerrando processo');
    process.exit(1);
  });
  process.on('unhandledRejection', (err) => {
    logger.fatal({ err }, 'unhandledRejection — encerrando processo');
    process.exit(1);
  });
}

void bootstrap();
