import { logger } from '../../utils/logger';
import {
  NotFoundException,
  ValidationException,
  ForbiddenException,
} from '../../utils/errors';
import {
  Conversation,
  ConversationMessage,
  ConversationStatus,
  ConversationListResult,
  ListConversationsQuery,
  SendMessageBody,
  AssignBody,
  TransferBody,
  UnreadSummary,
  AgentListItem,
  Label,
  ConversationLabelMap,
  QuickReply,
  CreateLabelBody,
  UpdateLabelBody,
  AddLabelBody,
  CreateQuickReplyBody,
  UpdateQuickReplyBody,
  SearchMessagesQuery,
  MediaAttachment,
  MediaUploadResult,
  SendMediaBody,
  ConversationAiAnalysis,
} from './inbox.types';
import * as repo from './inbox.repository';
import { InboxMessageSender } from './inbox-message.sender';
import { InboxMediaSender }   from './inbox-message.sender';
import { enqueueAiAnalysis }  from '../../jobs/queue';
import { recordFirstResponse } from './inbox.sla';

// ──────────────────────────────────────────────────────────────
// INBOX SERVICE
// Orquestração de negócio: não acessa banco diretamente,
// delega ao repository e coordena as operações complexas.
// ──────────────────────────────────────────────────────────────

// ── Conversas ──────────────────────────────────────────────────

export async function listConversations(
  workspaceId: string,
  query:       ListConversationsQuery,
): Promise<ConversationListResult & { total: number }> {
  return repo.listConversations(workspaceId, query);
}

export async function getConversation(
  workspaceId:    string,
  conversationId: string,
): Promise<{ conversation: Conversation; messages: ConversationMessage[] }> {
  const conversation = await repo.getConversationById(workspaceId, conversationId);
  if (!conversation) throw new NotFoundException('Conversa');

  // Retorna as últimas 50 mensagens junto da conversa
  const messages = await repo.listMessages(workspaceId, conversationId, undefined, 50);

  return { conversation, messages: messages.reverse() }; // ordem cronológica
}

export async function getMessages(
  workspaceId:    string,
  conversationId: string,
  before?:        string,
  limit?:         number,
): Promise<ConversationMessage[]> {
  const conv = await repo.getConversationById(workspaceId, conversationId);
  if (!conv) throw new NotFoundException('Conversa');

  const msgs = await repo.listMessages(workspaceId, conversationId, before, limit);
  return msgs.reverse(); // cronológico
}

/**
 * Envia mensagem outbound pelo agente.
 * Persiste → chama Evolution → atualiza status.
 */
export async function sendMessage(
  workspaceId:    string,
  conversationId: string,
  userId:         string,
  body:           SendMessageBody,
): Promise<ConversationMessage> {
  if (!body.text?.trim()) {
    throw new ValidationException({ text: ['Mensagem não pode ser vazia'] });
  }

  const conv = await repo.getConversationById(workspaceId, conversationId);
  if (!conv) throw new NotFoundException('Conversa');
  if (conv.status === 'closed' || conv.status === 'archived') {
    throw new ForbiddenException('Não é possível enviar mensagem em conversa fechada ou arquivada.');
  }
  if (!conv.instance_id) {
    throw new ValidationException({ instance: ['Conversa sem instância associada'] });
  }
  if (!conv.contact_id) {
    throw new ValidationException({ contact: ['Conversa sem contato associado'] });
  }

  // Busca agente para preencher sender_id
  const agent = await repo.resolveAgent(workspaceId, userId);

  // Fase 3 — validar reply_to_message_id: deve pertencer à mesma conversa
  if (body.reply_to_message_id) {
    const { supabaseAdmin } = await import('../../config/supabase');
    const { data: refMsg } = await supabaseAdmin
      .from('conversation_messages')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('conversation_id', conversationId)
      .eq('id', body.reply_to_message_id)
      .maybeSingle();

    if (!refMsg) {
      throw new ValidationException({
        reply_to_message_id: ['Mensagem referenciada não encontrada nesta conversa'],
      });
    }
  }

  const sender = new InboxMessageSender();
  const message = await sender.send({
    workspaceId,
    conversationId,
    instanceId:         conv.instance_id,
    contactId:          conv.contact_id,
    senderId:           agent?.id ?? null,
    text:               body.text.trim(),
    replyToMessageId:   body.reply_to_message_id,
  });

  // Fase 6 — SLA: registrar primeira resposta do agente (fire-and-forget)
  recordFirstResponse(workspaceId, conversationId).catch(() => {});

  return message;
}

