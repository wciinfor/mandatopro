import { logger }                from '../../utils/logger';
import { EvolutionMessagePayload } from './inbox.types';
import * as repo                   from './inbox.repository';
import * as storage                from './inbox.storage';
import {
  postNewConversationHooks,
  postReopenConversationHooks,
} from './inbox.service';

// ──────────────────────────────────────────────────────────────
// INBOX WEBHOOK HANDLER
//
// Processa eventos da Evolution API recebidos em:
//   POST /webhooks/evolution (event = MESSAGES_UPSERT)
//
// Fluxo (deve concluir em < 50ms antes do 200 OK):
//   1. Validar campos mínimos
//   2. Resolver instância → workspace
//   3. Upsert contact (phone + pushName)
//   4. Encontrar conversa ativa ou criar nova / reabrir fechada
//   5. Inserir mensagem (idempotência por provider_message_id)
//   6. Incrementar unread_count + tocar last_message_at
//
// Chamado de webhooks.routes.ts; retorno void — erros são logados,
// nunca lançados (para evitar 5xx ao webhook da Evolution).
// ──────────────────────────────────────────────────────────────

export async function handleMessagesUpsert(
  raw: Record<string, unknown>,
): Promise<void> {
  const payload = raw as unknown as EvolutionMessagePayload;

  // ── 1. Validação mínima ────────────────────────────────────
  const instanceName = payload.instance;
  const key          = payload.data?.key;
  const remoteJid    = key?.remoteJid;
  const providerId   = key?.id;

  if (!instanceName || !remoteJid || !providerId) {
    logger.warn({ payload: raw }, 'InboxWebhookHandler: payload incompleto, ignorando');
    return;
  }

  // Ignorar mensagens de grupos (terminam em @g.us)
  if (remoteJid.endsWith('@g.us')) {
    return;
  }

  // Ignorar mensagens enviadas pelo próprio bot (fromMe = true)
  // — essas chegam como MESSAGES_UPSERT mas são echos de outbound
  if (key.fromMe) {
    return;
  }

  // ── 2. Resolver instância → workspace ─────────────────────
  const instance = await repo.resolveInstance(instanceName);
  if (!instance) {
    logger.warn({ instanceName }, 'InboxWebhookHandler: instância não encontrada no banco');
    return;
  }

  const { id: instanceId, workspace_id: workspaceId } = instance;

  // ── 3. Upsert contact ─────────────────────────────────────
  const phone    = remoteJid; // mantém @s.whatsapp.net — normalizado dentro do repo
  const pushName = payload.data?.pushName ?? null;

  let contactId: string;
  try {
    contactId = await repo.upsertContact(workspaceId, phone, pushName);
  } catch (err) {
    logger.error({ workspaceId, phone, err }, 'InboxWebhookHandler: falha ao upsert contact');
    return;
  }

  // ── 4. Encontrar ou criar conversa ─────────────────────────
  let conversationId: string;

  try {
    const active = await repo.findActiveConversation(workspaceId, contactId, instanceId);

    if (active) {
      conversationId = active.id;
    } else {
      // Verificar se existe conversa fechada para reabrir
      const closed = await repo.findLastClosedConversation(workspaceId, contactId, instanceId);

      if (closed) {
        await repo.reopenConversation(closed.id);
        conversationId = closed.id;
        logger.info({ conversationId, workspaceId }, 'InboxWebhookHandler: conversa reaberta');
        // Fase 6: hooks pós-reabertura (SLA + auto-assign + automações)
        postReopenConversationHooks(workspaceId, conversationId, {
          id: conversationId, workspace_id: workspaceId,
        });
      } else {
        // Criar nova conversa
        const conv = await repo.createConversation({
          workspace_id: workspaceId,
          contact_id:   contactId,
          instance_id:  instanceId,
          external_id:  providerId,
        });
        conversationId = conv.id;
        logger.info({ conversationId, workspaceId }, 'InboxWebhookHandler: nova conversa criada');
        // Fase 6: hooks pós-criação (SLA + auto-assign + automações)
        postNewConversationHooks(workspaceId, conversationId, conv.priority ?? 0, {
          id: conversationId, workspace_id: workspaceId,
          contact_id: contactId, instance_id: instanceId,
          priority: conv.priority ?? 0,
        });
      }
    }
  } catch (err) {
    logger.error({ workspaceId, contactId, instanceId, err }, 'InboxWebhookHandler: falha ao resolver conversa');
    return;
  }

  // ── 5. Inserir mensagem (idempotência) ─────────────────────
  const msgData  = payload.data?.message;
  const text     = msgData?.conversation
    ?? msgData?.extendedTextMessage?.text
    ?? null;

  // ── Fase 4: detectar mensagem de mídia ─────────────────────
  // Prioridade: image > video > audio > document > text
  const mediaMsg =
    msgData?.imageMessage    ??
    msgData?.videoMessage    ??
    msgData?.audioMessage    ??
    msgData?.documentMessage ??
    null;

  const messageTypeRaw = payload.data?.messageType;
  const evoMediaType = messageTypeRaw === 'imageMessage'    ? 'image'
    : messageTypeRaw === 'videoMessage'    ? 'video'
    : messageTypeRaw === 'audioMessage'    ? 'audio'
    : messageTypeRaw === 'documentMessage' ? 'document'
    : null;

  let isNewMessage = false;
  let messageId: string | null = null;

  try {
    const result = await repo.insertMessage({
      workspace_id:        workspaceId,
      conversation_id:     conversationId,
      direction:           'inbound',
      message:             text ?? mediaMsg?.caption ?? null,
      status:              'delivered',
      provider_message_id: providerId,
    });
    isNewMessage = result.isNew;
    messageId    = result.message.id;
  } catch (err) {
    logger.error({ conversationId, providerId, err }, 'InboxWebhookHandler: falha ao inserir mensagem');
    return;
  }

  // ── Fase 4: processar mídia inbound ───────────────────────
  if (isNewMessage && mediaMsg?.url && evoMediaType && messageId) {
    _processInboundMedia({
      workspaceId,
      conversationId,
      messageId,
      mediaType:    evoMediaType as 'image' | 'video' | 'audio' | 'document',
      remoteUrl:    mediaMsg.url,
      mimeType:     mediaMsg.mimetype ?? 'application/octet-stream',
      originalName: (msgData?.documentMessage?.title ?? mediaMsg.fileName) || `file_${Date.now()}`,
      sizeHint:     typeof mediaMsg.fileLength === 'number'
        ? mediaMsg.fileLength
        : typeof mediaMsg.fileLength === 'string'
          ? parseInt(mediaMsg.fileLength, 10) || 0
          : 0,
    }).catch((err) => {
      logger.warn({ conversationId, messageId, err }, 'InboxWebhookHandler: falha ao processar mídia inbound');
    });
  }

  // ── 6. Atualizar contadores (somente para mensagem nova) ───
  // Mensagem duplicada (isNew=false) não deve incrementar unread_count,
  // evitando que re-entrega de webhook infle os badges do agente.
  if (isNewMessage) {
    try {
      await repo.incrementUnread(conversationId);
    } catch (err) {
      logger.warn({ conversationId, err }, 'InboxWebhookHandler: falha ao incrementar unread');
    }
  }
}

