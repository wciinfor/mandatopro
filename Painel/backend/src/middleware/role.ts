import { FastifyReply, FastifyRequest } from 'fastify';
import { ForbiddenException } from '../utils/errors';
import { WorkspaceRole, ROLE_HIERARCHY } from '../types/api.types';

// ──────────────────────────────────────────────────────────────
// MIDDLEWARE DE CONTROLE DE PAPEL (RBAC)
//
// Uso nas rotas:
//   { preHandler: [verifyAuth, verifyWorkspace, requireMinRole('admin')] }
//
// A lógica é aditiva: um papel mais alto inclui os menores.
//   owner >= admin >= agent >= operator
// ──────────────────────────────────────────────────────────────

/**
 * Exige que o usuário tenha pelo menos o papel mínimo informado.
 * Exemplo: requireMinRole('admin') → permite owner e admin.
 */
export function requireMinRole(minRole: WorkspaceRole) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const userRole = request.workspaceCtx?.role;

    if (!userRole || ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[minRole]) {
      throw new ForbiddenException(
        `Papel insuficiente. Mínimo requerido: "${minRole}". Papel atual: "${userRole ?? 'nenhum'}".`,
      );
    }
  };
}

/**
 * Exige que o usuário tenha exatamente um dos papéis listados.
 * Não considera hierarquia — útil para restrições específicas.
 * Exemplo: requireRole('owner', 'admin') → permite apenas owner ou admin.
 */
export function requireRole(...roles: WorkspaceRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const userRole = request.workspaceCtx?.role;

    if (!userRole || !roles.includes(userRole)) {
      throw new ForbiddenException(
        `Papel não autorizado. Requerido: ${roles.map((r) => `"${r}"`).join(' ou ')}. Atual: "${userRole ?? 'nenhum'}".`,
      );
    }
  };
}
