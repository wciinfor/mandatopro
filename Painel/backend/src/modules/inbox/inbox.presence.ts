import { supabaseAdmin } from '../../config/supabase';
import { logger }        from '../../utils/logger';
import type { AgentPresence } from './inbox.types';

// ──────────────────────────────────────────────────────────────
// INBOX PRESENCE MANAGER
//
// Estado EFÊMERO em memória — reiniciar o processo limpa tudo.
// Gerencia:
//   • Registry de conexões WebSocket ativas (por workspace)
//   • Indicadores de digitação com TTL automático
//   • Helpers de broadcast para clientes do mesmo workspace
//
// Workers BullMQ rodam em processo separado e NÃO compartilham
// este estado. Realtime Supabase entrega mudanças persistidas.
// ──────────────────────────────────────────────────────────────

export type PresenceStatus = AgentPresence;

// Interface mínima do socket (cast compatível com @fastify/websocket v8)
export type WsClient = {
  send:       (data: string) => void;
  on:         (event: string, cb: (...args: unknown[]) => void) => void;
  close:      (code?: number, reason?: string) => void;
  readyState?: number;
};

export interface ClientInfo {
  ws:          WsClient;
  userId:      string;
  workspaceId: string;
  agentId:     string | null;
  agentName:   string;
  status:      PresenceStatus;
}

// workspaceId → Map<userId, ClientInfo>
const registry = new Map<string, Map<string, ClientInfo>>();

// conversationId → Map<agentId, { name, timer }>
const typingState = new Map<
  string,
  Map<string, { name: string; timer: ReturnType<typeof setTimeout> }>
>();

const TYPING_TTL_MS = 5_000; // auto-clear se o cliente não enviar typing:stop

// ── Registry ──────────────────────────────────────────────────

export function registerClient(info: ClientInfo): void {
  if (!registry.has(info.workspaceId)) {
    registry.set(info.workspaceId, new Map());
  }
  registry.get(info.workspaceId)!.set(info.userId, info);
}

export function removeClient(
  userId:      string,
  workspaceId: string,
): ClientInfo | undefined {
  const wsMap = registry.get(workspaceId);
  if (!wsMap) return undefined;
  const info = wsMap.get(userId);
  wsMap.delete(userId);
  if (wsMap.size === 0) registry.delete(workspaceId);
  return info;
}

export function getWorkspaceClients(workspaceId: string): ClientInfo[] {
  return Array.from(registry.get(workspaceId)?.values() ?? []);
}

export function findClient(
  userId:      string,
  workspaceId: string,
): ClientInfo | undefined {
  return registry.get(workspaceId)?.get(userId);
}

export function updateClientStatus(
  userId:      string,
  workspaceId: string,
  status:      PresenceStatus,
): void {
  const info = findClient(userId, workspaceId);
  if (info) info.status = status;
}

// ── Broadcast ─────────────────────────────────────────────────

export function broadcastToWorkspace(
  workspaceId:    string,
  message:        Record<string, unknown>,
  excludeUserId?: string,
): void {
  const clients = getWorkspaceClients(workspaceId);
  const json    = JSON.stringify(message);
  // Coletar IDs de clientes mortos para remover após o loop
  const deadUserIds: string[] = [];

  for (const client of clients) {
    if (client.userId === excludeUserId) continue;
    try {
      client.ws.send(json);
    } catch (err) {
      logger.warn(
        { userId: client.userId, err },
        'InboxPresence: broadcast falhou para cliente — removendo do registry',
      );
      deadUserIds.push(client.userId);
    }
  }

  // Limpar clientes cujo socket está morto
  for (const uid of deadUserIds) {
    removeClient(uid, workspaceId);
  }
}

export function sendToClient(
  workspaceId: string,
  userId:      string,
  message:     Record<string, unknown>,
): void {
  const client = findClient(userId, workspaceId);
  if (!client) return;
  try {
    client.ws.send(JSON.stringify(message));
  } catch (err) {
    logger.warn({ userId, err }, 'InboxPresence: envio direto falhou');
  }
}

// ── Presence snapshot ─────────────────────────────────────────

export function getPresenceSnapshot(
  workspaceId: string,
): Array<{ agentId: string | null; name: string; status: PresenceStatus }> {
  return getWorkspaceClients(workspaceId).map((c) => ({
    agentId: c.agentId,
    name:    c.agentName,
    status:  c.status,
  }));
}

// ── Typing ────────────────────────────────────────────────────

/**
 * Registra agente como "digitando" em uma conversa.
 * Auto-cancela após TYPING_TTL_MS e emite typing:stop para o workspace.
 */
export function setTyping(
  conversationId: string,
  agentId:        string,
  agentName:      string,
  workspaceId:    string,
): void {
  if (!typingState.has(conversationId)) {
    typingState.set(conversationId, new Map());
  }
  const convMap = typingState.get(conversationId)!;

  // Cancelar TTL anterior deste agente
  const existing = convMap.get(agentId);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    clearTyping(conversationId, agentId);
    // Broadcast auto-stop por TTL
    broadcastToWorkspace(workspaceId, {
      type: 'typing:stop',
      conversationId,
      agentId,
    });
  }, TYPING_TTL_MS);

  convMap.set(agentId, { name: agentName, timer });
}

export function clearTyping(conversationId: string, agentId: string): void {
  const convMap = typingState.get(conversationId);
  if (!convMap) return;
  const existing = convMap.get(agentId);
  if (existing) {
    clearTimeout(existing.timer);
    convMap.delete(agentId);
  }
  if (convMap.size === 0) typingState.delete(conversationId);
}

/**
 * Remove todos os estados de typing de um agente (usado no disconnect).
 */
export function clearAllTypingForAgent(agentId: string, workspaceId: string): void {
  for (const [conversationId, convMap] of typingState) {
    if (convMap.has(agentId)) {
      clearTyping(conversationId, agentId);
      broadcastToWorkspace(workspaceId, {
        type: 'typing:stop',
        conversationId,
        agentId,
      });
    }
  }
}

// ── DB helpers ────────────────────────────────────────────────

export async function persistOfflineStatus(userId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('agent_status')
      .upsert(
        { user_id: userId, status: 'offline', updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
  } catch (err) {
    logger.warn({ userId, err }, 'InboxPresence: falha ao persistir status offline');
  }
}