/**
 * Atualiza status da conversa.
 * Regras: não permite 'archived' via API de agente (apenas admin).
 */
export async function updateStatus(
  workspaceId:    string,
  conversationId: string,
  status:         ConversationStatus,
  userRole:       string,
): Promise<Conversation> {
  if (status === 'archived' && userRole === 'operator') {
    throw new ForbiddenException('Operadores não podem arquivar conversas.');
  }

  const conv = await repo.getConversationById(workspaceId, conversationId);
  if (!conv) throw new NotFoundException('Conversa');

  const updated = await repo.updateConversationStatus(workspaceId, conversationId, status);
  if (!updated) throw new NotFoundException('Conversa');

  logger.info({ conversationId, status, workspaceId }, 'Inbox: status de conversa atualizado');
  return updated;
}

/**
 * Atribui agente à conversa.
 * agentId === null → desatribui.
 */
export async function assignConversation(
  workspaceId:    string,
  conversationId: string,
  assignBody:     AssignBody,
  assignedByUserId: string,
): Promise<Conversation> {
  const conv = await repo.getConversationById(workspaceId, conversationId);
  if (!conv) throw new NotFoundException('Conversa');

  const updated = await repo.assignConversation(workspaceId, conversationId, assignBody.agentId);
  if (!updated) throw new NotFoundException('Conversa');

  // Registrar no histórico de atribuições (somente quando atribui — não desatribui)
  if (assignBody.agentId) {
    await repo.logAssignment(workspaceId, conversationId, assignBody.agentId, assignedByUserId);
  }

  logger.info(
    { conversationId, agentId: assignBody.agentId, workspaceId },
    'Inbox: conversa atribuída',
  );
  return updated;
}

/**
 * Marca conversa como lida (zera unread_count).
 */
export async function markRead(
  workspaceId:    string,
  conversationId: string,
): Promise<void> {
  const conv = await repo.getConversationById(workspaceId, conversationId);
  if (!conv) throw new NotFoundException('Conversa');

  await repo.markConversationRead(workspaceId, conversationId);
}

/**
 * Atalho: atribui a conversa ao próprio agente chamador.
 */
export async function assignToMe(
  workspaceId:    string,
  conversationId: string,
  userId:         string,
): Promise<Conversation> {
  const agent = await repo.resolveAgent(workspaceId, userId);
  if (!agent) {
    throw new NotFoundException('Perfil de agente para este usuário');
  }
  return assignConversation(
    workspaceId,
    conversationId,
    { agentId: agent.id },
    userId,
  );
}

// ── Fase 2 — Transferência, unread summary e listagem de agentes ──

/**
 * Transfere uma conversa para outro agente (ou desatribui se toAgentId = null).
 * Qualquer agente ativo pode transferir.
 * Registra histórico e insere mensagem de sistema.
 */
