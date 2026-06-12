// ──────────────────────────────────────────────────────────────
// PONTO DE ENTRADA DOS WORKERS — Fase 7
//
// Executar separadamente: npm run workers
// Cada worker importado se registra automaticamente.
//
// Fase 7: graceful shutdown que fecha todos os workers antes
// de encerrar o processo para evitar jobs corrompidos.
// ──────────────────────────────────────────────────────────────

import '../../config/env';         // valida env antes de tudo

import { inboxInboundWorker }   from './inbox.worker';
import { aiAnalysisWorker }     from './ai.worker';
import { slaCheckWorker }       from './sla.worker';
import { dlqWorker }            from './dlq.worker';
// import { campaignWorker }    from './campaign.worker';  // importado indiretamente abaixo
import './campaign.worker';
import './sla.worker';             // SLA check recorrente (inbox:sla-check) — Fase 6
import './dlq.worker';             // Dead-Letter Queue — Fase 7
// import './warmup.worker';       // TODO
// import './notification.worker'; // TODO

import { logger } from '../../utils/logger';

// Registrar todos os workers para shutdown
const ALL_WORKERS = [
  inboxInboundWorker,
  aiAnalysisWorker,
  slaCheckWorker,
  dlqWorker,
];

logger.info({ workers: ALL_WORKERS.length }, 'Workers iniciados');

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Workers: iniciando graceful shutdown...');

  const results = await Promise.allSettled(
    ALL_WORKERS.map((w) => w.close()),
  );

  for (const r of results) {
    if (r.status === 'rejected') {
      logger.warn({ err: r.reason }, 'Workers: erro ao fechar worker');
    }
  }

  logger.info('Workers: todos encerrados. Saindo.');
  process.exit(0);
}

process.on('SIGINT',  () => void gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));

process.on('uncaughtException',  (err) => {
  logger.fatal({ err }, 'Workers: uncaughtException');
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'Workers: unhandledRejection');
  process.exit(1);
});
