import { FastifyReply, FastifyRequest } from 'fastify';
import { supabaseAdmin } from '../config/supabase';
import { ForbiddenException } from '../utils/errors';
import { WorkspaceRole } from '../types/api.types';

// ──────────────────────────────────────────────────────────────
// MIDDLEWARE DE CONTEXTO DE WORKSPACE
//
// Executado APÓS verifyAuth. Resolve o workspaceId de:
//   1. :workspaceId na URL  (prioridade)
//   2. Header x-workspace-id (fallback para APIs internas)
//
// Valida que o usuário autenticado é membro ativo do workspace
// e injeta seu papel (role) no contexto.
// ──────────────────────────────────────────────────────────────

export async function verifyWorkspace(
  request: FastifyRequest,
  _reply:  FastifyReply,
): Promise<void> {
  const params      = request.params as Record<string, string>;
  const workspaceId = params['workspaceId']
    ?? (request.headers['x-workspace-id'] as string | undefined);

  if (!workspaceId) {
    throw new ForbiddenException('workspaceId não informado na URL ou no header x-workspace-id');
  }

  const { data, error } = await supabaseAdmin
    .from('workspace_members')
    .select('role, status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', request.workspaceCtx.userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) {
    throw new ForbiddenException('Sem acesso a este workspace ou workspace inexistente');
  }

  request.workspaceCtx.workspaceId = workspaceId;
  request.workspaceCtx.role        = data.role as WorkspaceRole;
}