export async function transferConversation(
  workspaceId:    string,
  conversationId: string,
  body:           TransferBody,
  fromUserId:     string,
): Promise<Conversation> {
  const conv = await repo.getConversationById(workspaceId, conversationId);
  if (!conv) throw new NotFoundException('Conversa');

  // Validar agente destino (se informado)
  let toName = 'sem atribuição';
  if (body.toAgentId) {
    const toAgent = await repo.resolveAgentById(workspaceId, body.toAgentId);
    if (!toAgent) {
      throw new NotFoundException('Agente destino não encontrado neste workspace');
    }
    toName = toAgent.display_name ?? 'Agente';
  }

  // Nome do agente de origem
  const fromAgentRef = await repo.resolveAgent(workspaceId, fromUserId);
  let fromName = 'Agente';
  if (fromAgentRef) {
    const fromAgentRow = await repo.resolveAgentById(workspaceId, fromAgentRef.id);
    fromName = fromAgentRow?.display_name ?? 'Agente';
  }

  // Atualizar atribuição
  const updated = await repo.assignConversation(workspaceId, conversationId, body.toAgentId);
  if (!updated) throw new NotFoundException('Conversa');

  // Registrar no histórico de atribuições
  if (body.toAgentId) {
    await repo.logAssignment(workspaceId, conversationId, body.toAgentId, fromUserId);
  }

  // Mensagem de sistema para auditoria inline na conversa
  const noteText = body.note?.trim() ? ` — ${body.note.trim()}` : '';
  const systemText = body.toAgentId
    ? `Conversa transferida de ${fromName} para ${toName}${noteText}`
    : `Conversa desatribuída por ${fromName}${noteText}`;

  await repo.insertMessage({
    workspace_id:    workspaceId,
    conversation_id: conversationId,
    direction:       'system',
    message:         systemText,
    status:          'sent',
  });

  logger.info(
    { conversationId, fromUserId, toAgentId: body.toAgentId, workspaceId },
    'Inbox: conversa transferida',
  );
  return updated;
}

/**
 * Retorna totais de não-lidas para o agente logado.
 */
export async function getUnreadSummary(
  workspaceId: string,
  userId:      string,
): Promise<UnreadSummary> {
  const agent = await repo.resolveAgent(workspaceId, userId);
  return repo.getUnreadSummary(workspaceId, agent?.id ?? null);
}

/**
 * Lista agentes ativos do workspace (usado no seletor de transferência).
 */
export async function listAgents(
  workspaceId: string,
): Promise<AgentListItem[]> {
  return repo.listActiveAgents(workspaceId) as Promise<AgentListItem[]>;
}

// ── Fase 3 — Busca, soft-delete, labels, quick replies ────────

/**
 * Busca full-text em mensagens do workspace.
 */
export async function searchMessages(
  workspaceId: string,
  params:      SearchMessagesQuery,
): Promise<{
  results: Array<ConversationMessage & { conversation?: { id: string; status: string } }>;
  total:   number;
  page:    number;
}> {
  if (!params.q?.trim()) {
    throw new ValidationException({ q: ['Parâmetro "q" obrigatório'] });
  }
  const { results, total } = await repo.searchMessages(workspaceId, params);
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  return { results, total, page };
}

/**
 * Soft-delete de mensagem.
 * Qualquer agente pode deletar; admins podem deletar mensagens de outros.
 * Física: is_deleted = true, message = null.
 */
export async function softDeleteMessage(
  workspaceId: string,
  messageId:   string,
): Promise<ConversationMessage> {
  // Verificar existência com isolamento de workspace
  const { data: existing } = await (async () =>
    supabaseAdminCheck(workspaceId, messageId)
  )();

  if (!existing) throw new NotFoundException('Mensagem');
  const updated = await repo.softDeleteMessage(workspaceId, messageId);
  if (!updated) throw new NotFoundException('Mensagem');
  return updated;
}

// Helper interno — verifica existência sem expor supabaseAdmin direto do service
async function supabaseAdminCheck(workspaceId: string, messageId: string) {
  const { supabaseAdmin } = await import('../../config/supabase');
  return supabaseAdmin
    .from('conversation_messages')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('id', messageId)
    .maybeSingle();
}

// ── Labels ────────────────────────────────────────────────────

export async function listLabels(workspaceId: string): Promise<Label[]> {
  return repo.listLabels(workspaceId);
}

