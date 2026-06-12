import { FastifyInstance } from 'fastify';
import { healthRoutes }   from './routes/health.routes';
import { authRoutes }     from './routes/auth.routes';
import { instanceRoutes } from './routes/instances.routes';
import { campaignRoutes } from './routes/campaigns.routes';
import { webhookRoutes }  from './routes/webhooks.routes';
import { metricsRoutes }  from './routes/metrics.routes';
import { inboxRoutes }    from '../modules/inbox/inbox.routes';

// ──────────────────────────────────────────────────────────────
// REGISTRO CENTRALIZADO DE ROTAS
//
// Mapa de URLs:
//   GET    /health
//   GET    /health/detailed
//   POST   /auth/signup
//   POST   /auth/signin
//   POST   /auth/refresh
//   GET    /auth/me                                ← auth
//   POST   /auth/signout                           ← auth
//   POST   /webhooks/evolution                     ← público
//   POST   /webhooks/asaas                         ← público
//
//   (prefixo /api/v1)
//   GET    /api/v1/workspaces/:wid/instances        ← auth + workspace
//   POST   /api/v1/workspaces/:wid/instances        ← admin
//   GET    /api/v1/workspaces/:wid/instances/:id    ← auth + workspace
//   PATCH  /api/v1/workspaces/:wid/instances/:id    ← admin
//   GET    /api/v1/workspaces/:wid/instances/:id/qrcode   ← admin
//   DELETE /api/v1/workspaces/:wid/instances/:id/logout   ← admin
//
//   GET    /api/v1/workspaces/:wid/campaigns        ← agent
//   POST   /api/v1/workspaces/:wid/campaigns        ← admin
//   GET    /api/v1/workspaces/:wid/campaigns/:id    ← agent
//   POST   /api/v1/workspaces/:wid/campaigns/:id/messages  ← admin
//   POST   /api/v1/workspaces/:wid/campaigns/:id/contacts  ← admin
//   POST   /api/v1/workspaces/:wid/campaigns/:id/start     ← admin
//   POST   /api/v1/workspaces/:wid/campaigns/:id/pause     ← admin
//
//   TODO (próximas sprints — marcar na issue):
//   /api/v1/workspaces/:wid/contacts
//   /api/v1/workspaces/:wid/inbox
//   /api/v1/workspaces/:wid/billing
//   /api/v1/workspaces/:wid/agents
//   /api/v1/workspaces/:wid/ai
//   /api/v1/workspaces/:wid/reports
//   /api/v1/workspaces/:wid/settings
// ──────────────────────────────────────────────────────────────

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Rotas sem prefixo
  await fastify.register(healthRoutes);
  await fastify.register(metricsRoutes);
  await fastify.register(authRoutes,    { prefix: '/auth' });
  await fastify.register(webhookRoutes, { prefix: '/webhooks' });

  // Rotas da API (versionadas)
  await fastify.register(
    async (api) => {
      await api.register(instanceRoutes, {
        prefix: '/workspaces/:workspaceId/instances',
      });
      await api.register(campaignRoutes, {
        prefix: '/workspaces/:workspaceId/campaigns',
      });
      await api.register(inboxRoutes, {
        prefix: '/workspaces/:workspaceId/inbox',
      });
    },
    { prefix: '/api/v1' },
  );
}
