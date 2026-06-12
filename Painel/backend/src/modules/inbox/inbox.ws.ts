import { FastifyInstance } from 'fastify';
import { supabaseAdmin }   from '../../config/supabase';
import { logger }          from '../../utils/logger';
import * as presence       from './inbox.presence';
import type { WsClient, PresenceStatus } from './inbox.presence';

// ──────────────────────────────────────────────────────────────
// INBOX WEBSOCKET HANDLER (Fase 2)
//
// Rota: GET /ws/inbox (upgrade para WebSocket)
//
// Protocolo (JSON):
//   Cliente → Servidor:
//     { type: 'auth', token: string, workspaceId: string }
//     { type: 'typing:start', conversationId: string }
//     { type: 'typing:stop',  conversationId: string }
//     { type: 'presence:update', status: 'online'|'offline'|'busy'|'away'|'dnd' }
//     { type: 'ping' }
//
//   Servidor → Cliente:
//     { type: 'auth:ok', agentId: string | null }
//     { type: 'presence:snapshot', agents: [...] }   ← enviado após auth:ok
//     { type: 'presence:changed', agentId, name, status }
//     { type: 'typing:start', conversationId, agentId, agentName }
//     { type: 'typing:stop',  conversationId, agentId }
//     { type: 'pong' }
//     { type: 'error', message: string }
//
// Segurança:
//   • JWT validado via supabaseAdmin.auth.getUser
//   • Isolamento: cada mensagem é processada no contexto do workspace
//     validado na autenticação — sem cross-workspace possível
//   • Timeout de 8s se o cliente não enviar 'auth'
// ──────────────────────────────────────────────────────────────

const AUTH_TIMEOUT_MS    = 8_000;
const VALID_STATUSES: PresenceStatus[] = ['online', 'offline', 'busy', 'away', 'dnd'];

type ClientMsg =
  | { type: 'auth';            token: string; workspaceId: string }
  | { type: 'typing:start';    conversationId: string }
  | { type: 'typing:stop';     conversationId: string }
  | { type: 'presence:update'; status: PresenceStatus }
  | { type: 'ping' };

function send(ws: WsClient, msg: Record<string, unknown>): void {
  try { ws.send(JSON.stringify(msg)); } catch { /* socket pode já estar fechado */ }
}

