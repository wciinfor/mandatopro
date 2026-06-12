// Augmentação dos tipos do Fastify para adicionar propriedades
// customizadas ao objeto FastifyRequest em toda a aplicação.
// Este arquivo é automaticamente incluído pelo tsconfig ("src/**/*").

import { WorkspaceContext } from './api.types';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Contexto do workspace corrente.
     * Preenchido sequencialmente pelos middlewares:
     *   1. verifyAuth → userId, email
     *   2. verifyWorkspace → workspaceId, role
     */
    workspaceCtx: WorkspaceContext;
  }
}