export async function createLabel(
  workspaceId: string,
  body:        CreateLabelBody,
): Promise<Label> {
  if (!body.name?.trim()) {
    throw new ValidationException({ name: ['Campo "name" obrigatório'] });
  }
  if (body.color && !/^#[0-9a-fA-F]{3,8}$/.test(body.color)) {
    throw new ValidationException({ color: ['Cor inválida — use formato hex (#RRGGBB)'] });
  }
  return repo.createLabel(workspaceId, body);
}

export async function updateLabel(
  workspaceId: string,
  labelId:     string,
  body:        UpdateLabelBody,
): Promise<Label> {
  if (body.color && !/^#[0-9a-fA-F]{3,8}$/.test(body.color)) {
    throw new ValidationException({ color: ['Cor inválida — use formato hex (#RRGGBB)'] });
  }
  const updated = await repo.updateLabel(workspaceId, labelId, body);
  if (!updated) throw new NotFoundException('Label');
  return updated;
}

export async function deleteLabel(
  workspaceId: string,
  labelId:     string,
): Promise<void> {
  await repo.deleteLabel(workspaceId, labelId);
}

export async function getConversationLabels(
  workspaceId:    string,
  conversationId: string,
): Promise<ConversationLabelMap[]> {
  const conv = await repo.getConversationById(workspaceId, conversationId);
  if (!conv) throw new NotFoundException('Conversa');
  return repo.getConversationLabels(workspaceId, conversationId);
}

export async function addLabelToConversation(
  workspaceId:    string,
  conversationId: string,
  body:           AddLabelBody,
  userId:         string,
): Promise<ConversationLabelMap> {
  if (!body.labelId) {
    throw new ValidationException({ labelId: ['Campo "labelId" obrigatório'] });
  }
  const conv = await repo.getConversationById(workspaceId, conversationId);
  if (!conv) throw new NotFoundException('Conversa');

  // Fase 3 — garantir que a label pertence ao mesmo workspace (isolamento)
  const labels = await repo.listLabels(workspaceId);
  const labelExists = labels.some((l) => l.id === body.labelId);
  if (!labelExists) {
    throw new NotFoundException('Label');
  }

  return repo.addLabelToConversation(workspaceId, conversationId, body.labelId, userId);
}

export async function removeLabelFromConversation(
  workspaceId:    string,
  conversationId: string,
  labelId:        string,
): Promise<void> {
  const conv = await repo.getConversationById(workspaceId, conversationId);
  if (!conv) throw new NotFoundException('Conversa');
  await repo.removeLabelFromConversation(workspaceId, conversationId, labelId);
}

// ── Quick Replies ─────────────────────────────────────────────

export async function listQuickReplies(
  workspaceId: string,
  search?:     string,
): Promise<QuickReply[]> {
  return repo.listQuickReplies(workspaceId, search);
}

export async function createQuickReply(
  workspaceId: string,
  body:        CreateQuickReplyBody,
  userId:      string,
): Promise<QuickReply> {
  if (!body.shortcut?.trim()) throw new ValidationException({ shortcut: ['"shortcut" obrigatório'] });
  if (!body.title?.trim())    throw new ValidationException({ title:    ['"title" obrigatório'] });
  if (!body.body?.trim())     throw new ValidationException({ body:     ['"body" obrigatório'] });
  return repo.createQuickReply(workspaceId, body, userId);
}

export async function updateQuickReply(
  workspaceId: string,
  replyId:     string,
  body:        UpdateQuickReplyBody,
): Promise<QuickReply> {
  const updated = await repo.updateQuickReply(workspaceId, replyId, body);
  if (!updated) throw new NotFoundException('Resposta rápida');
  return updated;
}

export async function deleteQuickReply(
  workspaceId: string,
  replyId:     string,
): Promise<void> {
  await repo.deleteQuickReply(workspaceId, replyId);
}

// ── Fase 4 — Mídia e conteúdo rico ───────────────────────────