/**
 * Processa MESSAGE_UPDATE (ACK de entrega/leitura da Evolution).
 * Usado para atualizar status de mensagens outbound.
 */
export async function handleMessageUpdate(
  raw: Record<string, unknown>,
): Promise<void> {
  const data = raw['data'] as Record<string, unknown> | undefined;
  if (!data) return;

  const key        = data['key']    as Record<string, unknown> | undefined;
  const update     = data['update'] as Record<string, unknown> | undefined;
  const providerId = key?.['id']    as string | undefined;
  const ackCode    = update?.['status'] as number | string | undefined;

  if (!providerId || ackCode === undefined) return;

  // Mapear código ACK da Evolution para status interno
  const statusMap: Record<string, 'sent' | 'delivered' | 'read'> = {
    '2':           'sent',
    '3':           'delivered',
    '4':           'read',
    'DELIVERY_ACK': 'delivered',
    'READ':         'read',
    'PLAYED':       'read',
  };

  const status = statusMap[String(ackCode)];
  if (!status) return;

  try {
    const { data: msgRow } = await (await import('../../config/supabase')).supabaseAdmin
      .from('conversation_messages')
      .select('id, workspace_id')
      .eq('provider_message_id', providerId)
      .maybeSingle();

    if (!msgRow) return;

    const row = msgRow as { id: string; workspace_id: string };
    await repo.updateMessageStatus(row.workspace_id, row.id, status);
  } catch (err) {
    logger.warn({ providerId, status, err }, 'handleMessageUpdate: falha ao atualizar status');
  }
}

// ── Fase 4: helper privado — mídia inbound ────────────────────
// Executado de forma assíncrona (fire-and-forget) após o 200 OK.
// Baixa o arquivo do Evolution, salva no Storage, cria attachment.

interface InboundMediaParams {
  workspaceId:    string;
  conversationId: string;
  messageId:      string;
  mediaType:      'image' | 'video' | 'audio' | 'document';
  remoteUrl:      string;
  mimeType:       string;
  originalName:   string;
  sizeHint:       number;
}

async function _processInboundMedia(params: InboundMediaParams): Promise<void> {
  const { workspaceId, conversationId, messageId, mediaType, remoteUrl, mimeType, originalName } = params;

  const persistFallback = async () => {
    const { supabaseAdmin } = await import('../../config/supabase');
    await supabaseAdmin
      .from('conversation_messages')
      .update({ media_url: remoteUrl, media_type: mediaType })
      .eq('workspace_id', workspaceId)
      .eq('id', messageId);
  };

  // 1. Baixar mídia remota
  let buffer: Buffer;
  let detectedMime: string;
  try {
    const result = await storage.downloadRemoteMedia(remoteUrl);
    buffer = result.buffer;
    detectedMime = result.mimeType;
  } catch (err) {
    logger.warn({ workspaceId, conversationId, err }, '_processInboundMedia: download falhou, armazenando só URL remota');
    await persistFallback();
    return;
  }

  // Usar mime detectado se estiver na allowlist, senão o declarado
  const effectiveMime = storage.resolveMediaType(detectedMime) ? detectedMime : mimeType;

  // 2. Upload para Supabase Storage
  let storagePath: string;
  try {
    const result = await storage.uploadToStorage(
      workspaceId,
      conversationId,
      buffer,
      originalName,
      effectiveMime,
    );
    storagePath = result.storagePath;
  } catch (err) {
    logger.warn({ workspaceId, conversationId, err }, '_processInboundMedia: upload falhou, armazenando só URL remota');
    await persistFallback();
    return;
  }

  // 3. Criar media_attachment
  const attachment = await repo.insertMediaAttachment({
    workspace_id:    workspaceId,
    conversation_id: conversationId,
    message_id:      messageId,
    media_type:      mediaType,
    filename:        storage.sanitizeFilename(originalName),
    mime_type:       effectiveMime,
    size_bytes:      buffer.length,
    storage_path:    storagePath,
  });

  // 4. Vincular à mensagem
  await repo.linkAttachmentToMessage(workspaceId, messageId, attachment.id, mediaType);

  logger.info(
    { workspaceId, conversationId, messageId, attachmentId: attachment.id, mediaType },
    'InboxWebhookHandler: mídia inbound processada',
  );
}