export async function inboxWsRoutes(fastify: FastifyInstance): Promise<void> {

  fastify.get('/ws/inbox', { websocket: true }, (socket, request) => {
    const ws = socket as unknown as WsClient;

    let authenticated = false;
    let clientUserId  = '';
    let clientWid     = '';
    let clientAgentId: string | null = null;
    let clientName    = '';

    // ── Timeout de autenticação ────────────────────────────────
    const authTimer = setTimeout(() => {
      if (!authenticated) {
        send(ws, { type: 'error', message: 'Tempo de autenticação expirado' });
        ws.close(4001, 'auth_timeout');
      }
    }, AUTH_TIMEOUT_MS);

    ws.on('message', async (rawMsg: unknown) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(rawMsg)) as ClientMsg;
      } catch {
        send(ws, { type: 'error', message: 'Mensagem inválida (JSON esperado)' });
        return;
      }

      // ── Autenticação ─────────────────────────────────────────
      if (msg.type === 'auth') {
        clearTimeout(authTimer);

        if (!msg.token?.trim() || !msg.workspaceId?.trim()) {
          send(ws, { type: 'error', message: 'Campos "token" e "workspaceId" obrigatórios' });
          ws.close(4002, 'invalid_auth_payload');
          return;
        }

        // 1. Validar JWT
        const { data: authData, error: authErr } =
          await supabaseAdmin.auth.getUser(msg.token);

        if (authErr || !authData.user) {
          send(ws, { type: 'error', message: 'Token inválido ou sessão expirada' });
          ws.close(4003, 'invalid_token');
          return;
        }

        const userId = authData.user.id;

        // 2. Validar membership no workspace
        const { data: member } = await supabaseAdmin
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', msg.workspaceId)
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle();

        if (!member) {
          send(ws, { type: 'error', message: 'Acesso negado ao workspace' });
          ws.close(4004, 'workspace_denied');
          return;
        }

        // 3. Resolver perfil de agente (pode ser null para admins sem perfil de agente)
        const { data: agentRow } = await supabaseAdmin
          .from('agents')
          .select('id, display_name')
          .eq('workspace_id', msg.workspaceId)
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle() as { data: { id: string; display_name: string } | null };

        clientAgentId = agentRow?.id ?? null;
        clientName    = agentRow?.display_name ?? authData.user.email ?? 'Usuário';
        clientUserId  = userId;
        clientWid     = msg.workspaceId;
        authenticated = true;

        // 4. Registrar no registry de presença
        presence.registerClient({
          ws,
          userId,
          workspaceId: msg.workspaceId,
          agentId:     clientAgentId,
          agentName:   clientName,
          status:      'online',
        });

        // 5. Confirmar auth + snapshot atual de presença
        send(ws, { type: 'auth:ok', agentId: clientAgentId });
        send(ws, {
          type:   'presence:snapshot',
          agents: presence.getPresenceSnapshot(msg.workspaceId),
        });

        // 6. Broadcast "este agente entrou" para os demais
        presence.broadcastToWorkspace(msg.workspaceId, {
          type:    'presence:changed',
          agentId: clientAgentId ?? userId,
          name:    clientName,
          status:  'online',
        }, userId);

        logger.debug(
          { userId, workspaceId: msg.workspaceId, agentName: clientName },
          'InboxWS: cliente autenticado',
        );
        return;
      }

      // Rejeitar mensagens antes de autenticação
      if (!authenticated) {
        send(ws, { type: 'error', message: 'Não autenticado — envie primeiro { type: "auth" }' });
        return;
      }

      // ── Typing start ─────────────────────────────────────────
      if (msg.type === 'typing:start') {
        const { conversationId } = msg;
        if (!conversationId?.trim()) return;

        const id = clientAgentId ?? clientUserId;
        presence.setTyping(conversationId, id, clientName, clientWid);

        presence.broadcastToWorkspace(clientWid, {
          type: 'typing:start',
          conversationId,
          agentId:   id,
          agentName: clientName,
        }, clientUserId);
        return;
      }

      // ── Typing stop ──────────────────────────────────────────
      if (msg.type === 'typing:stop') {
        const { conversationId } = msg;
        if (!conversationId?.trim()) return;

        const id = clientAgentId ?? clientUserId;
        presence.clearTyping(conversationId, id);

        presence.broadcastToWorkspace(clientWid, {
          type: 'typing:stop',
          conversationId,
          agentId: id,
        }, clientUserId);
        return;
      }

      // ── Presence update ──────────────────────────────────────
      if (msg.type === 'presence:update') {
        if (!VALID_STATUSES.includes(msg.status)) {
          send(ws, { type: 'error', message: `Status inválido. Permitidos: ${VALID_STATUSES.join(', ')}` });
          return;
        }

        presence.updateClientStatus(clientUserId, clientWid, msg.status);

        // Persistir no banco (Supabase Realtime propaga para outros clientes)
        await supabaseAdmin
          .from('agent_status')
          .upsert(
            { user_id: clientUserId, status: msg.status, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' },
          );

        // Broadcast WS para clientes do mesmo workspace
        presence.broadcastToWorkspace(clientWid, {
          type:    'presence:changed',
          agentId: clientAgentId ?? clientUserId,
          name:    clientName,
          status:  msg.status,
        }, clientUserId);
        return;
      }

      // ── Ping / pong ──────────────────────────────────────────
      if (msg.type === 'ping') {
        send(ws, { type: 'pong' });
      }
    });

    ws.on('close', async () => {
      clearTimeout(authTimer);
      if (!authenticated) return;

      // Limpar typing de todas as conversas deste agente
      const id = clientAgentId ?? clientUserId;
      presence.clearAllTypingForAgent(id, clientWid);

      // Remover do registry
      presence.removeClient(clientUserId, clientWid);

      // Persistir offline no banco
      await presence.persistOfflineStatus(clientUserId);

      // Broadcast "este agente saiu"
      presence.broadcastToWorkspace(clientWid, {
        type:    'presence:changed',
        agentId: id,
        name:    clientName,
        status:  'offline',
      });

      logger.debug(
        { userId: clientUserId, workspaceId: clientWid },
        'InboxWS: cliente desconectado',
      );
    });

    ws.on('error', (err: unknown) => {
      logger.warn({ userId: clientUserId, err }, 'InboxWS: erro no socket do cliente');
    });
  });
}