/**
 * Valida e persiste um arquivo no Supabase Storage.
 * Retorna o attachment criado + signed URL para preview imediato.
 */
export async function uploadMedia(
  workspaceId:    string,
  conversationId: string,
  userId:         string,
  buffer:         Buffer,
  originalName:   string,
  mimeType:       string,
): Promise<MediaUploadResult> {
  const conv = await repo.getConversationById(workspaceId, conversationId);
  if (!conv) throw new NotFoundException('Conversa');
  if (conv.status === 'closed' || conv.status === 'archived') {
    throw new ForbiddenException('Não é possível enviar mídia em conversa fechada ou arquivada.');
  }

  const storage = await import('./inbox.storage');

  // Resolve agente para created_by
  const agent = await repo.resolveAgent(workspaceId, userId);

  // Upload + validação (tipo, tamanho, magic bytes)
  const { storagePath, mediaType, safeFilename } = await storage.uploadToStorage(
    workspaceId,
    conversationId,
    buffer,
    originalName,
    mimeType,
  );

  // Persistir metadados
  const attachment = await repo.insertMediaAttachment({
    workspace_id:    workspaceId,
    conversation_id: conversationId,
    message_id:      null,            // vínculo ocorre após envio
    media_type:      mediaType,
    filename:        safeFilename,
    mime_type:       mimeType,
    size_bytes:      buffer.length,
    storage_path:    storagePath,
    created_by:      agent?.id ?? null,
  });

  // Gerar signed URL temporária para preview imediato no frontend
  const signedUrl = await storage.getSignedUrl(storagePath, storage.SIGNED_URL_TTL_RENDER);

  logger.info(
    { attachmentId: attachment.id, workspaceId, conversationId, mediaType },
    'Inbox: mídia upada',
  );

  return { attachment, signedUrl };
}

/**
 * Envia uma mídia já upada para o contato via Evolution.
 * O attachment deve pertencer à mesma conversa + workspace.
 */
export async function sendMediaMessage(
  workspaceId:    string,
  conversationId: string,
  userId:         string,
  body:           SendMediaBody,
): Promise<ConversationMessage> {
  if (!body.attachmentId) {
    throw new ValidationException({ attachmentId: ['"attachmentId" obrigatório'] });
  }

  const conv = await repo.getConversationById(workspaceId, conversationId);
  if (!conv) throw new NotFoundException('Conversa');
  if (conv.status === 'closed' || conv.status === 'archived') {
    throw new ForbiddenException('Não é possível enviar mensagem em conversa fechada ou arquivada.');
  }
  if (!conv.instance_id) throw new ValidationException({ instance: ['Conversa sem instância'] });
  if (!conv.contact_id)  throw new ValidationException({ contact: ['Conversa sem contato'] });

  // Validar que o attachment pertence a este workspace + conversa
  const attachment = await repo.getMediaAttachment(workspaceId, body.attachmentId);
  if (!attachment) throw new NotFoundException('Media attachment');
  if (attachment.conversation_id !== conversationId) {
    throw new ForbiddenException('Attachment não pertence a esta conversa.');
  }

  const agent   = await repo.resolveAgent(workspaceId, userId);
  const storage = await import('./inbox.storage');

  // Gerar URL temporária para o Evolution baixar e reenviar ao usuário
  const mediaUrl = await storage.getSignedUrl(
    attachment.storage_path,
    storage.SIGNED_URL_TTL_DOWNLOAD,
  );

  const sender  = new InboxMediaSender();
  const message = await sender.sendMedia({
    workspaceId,
    conversationId,
    instanceId:   conv.instance_id,
    contactId:    conv.contact_id,
    senderId:     agent?.id ?? null,
    mediaType:    attachment.media_type,
    mediaUrl,
    caption:      body.caption?.trim() || undefined,
    storagePath:  attachment.storage_path,
    attachmentId: attachment.id,
  });

  // Fase 6 — SLA: registrar primeira resposta (fire-and-forget)
  recordFirstResponse(workspaceId, conversationId).catch(() => {});

  return message;
}

