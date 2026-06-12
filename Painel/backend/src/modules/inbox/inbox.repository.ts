import { supabaseAdmin } from '../../config/supabase';
import { logger }        from '../../utils/logger';
import {
  Conversation,
  ConversationMessage,
  ConversationStatus,
  ListConversationsQuery,
  ConversationListResult,
  Label,
  ConversationLabelMap,
  QuickReply,
  CreateLabelBody,
  UpdateLabelBody,
  CreateQuickReplyBody,
  UpdateQuickReplyBody,
  SearchMessagesQuery,
  MediaAttachment,
  MediaType,
  ConversationAiAnalysis,
  AiAnalysisResult,
  AiAnalysisStatus,
} from './inbox.types';

// ──────────────────────────────────────────────────────────────
// INBOX REPOSITORY
// Todas as queries ao banco ficam aqui.
// Nenhuma lógica de negócio — apenas acesso a dados.
// ──────────────────────────────────────────────────────────────

const PAGE_DEFAULT  = 1;
const LIMIT_DEFAULT = 30;
const LIMIT_MAX     = 100;
const MESSAGES_PER_PAGE = 50;

// ── Conversas ──────────────────────────────────────────────────

/**
 * Lista conversas de um workspace com paginação e filtros.
 * Retorna também o total de não-lidas do workspace.
 */
export async function listConversations(
  workspaceId: string,
  query:       ListConversationsQuery,
): Promise<ConversationListResult & { total: number }> {
  const page  = Math.max(1, parseInt(query.page  ?? '1',  10) || 1);
  const limit = Math.min(LIMIT_MAX, Math.max(1, parseInt(query.limit ?? String(LIMIT_DEFAULT), 10) || LIMIT_DEFAULT));
  const from  = (page - 1) * limit;
  const to    = from + limit - 1;

  let q = supabaseAdmin
    .from('conversations')
    .select(
      `id, workspace_id, contact_id, instance_id, status, priority, subject,
       channel, external_id, unread_count, last_message_at, assigned_agent_id,
       department_id, closed_at, waiting_at, created_at, updated_at,
       contact:contacts(id, name, phone),
       agent:agents!conversations_assigned_agent_id_fkey(id, display_name, user_id)`,
      { count: 'exact' },
    )
    .eq('workspace_id', workspaceId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  // ── Filtros Fase 3 ──────────────────────────────────────────

  if (query.status) {
    q = q.eq('status', query.status);
  } else {
    q = q.neq('status', 'archived');
  }
  if (query.agentId) {
    q = q.eq('assigned_agent_id', query.agentId);
  }
  if (query.departmentId) {
    q = q.eq('department_id', query.departmentId);
  }
  if (query.instanceId) {
    q = q.eq('instance_id', query.instanceId);
  }
  if (query.unreadOnly === 'true') {
    q = q.gt('unread_count', 0);
  }
  if (query.from) {
    q = q.gte('last_message_at', query.from);
  }
  if (query.to) {
    q = q.lte('last_message_at', query.to);
  }

  // Busca por nome/telefone do contato (via ilike — trigram acelera com índice)
  if (query.search?.trim()) {
    const term = `%${query.search.trim()}%`;
    // Supabase não suporta OR nativo em joins; filtramos pelos contatos que batem
    const { data: matchingContacts } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('workspace_id', workspaceId)
      .or(`name.ilike.${term},phone.ilike.${term}`);

    const contactIds = (matchingContacts ?? []).map((c: { id: string }) => c.id);
    if (contactIds.length > 0) {
      q = q.in('contact_id', contactIds);
    } else {
      // Nenhum contato encontrado → retornar vazio
      return { conversations: [], unreadTotal: 0, total: 0 };
    }
  }

  // Filtro por label (via subquery na conversation_label_map)
  if (query.labelId) {
    const { data: labeledConvs } = await supabaseAdmin
      .from('conversation_label_map')
      .select('conversation_id')
      .eq('workspace_id', workspaceId)
      .eq('label_id', query.labelId);

    const convIds = (labeledConvs ?? []).map((r: { conversation_id: string }) => r.conversation_id);
    if (convIds.length > 0) {
      q = q.in('id', convIds);
    } else {
      return { conversations: [], unreadTotal: 0, total: 0 };
    }
  }

  const { data, error, count } = await q;
  if (error) {
    logger.error({ workspaceId, error }, 'listConversations: erro Supabase');
    throw error;
  }

  // Total de não-lidas no workspace
  const { data: unreadData } = await supabaseAdmin
    .from('conversations')
    .select('unread_count')
    .eq('workspace_id', workspaceId)
    .neq('status', 'archived');

  const unreadTotal = (unreadData ?? []).reduce(
    (sum, c) => sum + (c.unread_count ?? 0),
    0,
  );

  return {
    conversations: (data ?? []) as unknown as Conversation[],
    unreadTotal,
    total: count ?? 0,
  };
}

/**
 * Busca uma única conversa pelo ID, garantindo isolamento de workspace.
 */
export async function getConversationById(
  workspaceId:    string,
  conversationId: string,
): Promise<Conversation | null> {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select(
      `id, workspace_id, contact_id, instance_id, status, priority, subject,
       channel, external_id, unread_count, last_message_at, assigned_agent_id,
       department_id, closed_at, waiting_at, created_at, updated_at,
       contact:contacts(id, name, phone),
       agent:agents!conversations_assigned_agent_id_fkey(id, display_name, user_id)`,
    )
    .eq('workspace_id', workspaceId)
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    logger.error({ conversationId, error }, 'getConversationById: erro Supabase');
    throw error;
  }
  return (data as unknown as Conversation) ?? null;
}

