import { FastifyReply, FastifyRequest } from 'fastify';
import { supabaseAdmin } from '../config/supabase';
import { UnauthorizedException } from '../utils/errors';
import { WorkspaceRole } from '../types/api.types';

// ──────────────────────────────────────────────────────────────
// MIDDLEWARE DE AUTENTICAÇÃO
//
// Fluxo:
//   1. Extrai Bearer token do header Authorization
//   2. Valida com supabaseAdmin.auth.getUser (verifica sessão ativa)
//   3. Popula request.workspaceCtx.userId e email
//
// O workspaceId e role são preenchidos pelo verifyWorkspace,
// que deve ser executado DEPOIS deste hook.
// ──────────────────────────────────────────────────────────────

export async function verifyAuth(
  request: FastifyRequest,
  _reply:  FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedException('Token Bearer ausente no header Authorization');
  }

  const token = authHeader.slice(7);

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new UnauthorizedException('Token inválido ou sessão expirada');
  }

  // Inicializa o contexto — workspaceId/role preenchidos pelo próximo middleware
  request.workspaceCtx = {
    userId:      data.user.id,
    workspaceId: '',
    role:        'operator' as WorkspaceRole,
    email:       data.user.email,
  };
}