/**
 * Gera URL assinada temporária para acesso seguro a um attachment.
 * Valida isolamento de workspace antes de gerar.
 */
export async function getSecureMediaUrl(
  workspaceId:  string,
  attachmentId: string,
  forDownload = false,
): Promise<{ signedUrl: string; attachment: MediaAttachment }> {
  const attachment = await repo.getMediaAttachment(workspaceId, attachmentId);
  if (!attachment) throw new NotFoundException('Media attachment');

  const storage = await import('./inbox.storage');
  const ttl     = forDownload
    ? storage.SIGNED_URL_TTL_DOWNLOAD
    : storage.SIGNED_URL_TTL_RENDER;

  const signedUrl = await storage.getSignedUrl(attachment.storage_path, ttl);
  return { signedUrl, attachment };
}

// ── Fase 5 — IA Assistiva ─────────────────────────────────────

/**
 * Enfileira análise assíncrona de IA para uma conversa.
 * Cria/reseta o registro em conversation_ai_analysis com status 'pending'.
 * Retorna imediatamente (não bloqueia o inbox).
 */
export async function requestAiAnalysis(
  workspaceId:    string,
  conversationId: string,
  userId:         string | null,
): Promise<ConversationAiAnalysis> {
  const conv = await repo.getConversationById(workspaceId, conversationId);
  if (!conv) throw new NotFoundException('Conversa');

  // Cria ou reseta o registro (limpa análise anterior)
  const record = await repo.upsertAiAnalysisPending(workspaceId, conversationId);

  // Enfileira job (fire-and-forget do ponto de vista da rota)
  await enqueueAiAnalysis({
    workspaceId,
    conversationId,
    triggeredBy: userId,
  });

  logger.info({ conversationId, workspaceId, userId }, 'Inbox: análise IA enfileirada');
  return record;
}

/**
 * Retorna a análise IA mais recente de uma conversa.
 */
export async function getAiAnalysis(
  workspaceId:    string,
  conversationId: string,
): Promise<ConversationAiAnalysis | null> {
  const conv = await repo.getConversationById(workspaceId, conversationId);
  if (!conv) throw new NotFoundException('Conversa');
  return repo.getAiAnalysis(workspaceId, conversationId);
}

// ── Fase 6 — SLA, Automações, Dashboard, Alertas ─────────────

import {
  SlaPolicy,
  CreateSlaPolicyBody,
  UpdateSlaPolicyBody,
  AutomationRule,
  CreateAutomationRuleBody,
  UpdateAutomationRuleBody,
  InboxAlert,
  AlertsQuery,
  DashboardQuery,
  DashboardMetrics,
} from './inbox.types';
import { getDashboardMetrics }      from './inbox.dashboard';
import { triggerAutomations }       from './inbox.automation';
import { initSlaDeadlines }         from './inbox.sla';
import { supabaseAdmin as _supa }   from '../../config/supabase';

// ── Dashboard ─────────────────────────────────────────────────

export async function getDashboard(
  workspaceId: string,
  query:       DashboardQuery,
): Promise<DashboardMetrics> {
  return getDashboardMetrics(workspaceId, query);
}

// ── SLA Policies ──────────────────────────────────────────────

export async function listSlaPolicies(workspaceId: string): Promise<SlaPolicy[]> {
  return repo.listSlaPolicies(workspaceId);
}

export async function createSlaPolicy(
  workspaceId: string,
  body:        CreateSlaPolicyBody,
  userId:      string,
): Promise<SlaPolicy> {
  return repo.createSlaPolicy(workspaceId, body, userId);
}

export async function updateSlaPolicy(
  workspaceId: string,
  policyId:    string,
  body:        UpdateSlaPolicyBody,
): Promise<SlaPolicy> {
  const { data } = await _supa
    .from('sla_policies')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('id', policyId)
    .maybeSingle();
  if (!data) throw new NotFoundException('Política SLA');
  return repo.updateSlaPolicy(workspaceId, policyId, body);
}