/**
 * Encontra conversa aberta ou em espera para um par (contact, instance).
 * Regra: uma conversa ativa por contato/instância.
 */
export async function findActiveConversation(
  workspaceId: string,
  contactId:   string,
  instanceId:  string,
): Promise<{ id: string; status: ConversationStatus } | null> {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id, status')
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)
    .eq('instance_id', instanceId)
    .in('status', ['open', 'pending', 'waiting'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ contactId, instanceId, error }, 'findActiveConversation: erro Supabase');
    throw error;
  }
  return data as { id: string; status: ConversationStatus } | null;
}

/**
 * Encontra última conversa fechada para um par (contact, instance) — para reabrir.
 */
export async function findLastClosedConversation(
  workspaceId: string,
  contactId:   string,
  instanceId:  string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)
    .eq('instance_id', instanceId)
    .eq('status', 'closed')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as { id: string } | null;
}

/**
 * Cria nova conversa.
 */
export async function createConversation(payload: {
  workspace_id: string;
  contact_id:   string;
  instance_id:  string;
  external_id?: string;
  subject?:     string;
  channel?:     string;
}): Promise<Conversation> {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .insert({
      workspace_id:  payload.workspace_id,
      contact_id:    payload.contact_id,
      instance_id:   payload.instance_id,
      external_id:   payload.external_id ?? null,
      subject:       payload.subject ?? null,
      channel:       payload.channel ?? 'whatsapp',
      status:        'open',
      unread_count:  0,
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    logger.error({ payload, error }, 'createConversation: erro Supabase');
    throw error;
  }
  return data as unknown as Conversation;
}

/**
 * Reabre conversa fechada e zera waitingAt.
 */
export async function reopenConversation(conversationId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('conversations')
    .update({ status: 'open', closed_at: null, waiting_at: null })
    .eq('id', conversationId);

  if (error) throw error;
}

/**
 * Atualiza status da conversa com timestamps corretos.
 */
export async function updateConversationStatus(
  workspaceId:    string,
  conversationId: string,
  status:         ConversationStatus,
): Promise<Conversation | null> {
  const now  = new Date().toISOString();
  const patch: Record<string, unknown> = { status };

  if (status === 'closed') {
    patch['closed_at'] = now;
  } else if (status === 'waiting') {
    patch['waiting_at'] = now;
  } else if (status === 'open') {
    patch['waiting_at'] = null;
  }

  const { data, error } = await supabaseAdmin
    .from('conversations')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .eq('id', conversationId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as Conversation) ?? null;
}

/**
 * Atribui ou desatribui um agente de uma conversa.
 */
export async function assignConversation(
  workspaceId:    string,
  conversationId: string,
  agentId:        string | null,
): Promise<Conversation | null> {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .update({ assigned_agent_id: agentId })
    .eq('workspace_id', workspaceId)
    .eq('id', conversationId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as Conversation) ?? null;
}

/**
 * Zera unread_count da conversa (marcar como lida).
 */
export async function markConversationRead(
  workspaceId:    string,
  conversationId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('workspace_id', workspaceId)
    .eq('id', conversationId);

  if (error) throw error;
}

/**
 * Incrementa atomicamente o unread_count (UPDATE SET unread_count = unread_count + 1).
 */
export async function incrementUnread(conversationId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('increment_unread_count', {
    p_conversation_id: conversationId,
  });

  if (error) {
    // Se a RPC não existir, faz fallback com update manual
    // (a RPC é criada pela migration de inbox)
    logger.warn({ conversationId, error }, 'RPC increment_unread_count falhou; usando fallback');
    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('unread_count')
      .eq('id', conversationId)
      .maybeSingle();

    const current = (conv as Record<string, number> | null)?.['unread_count'] ?? 0;
    await supabaseAdmin
      .from('conversations')
      .update({ unread_count: current + 1, last_message_at: new Date().toISOString() })
      .eq('id', conversationId);
  }
}

/**
 * Atualiza last_message_at da conversa.
 */
export async function touchConversation(
  conversationId: string,
  lastMessageAt:  string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('conversations')
    .update({ last_message_at: lastMessageAt })
    .eq('id', conversationId);

  if (error) throw error;
}

// ── Mensagens ──────────────────────────────────────────────────

/**
 * Lista mensagens de uma conversa (paginação cursor-based).
 * Retorna as mais recentes primeiro; frontend inverte para exibir.
 */
export async function listMessages(
  workspaceId:    string,
  conversationId: string,
  before?:        string, // ISO datetime cursor
  limit?:         number,
): Promise<ConversationMessage[]> {
  const take = Math.min(limit ?? MESSAGES_PER_PAGE, 100);

  let q = supabaseAdmin
    .from('conversation_messages')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('conversation_id', conversationId)
    // Fase 3: inclui is_deleted=true — frontend renderiza placeholder "mensagem removida"
    // Conteúdo já está null no DB; apenas a linha é retornada para preservar a ordem do histórico
    .order('created_at', { ascending: false })
    .limit(take);

  if (before) {
    q = q.lt('created_at', before);
  }

  const { data, error } = await q;
  if (error) {
    logger.error({ conversationId, error }, 'listMessages: erro Supabase');
    throw error;
  }
  return (data ?? []) as unknown as ConversationMessage[];
}

/**
 * Insere mensagem com idempotência via provider_message_id.
 * Se já existir (Evolution reenviou o evento), retorna a existente com isNew=false.
 * O caller DEVE usar isNew para decidir se deve incrementar unread_count,
 * evitando contagem duplicada em re-entrega de webhook.
 */
export async function insertMessage(payload: {
  workspace_id:        string;
  conversation_id:     string;
  direction:           'inbound' | 'outbound' | 'system';
  sender_id?:          string | null;
  message?:            string | null;
  status:              'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  provider_message_id?: string | null;
  reply_to_message_id?: string | null;
  metadata?:           Record<string, unknown>;
}): Promise<{ message: ConversationMessage; isNew: boolean }> {
  const { data, error } = await supabaseAdmin
    .from('conversation_messages')
    .insert({
      workspace_id:        payload.workspace_id,
      conversation_id:     payload.conversation_id,
      direction:           payload.direction,
      sender_id:           payload.sender_id ?? null,
      message:             payload.message ?? null,
      status:              payload.status,
      provider_message_id: payload.provider_message_id ?? null,
      reply_to_message_id: payload.reply_to_message_id ?? null,
      metadata:            payload.metadata ?? {},
      is_deleted:          false,
      sent_at:             payload.direction === 'outbound' ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    // Erro de constraint única = mensagem duplicada (idempotência)
    if (error.code === '23505') {
      const { data: existing } = await supabaseAdmin
        .from('conversation_messages')
        .select('*')
        .eq('provider_message_id', payload.provider_message_id ?? '')
        .eq('workspace_id', payload.workspace_id)
        .maybeSingle();
      return { message: existing as unknown as ConversationMessage, isNew: false };
    }
    logger.error({ payload, error }, 'insertMessage: erro Supabase');
    throw error;
  }

  return { message: data as unknown as ConversationMessage, isNew: true };
}

/**
 * Atualiza status de entrega/leitura de mensagem.
 */
export async function updateMessageStatus(
  workspaceId: string,
  messageId:   string,
  status:      'sent' | 'delivered' | 'read' | 'failed',
): Promise<void> {
  const now    = new Date().toISOString();
  const patch: Record<string, unknown> = { status };

  if (status === 'delivered') patch['delivered_at'] = now;
  if (status === 'read')      patch['read_at']      = now;

  const { error } = await supabaseAdmin
    .from('conversation_messages')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .eq('id', messageId);

  if (error) throw error;
}

// ── Contatos ───────────────────────────────────────────────────

/**
 * Upsert de contato por telefone.
 * Retorna o ID do contato criado ou já existente.
 */
export async function upsertContact(
  workspaceId: string,
  phone:       string,
  name?:       string | null,
): Promise<string> {
  // Normalizar: remover @s.whatsapp.net e caracteres não-numéricos finais
  const normalizedPhone = phone.replace(/@s\.whatsapp\.net$/, '').replace(/\D+$/, '');

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .upsert(
      { workspace_id: workspaceId, phone: normalizedPhone, name: name ?? null },
      { onConflict: 'workspace_id,phone', ignoreDuplicates: false },
    )
    .select('id')
    .single();

  if (error) {
    logger.error({ workspaceId, phone: normalizedPhone, error }, 'upsertContact: erro');
    throw error;
  }
  return (data as { id: string }).id;
}

/**
 * Resolve instance_id a partir do nome da instância Evolution.
 */
export async function resolveInstance(
  instanceName: string,
): Promise<{ id: string; workspace_id: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('instances')
    .select('id, workspace_id')
    .eq('name', instanceName)
    .maybeSingle();

  if (error) throw error;
  return data as { id: string; workspace_id: string } | null;
}

// ── Agentes ────────────────────────────────────────────────────

/**
 * Busca o agente vinculado a um user_id no workspace.
 */
export async function resolveAgent(
  workspaceId: string,
  userId:      string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data as { id: string } | null;
}

// ── Histórico de atribuições ────────────────────────────────────

export async function logAssignment(
  workspaceId:    string,
  conversationId: string,
  agentId:        string,
  assignedBy:     string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('conversation_assignments')
    .insert({
      workspace_id:    workspaceId,
      conversation_id: conversationId,
      agent_id:        agentId,
      assigned_by:     assignedBy,
      status:          'active',
    });

  if (error) {
    logger.warn({ conversationId, agentId, error }, 'logAssignment: falha ao registrar');
  }
}

// ── Fase 2 — Agentes, transferência e contadores ──────────────

/**
 * Resolve agente por ID (com verificação de workspace).
 */
export async function resolveAgentById(
  workspaceId: string,
  agentId:     string,
): Promise<{ id: string; display_name: string; user_id: string | null } | null> {
  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id, display_name, user_id')
    .eq('workspace_id', workspaceId)
    .eq('id', agentId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data as { id: string; display_name: string; user_id: string | null } | null;
}

/**
 * Lista todos os agentes ativos do workspace.
 */
export async function listActiveAgents(
  workspaceId: string,
): Promise<Array<{ id: string; display_name: string | null; user_id: string | null }>> {
  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id, display_name, user_id')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .order('display_name');

  if (error) {
    logger.error({ workspaceId, error }, 'listActiveAgents: erro Supabase');
    throw error;
  }
  return (data ?? []) as Array<{ id: string; display_name: string | null; user_id: string | null }>;
}

/**
 * Retorna totais de mensagens não lidas:
 *   workspaceTotal — soma de todas as conversas não arquivadas
 *   agentTotal     — soma das conversas atribuídas ao agente
 */
export async function getUnreadSummary(
  workspaceId: string,
  agentId:     string | null,
): Promise<{ workspaceTotal: number; agentTotal: number }> {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('unread_count, assigned_agent_id')
    .eq('workspace_id', workspaceId)
    .neq('status', 'archived')
    .gt('unread_count', 0);

  if (error) {
    logger.error({ workspaceId, error }, 'getUnreadSummary: erro Supabase');
    throw error;
  }

  const rows = (data ?? []) as { unread_count: number; assigned_agent_id: string | null }[];
  const workspaceTotal = rows.reduce((s, r) => s + (r.unread_count ?? 0), 0);
  const agentTotal     = agentId
    ? rows
        .filter((r) => r.assigned_agent_id === agentId)
        .reduce((s, r) => s + (r.unread_count ?? 0), 0)
    : 0;

  return { workspaceTotal, agentTotal };
}

// ── Fase 3 — Busca full-text em mensagens ─────────────────────

/**
 * Busca mensagens por texto (full-text search via tsvector).
 * Retorna mensagens com contexto da conversa.
 */
export async function searchMessages(
  workspaceId: string,
  params:      SearchMessagesQuery,
): Promise<{
  results: Array<ConversationMessage & { conversation?: { id: string; status: string } }>;
  total: number;
}> {
  const q     = params.q?.trim();
  const page  = Math.max(1, parseInt(params.page  ?? '1',  10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(params.limit ?? '20', 10) || 20));
  const from  = (page - 1) * limit;
  const to    = from + limit - 1;

  if (!q) return { results: [], total: 0 };

  // Tenta full-text search; se não houver coluna search_vector, cai em ilike
  const { data, error, count } = await supabaseAdmin
    .from('conversation_messages')
    .select('*, conversation:conversations(id, status)', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .textSearch('search_vector', q, { type: 'websearch', config: 'portuguese' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    // Fallback: ilike se a coluna search_vector não existir ainda
    if (error.code === '42703' || error.message?.includes('search_vector')) {
      const { data: fallback, count: fallbackCount } = await supabaseAdmin
        .from('conversation_messages')
        .select('*, conversation:conversations(id, status)', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .eq('is_deleted', false)
        .ilike('message', `%${q}%`)
        .order('created_at', { ascending: false })
        .range(from, to);
      return {
        results: (fallback ?? []) as unknown as Array<ConversationMessage & { conversation?: { id: string; status: string } }>,
        total: fallbackCount ?? 0,
      };
    }
    logger.error({ workspaceId, q, error }, 'searchMessages: erro Supabase');
    throw error;
  }

  return {
    results: (data ?? []) as unknown as Array<ConversationMessage & { conversation?: { id: string; status: string } }>,
    total: count ?? 0,
  };
}

// ── Fase 3 — Soft-delete ──────────────────────────────────────

/**
 * Marca mensagem como deletada (soft-delete).
 * Não apaga fisicamente; exibir "mensagem removida" no frontend.
 */
export async function softDeleteMessage(
  workspaceId: string,
  messageId:   string,
): Promise<ConversationMessage | null> {
  const { data, error } = await supabaseAdmin
    .from('conversation_messages')
    .update({ is_deleted: true, message: null })
    .eq('workspace_id', workspaceId)
    .eq('id', messageId)
    .select()
    .maybeSingle();

  if (error) {
    logger.error({ messageId, error }, 'softDeleteMessage: erro Supabase');
    throw error;
  }
  return (data as unknown as ConversationMessage) ?? null;
}

// ── Fase 3 — Labels ───────────────────────────────────────────

export async function listLabels(workspaceId: string): Promise<Label[]> {
  const { data, error } = await supabaseAdmin
    .from('labels')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('name');

  if (error) throw error;
  return (data ?? []) as unknown as Label[];
}

export async function createLabel(
  workspaceId: string,
  body:        CreateLabelBody,
): Promise<Label> {
  const { data, error } = await supabaseAdmin
    .from('labels')
    .insert({ workspace_id: workspaceId, name: body.name.trim(), color: body.color ?? '#6366f1' })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Label;
}

export async function updateLabel(
  workspaceId: string,
  labelId:     string,
  body:        UpdateLabelBody,
): Promise<Label | null> {
  const patch: Record<string, unknown> = {};
  if (body.name  !== undefined) patch['name']  = body.name.trim();
  if (body.color !== undefined) patch['color'] = body.color;

  const { data, error } = await supabaseAdmin
    .from('labels')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .eq('id', labelId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as Label) ?? null;
}

export async function deleteLabel(
  workspaceId: string,
  labelId:     string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('labels')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', labelId);

  if (error) throw error;
}

export async function getConversationLabels(
  workspaceId:    string,
  conversationId: string,
): Promise<ConversationLabelMap[]> {
  const { data, error } = await supabaseAdmin
    .from('conversation_label_map')
    .select('*, label:labels(*)')
    .eq('workspace_id', workspaceId)
    .eq('conversation_id', conversationId);

  if (error) throw error;
  return (data ?? []) as unknown as ConversationLabelMap[];
}

export async function addLabelToConversation(
  workspaceId:    string,
  conversationId: string,
  labelId:        string,
  createdBy:      string,
): Promise<ConversationLabelMap> {
  const { data, error } = await supabaseAdmin
    .from('conversation_label_map')
    .insert({ workspace_id: workspaceId, conversation_id: conversationId, label_id: labelId, created_by: createdBy })
    .select('*, label:labels(*)')
    .single();

  if (error) throw error;
  return data as unknown as ConversationLabelMap;
}

export async function removeLabelFromConversation(
  workspaceId:    string,
  conversationId: string,
  labelId:        string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('conversation_label_map')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('conversation_id', conversationId)
    .eq('label_id', labelId);

  if (error) throw error;
}

// ── Fase 3 — Quick Replies ────────────────────────────────────

export async function listQuickReplies(
  workspaceId: string,
  search?:     string,
): Promise<QuickReply[]> {
  let q = supabaseAdmin
    .from('quick_replies')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .order('shortcut');

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    q = q.or(`shortcut.ilike.${term},title.ilike.${term},body.ilike.${term}`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as QuickReply[];
}

export async function createQuickReply(
  workspaceId: string,
  body:        CreateQuickReplyBody,
  userId:      string,
): Promise<QuickReply> {
  const { data, error } = await supabaseAdmin
    .from('quick_replies')
    .insert({
      workspace_id: workspaceId,
      shortcut:     body.shortcut.trim().startsWith('/')
        ? body.shortcut.trim()
        : `/${body.shortcut.trim()}`,
      title:        body.title.trim(),
      body:         body.body,
      category:     body.category ?? null,
      created_by:   userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as QuickReply;
}

export async function updateQuickReply(
  workspaceId: string,
  replyId:     string,
  body:        UpdateQuickReplyBody,
): Promise<QuickReply | null> {
  const patch: Record<string, unknown> = {};
  if (body.shortcut  !== undefined) {
    const s = body.shortcut.trim();
    patch['shortcut'] = s.startsWith('/') ? s : `/${s}`;
  }
  if (body.title     !== undefined) patch['title']     = body.title.trim();
  if (body.body      !== undefined) patch['body']      = body.body;
  if (body.category  !== undefined) patch['category']  = body.category;
  if (body.is_active !== undefined) patch['is_active'] = body.is_active;

  const { data, error } = await supabaseAdmin
    .from('quick_replies')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .eq('id', replyId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as QuickReply) ?? null;
}

export async function deleteQuickReply(
  workspaceId: string,
  replyId:     string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('quick_replies')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', replyId);

  if (error) throw error;
}

// ── Fase 4 — Media Attachments ────────────────────────────────

export interface InsertMediaAttachmentPayload {
  workspace_id:     string;
  conversation_id:  string;
  message_id?:      string | null;
  media_type:       MediaType;
  filename:         string;
  mime_type:        string;
  size_bytes:       number;
  storage_path:     string;
  duration_seconds?: number | null;
  width?:           number | null;
  height?:          number | null;
  created_by?:      string | null;
}

/**
 * Insere um registro na tabela media_attachments.
 */
export async function insertMediaAttachment(
  payload: InsertMediaAttachmentPayload,
): Promise<MediaAttachment> {
  const { data, error } = await supabaseAdmin
    .from('media_attachments')
    .insert({
      workspace_id:     payload.workspace_id,
      conversation_id:  payload.conversation_id,
      message_id:       payload.message_id ?? null,
      media_type:       payload.media_type,
      filename:         payload.filename,
      mime_type:        payload.mime_type,
      size_bytes:       payload.size_bytes,
      storage_path:     payload.storage_path,
      duration_seconds: payload.duration_seconds ?? null,
      width:            payload.width ?? null,
      height:           payload.height ?? null,
      created_by:       payload.created_by ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as MediaAttachment;
}

/**
 * Busca um media_attachment por ID com isolamento de workspace.
 */
export async function getMediaAttachment(
  workspaceId:  string,
  attachmentId: string,
): Promise<MediaAttachment | null> {
  const { data, error } = await supabaseAdmin
    .from('media_attachments')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', attachmentId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as MediaAttachment) ?? null;
}

/**
 * Vincula um media_attachment a uma mensagem já criada.
 * Atualiza tanto media_attachments.message_id quanto
 * conversation_messages.media_attachment_id + media_type.
 */
export async function linkAttachmentToMessage(
  workspaceId:  string,
  messageId:    string,
  attachmentId: string,
  mediaType:    MediaType,
): Promise<void> {
  // Atualizar media_attachments
  const { error: e1 } = await supabaseAdmin
    .from('media_attachments')
    .update({ message_id: messageId })
    .eq('workspace_id', workspaceId)
    .eq('id', attachmentId);

  if (e1) {
    logger.warn({ e1, attachmentId, messageId }, 'linkAttachmentToMessage: falha em media_attachments');
    throw e1;
  }

  // Atualizar conversation_messages
  const { error: e2 } = await supabaseAdmin
    .from('conversation_messages')
    .update({ media_attachment_id: attachmentId, media_type: mediaType })
    .eq('workspace_id', workspaceId)
    .eq('id', messageId);

  if (e2) {
    logger.warn({ e2, messageId }, 'linkAttachmentToMessage: falha em conversation_messages');
    throw e2;
  }
}

// ── Fase 5 — IA Assistiva ────────────────────────────────────

/**
 * Cria ou reseta um registro de análise IA com status 'pending'.
 * Usa UPSERT na constraint (workspace_id, conversation_id).
 */
export async function upsertAiAnalysisPending(
  workspaceId:    string,
  conversationId: string,
): Promise<ConversationAiAnalysis> {
  const { data, error } = await supabaseAdmin
    .from('conversation_ai_analysis')
    .upsert(
      {
        workspace_id:    workspaceId,
        conversation_id: conversationId,
        status:          'pending',
        // Limpa campos de análise anterior ao reanalisar
        error_message:        null,
        category:             null,
        category_confidence:  null,
        priority:             null,
        priority_reason:      null,
        summary:              null,
        key_points:           [],
        next_action:          null,
        main_intent:          null,
        sentiment:            null,
        sentiment_score:      null,
        lead_score:           null,
        lead_score_reason:    null,
        suggestions:          [],
        model_used:           null,
        messages_analyzed:    null,
        analyzed_at:          null,
      },
      { onConflict: 'workspace_id,conversation_id' },
    )
    .select()
    .single();

  if (error || !data) {
    throw new Error(`upsertAiAnalysisPending: ${error?.message}`);
  }
  return data as ConversationAiAnalysis;
}

/**
 * Atualiza o status e (opcionalmente) os dados da análise.
 */
export async function updateAiAnalysis(
  workspaceId:    string,
  conversationId: string,
  status:         AiAnalysisStatus,
  payload?:       Partial<AiAnalysisResult> & {
    model_used?:        string;
    messages_analyzed?: number;
    error_message?:     string;
    analyzed_at?:       string;
  },
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('conversation_ai_analysis')
    .update({ status, ...payload })
    .eq('workspace_id', workspaceId)
    .eq('conversation_id', conversationId);

  if (error) {
    logger.warn({ error, conversationId, status }, 'updateAiAnalysis: falha ao atualizar');
    throw error;
  }

  // Espelhar campos rápidos em conversations para listagem eficiente
  if (payload?.category || payload?.priority || payload?.sentiment || payload?.lead_score !== undefined) {
    const convPatch: Record<string, unknown> = {};
    if (payload.category)  convPatch['ai_category']  = payload.category;
    if (payload.priority)  convPatch['ai_priority']  = payload.priority;
    if (payload.sentiment) convPatch['ai_sentiment'] = payload.sentiment;
    if (payload.lead_score !== undefined && payload.lead_score !== null) {
      convPatch['lead_score'] = payload.lead_score;
    }
    if (Object.keys(convPatch).length > 0) {
      await supabaseAdmin
        .from('conversations')
        .update(convPatch)
        .eq('workspace_id', workspaceId)
        .eq('id', conversationId);
    }
  }
}

/**
 * Retorna a análise IA de uma conversa (ou null se não existir).
 */
export async function getAiAnalysis(
  workspaceId:    string,
  conversationId: string,
): Promise<ConversationAiAnalysis | null> {
  const { data, error } = await supabaseAdmin
    .from('conversation_ai_analysis')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (error) {
    logger.warn({ error, conversationId }, 'getAiAnalysis: falha ao buscar');
    return null;
  }
  return data as ConversationAiAnalysis | null;
}

/**
 * Retorna as últimas mensagens de uma conversa para alimentar a IA.
 * Exclui mensagens deletadas e do tipo 'ai'.
 */
export async function getMessagesForAi(
  workspaceId:    string,
  conversationId: string,
  limit = 40,
): Promise<Array<{ direction: string; message: string | null }>> {
  const { data, error } = await supabaseAdmin
    .from('conversation_messages')
    .select('direction, message')
    .eq('workspace_id', workspaceId)
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .neq('direction', 'ai')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.warn({ error, conversationId }, 'getMessagesForAi: falha ao buscar mensagens');
    return [];
  }

  return ((data ?? []) as Array<{ direction: string; message: string | null }>).reverse();
}

// ── Fase 6 — SLA, Automações, Auto-atribuição ─────────────────

import {
  SlaPolicy,
  CreateSlaPolicyBody,
  UpdateSlaPolicyBody,
  AutomationRule,
  CreateAutomationRuleBody,
  UpdateAutomationRuleBody,
  InboxAlert,
  CreateAlertBody,
  AlertsQuery,
} from './inbox.types';

// ── SLA Policies ──────────────────────────────────────────────

export async function listSlaPolicies(workspaceId: string): Promise<SlaPolicy[]> {
  const { data, error } = await supabaseAdmin
    .from('sla_policies')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SlaPolicy[];
}

export async function createSlaPolicy(
  workspaceId: string,
  body:        CreateSlaPolicyBody,
  userId:      string,
): Promise<SlaPolicy> {
  // Se is_default = true, desmarcar política padrão anterior
  if (body.is_default) {
    await supabaseAdmin
      .from('sla_policies')
      .update({ is_default: false })
      .eq('workspace_id', workspaceId)
      .eq('is_default', true);
  }

  const { data, error } = await supabaseAdmin
    .from('sla_policies')
    .insert({
      workspace_id:           workspaceId,
      name:                   body.name,
      is_default:             body.is_default ?? false,
      first_response_minutes: body.first_response_minutes,
      resolution_minutes:     body.resolution_minutes,
      priority_overrides:     body.priority_overrides ?? {},
    })
    .select()
    .single();
  if (error || !data) throw new Error(`createSlaPolicy: ${error?.message}`);
  void userId; // audit log futuro
  return data as SlaPolicy;
}

export async function updateSlaPolicy(
  workspaceId: string,
  policyId:    string,
  body:        UpdateSlaPolicyBody,
): Promise<SlaPolicy> {
  if (body.is_default) {
    await supabaseAdmin
      .from('sla_policies')
      .update({ is_default: false })
      .eq('workspace_id', workspaceId)
      .eq('is_default', true);
  }

  const { data, error } = await supabaseAdmin
    .from('sla_policies')
    .update(body)
    .eq('workspace_id', workspaceId)
    .eq('id', policyId)
    .select()
    .single();
  if (error || !data) throw new Error(`updateSlaPolicy: ${error?.message}`);
  return data as SlaPolicy;
}

export async function deleteSlaPolicy(workspaceId: string, policyId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('sla_policies')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', policyId);
  if (error) throw error;
}

// ── Automation Rules ──────────────────────────────────────────

export async function listAutomationRules(
  workspaceId: string,
  triggerType?: string,
): Promise<AutomationRule[]> {
  let q = supabaseAdmin
    .from('automation_rules')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('run_order', { ascending: true });

  if (triggerType) {
    q = q.eq('trigger_type', triggerType);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AutomationRule[];
}

export async function createAutomationRule(
  workspaceId: string,
  body:        CreateAutomationRuleBody,
  userId:      string,
): Promise<AutomationRule> {
  const { data, error } = await supabaseAdmin
    .from('automation_rules')
    .insert({
      workspace_id: workspaceId,
      name:         body.name,
      is_active:    body.is_active ?? true,
      trigger_type: body.trigger_type,
      conditions:   body.conditions ?? [],
      actions:      body.actions,
      run_order:    body.run_order ?? 0,
      created_by:   userId,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`createAutomationRule: ${error?.message}`);
  return data as AutomationRule;
}

export async function updateAutomationRule(
  workspaceId: string,
  ruleId:      string,
  body:        UpdateAutomationRuleBody,
): Promise<AutomationRule> {
  const { data, error } = await supabaseAdmin
    .from('automation_rules')
    .update(body)
    .eq('workspace_id', workspaceId)
    .eq('id', ruleId)
    .select()
    .single();
  if (error || !data) throw new Error(`updateAutomationRule: ${error?.message}`);
  return data as AutomationRule;
}

export async function deleteAutomationRule(workspaceId: string, ruleId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('automation_rules')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', ruleId);
  if (error) throw error;
}

// ── Alertas ───────────────────────────────────────────────────

export async function getAlerts(
  workspaceId: string,
  query:       AlertsQuery,
): Promise<{ alerts: InboxAlert[]; total: number }> {
  const page  = Math.max(1, parseInt(query.page  ?? '1',  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '30', 10) || 30));
  const from  = (page - 1) * limit;
  const to    = from + limit - 1;

  let q = supabaseAdmin
    .from('inbox_alerts')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (query.resolved === 'true')  q = q.eq('resolved', true);
  if (query.resolved === 'false') q = q.eq('resolved', false);
  if (query.type)                 q = q.eq('alert_type', query.type);

  const { data, error, count } = await q;
  if (error) throw error;
  return { alerts: (data ?? []) as InboxAlert[], total: count ?? 0 };
}

export async function resolveAlert(workspaceId: string, alertId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('inbox_alerts')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', alertId);
  if (error) throw error;
}

export async function createAlert(workspaceId: string, body: CreateAlertBody): Promise<InboxAlert> {
  const { data, error } = await supabaseAdmin
    .from('inbox_alerts')
    .insert({
      workspace_id:    workspaceId,
      alert_type:      body.alert_type,
      severity:        body.severity ?? 'warning',
      title:           body.title,
      message:         body.message,
      metadata:        body.metadata ?? {},
      conversation_id: body.conversation_id ?? null,
      agent_id:        body.agent_id ?? null,
      instance_id:     body.instance_id ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`createAlert: ${error?.message}`);
  return data as InboxAlert;
}

// ── Auto-atribuição de conversas ──────────────────────────────

export async function getOnlineAgentsForAssignment(
  workspaceId:   string,
  departmentId?: string,
): Promise<Array<{ agent_id: string; display_name: string | null; open_count: number }>> {
  let q = supabaseAdmin
    .from('agents')
    .select('id, display_name, department_id, presence:agent_presence(status)')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  if (departmentId) q = q.eq('department_id', departmentId);

  const { data: agentsData } = await q;
  if (!agentsData || agentsData.length === 0) return [];

  // Filtrar apenas agentes com status 'online'
  type AgentRow = { id: string; display_name: string | null; presence: Array<{ status: string }> | { status: string } | null };
  const onlineAgents = (agentsData as AgentRow[]).filter((a) => {
    const p = Array.isArray(a.presence) ? a.presence[0] : a.presence;
    return p?.status === 'online';
  });

  if (onlineAgents.length === 0) return [];

  // Contar carga atual de cada agente
  const agentIds = onlineAgents.map((a) => a.id);
  const { data: openConvs } = await supabaseAdmin
    .from('conversations')
    .select('assigned_agent_id')
    .eq('workspace_id', workspaceId)
    .in('assigned_agent_id', agentIds)
    .in('status', ['open', 'pending', 'waiting']);

  const workloadMap = new Map<string, number>();
  for (const c of (openConvs ?? []) as Array<{ assigned_agent_id: string }>) {
    workloadMap.set(c.assigned_agent_id, (workloadMap.get(c.assigned_agent_id) ?? 0) + 1);
  }

  return onlineAgents.map((a) => ({
    agent_id:     a.id,
    display_name: a.display_name,
    open_count:   workloadMap.get(a.id) ?? 0,
  }));
}

export async function assignConversationToAgent(
  workspaceId:    string,
  conversationId: string,
  agentId:        string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('conversations')
    .update({ assigned_agent_id: agentId })
    .eq('workspace_id', workspaceId)
    .eq('id', conversationId);
  if (error) throw error;
}