export async function deleteSlaPolicy(workspaceId: string, policyId: string): Promise<void> {
  return repo.deleteSlaPolicy(workspaceId, policyId);
}

// ── Automation Rules ──────────────────────────────────────────

export async function listAutomationRules(
  workspaceId:  string,
  triggerType?: string,
): Promise<AutomationRule[]> {
  return repo.listAutomationRules(workspaceId, triggerType);
}

export async function createAutomationRule(
  workspaceId: string,
  body:        CreateAutomationRuleBody,
  userId:      string,
): Promise<AutomationRule> {
  return repo.createAutomationRule(workspaceId, body, userId);
}

export async function updateAutomationRule(
  workspaceId: string,
  ruleId:      string,
  body:        UpdateAutomationRuleBody,
): Promise<AutomationRule> {
  const { data } = await _supa
    .from('automation_rules')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('id', ruleId)
    .maybeSingle();
  if (!data) throw new NotFoundException('Regra de automação');
  return repo.updateAutomationRule(workspaceId, ruleId, body);
}

export async function deleteAutomationRule(workspaceId: string, ruleId: string): Promise<void> {
  return repo.deleteAutomationRule(workspaceId, ruleId);
}

// ── Alertas ───────────────────────────────────────────────────

export async function getAlerts(
  workspaceId: string,
  query:       AlertsQuery,
): Promise<{ alerts: InboxAlert[]; total: number }> {
  return repo.getAlerts(workspaceId, query);
}

export async function resolveAlert(workspaceId: string, alertId: string): Promise<void> {
  return repo.resolveAlert(workspaceId, alertId);
}

// ── Auto-atribuição ───────────────────────────────────────────

export async function autoAssignConversation(
  workspaceId:    string,
  conversationId: string,
): Promise<void> {
  try {
    const conv = await repo.getConversationById(workspaceId, conversationId);
    if (!conv || conv.assigned_agent_id) return;

    const agents = await repo.getOnlineAgentsForAssignment(
      workspaceId,
      conv.department_id ?? undefined,
    );
    if (agents.length === 0) return;

    // Agente com menor carga (tie-break: ordem natural)
    const best = agents.reduce((min, a) => a.open_count < min.open_count ? a : min, agents[0]);
    await repo.assignConversationToAgent(workspaceId, conversationId, best.agent_id);

    logger.info({ conversationId, agentId: best.agent_id }, 'AutoAssign: conversa atribuída');
  } catch (err) {
    logger.warn({ err, conversationId }, 'AutoAssign: falha');
  }
}

/**
 * Hooks pós-criação de conversa: SLA + auto-atribuição + automação.
 * Fire-and-forget — nunca bloqueia o fluxo do webhook.
 */
export function postNewConversationHooks(
  workspaceId:    string,
  conversationId: string,
  priority:       number,
  conv:           Record<string, unknown>,
): void {
  initSlaDeadlines(workspaceId, conversationId, priority).catch(() => {});
  autoAssignConversation(workspaceId, conversationId).catch(() => {});
  triggerAutomations(workspaceId, conversationId, 'conversation_created', {
    conversation: conv as Partial<import('./inbox.types').Conversation>,
  }).catch(() => {});
}

/** Hooks pós-reabertura de conversa (fire-and-forget). */
export function postReopenConversationHooks(
  workspaceId:    string,
  conversationId: string,
  conv:           Record<string, unknown>,
): void {
  initSlaDeadlines(workspaceId, conversationId).catch(() => {});
  autoAssignConversation(workspaceId, conversationId).catch(() => {});
  triggerAutomations(workspaceId, conversationId, 'conversation_reopened', {
    conversation: conv as Partial<import('./inbox.types').Conversation>,
  }).catch(() => {});
}

export { triggerAutomations };

