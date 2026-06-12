import { logger }             from '../../utils/logger';
import { evolutionService }    from '../../services/evolution.service';
import { ConversationMessage } from './inbox.types';
import { MediaType }           from './inbox.types';
import * as repo               from './inbox.repository';

// ──────────────────────────────────────────────────────────────
// INBOX MESSAGE SENDER
// Responsável por:
//   1. Buscar telefone do contato
//   2. Buscar nome da instância
//   3. Persistir mensagem com status 'queued'
//   4. Enviar via Evolution API
//   5. Atualizar status para 'sent'
//   6. Tocar last_message_at da conversa
//
// Não encapsula media (Fase 2).
// ──────────────────────────────────────────────────────────────

export interface SendPayload {
  workspaceId:       string;
  conversationId:    string;
  instanceId:        string;
  contactId:         string;
  senderId:          string | null;
  text:              string;
  replyToMessageId?: string;
}

export class InboxMessageSender {
  async send(payload: SendPayload): Promise<ConversationMessage> {
    const { workspaceId, conversationId, instanceId, contactId, senderId, text } = payload;

    // Resolver número do contato
    const { data: contactRow } = await (await import('../../config/supabase')).supabaseAdmin
      .from('contacts')
      .select('phone')
      .eq('id', contactId)
      .maybeSingle();

    const phone = (contactRow as { phone: string } | null)?.phone;
    if (!phone) {
      throw new Error(`Contato ${contactId} sem telefone cadastrado`);
    }

    // Resolver nome da instância
    const { data: instanceRow } = await (await import('../../config/supabase')).supabaseAdmin
      .from('instances')
      .select('name')
      .eq('id', instanceId)
      .maybeSingle();

    const instanceName = (instanceRow as { name: string } | null)?.name;
    if (!instanceName) {
      throw new Error(`Instância ${instanceId} não encontrada`);
    }

    // 1. Persiste com status 'queued'
    const { message: msg } = await repo.insertMessage({
      workspace_id:        workspaceId,
      conversation_id:     conversationId,
      direction:           'outbound',
      sender_id:           senderId,
      message:             text,
      status:              'queued',
      reply_to_message_id: payload.replyToMessageId ?? null,
    });

    const now = new Date().toISOString();

    // 2. Enviar via Evolution — se falhar, atualiza status para 'failed'
    try {
      await evolutionService.sendText(instanceName, { number: phone, text });

      // 3. Atualizar status para 'sent'
      await repo.updateMessageStatus(workspaceId, msg.id, 'sent');
      msg.status   = 'sent';
      msg.sent_at  = now;

      logger.info(
        { conversationId, instanceName, phone: phone.slice(0, 6) + '****' },
        'Inbox: mensagem outbound enviada',
      );
    } catch (err) {
      await repo.updateMessageStatus(workspaceId, msg.id, 'failed');
      msg.status = 'failed';
      logger.error({ conversationId, err }, 'Inbox: falha ao enviar via Evolution');
      throw err;
    }

    // 4. Tocar last_message_at da conversa
    await repo.touchConversation(conversationId, now);

    return msg;
  }
}

// ── Fase 4 — Envio de mídia outbound ─────────────────────────

export interface SendMediaPayload {
  workspaceId:    string;
  conversationId: string;
  instanceId:     string;
  contactId:      string;
  senderId:       string | null;
  mediaType:      MediaType;
  mediaUrl:       string;   // URL pública ou signed URL da Evolution receber
  caption?:       string;
  storagePath:    string;   // persiste no banco
  attachmentId:   string;   // FK para media_attachments
}

export class InboxMediaSender {
  async sendMedia(payload: SendMediaPayload): Promise<ConversationMessage> {
    const {
      workspaceId, conversationId, instanceId, contactId,
      senderId, mediaType, mediaUrl, caption, attachmentId,
    } = payload;

    // Resolver número do contato
    const { data: contactRow } = await (await import('../../config/supabase')).supabaseAdmin
      .from('contacts')
      .select('phone')
      .eq('id', contactId)
      .maybeSingle();

    const phone = (contactRow as { phone: string } | null)?.phone;
    if (!phone) {
      throw new Error(`Contato ${contactId} sem telefone cadastrado`);
    }

    // Resolver nome da instância
    const { data: instanceRow } = await (await import('../../config/supabase')).supabaseAdmin
      .from('instances')
      .select('name')
      .eq('id', instanceId)
      .maybeSingle();

    const instanceName = (instanceRow as { name: string } | null)?.name;
    if (!instanceName) {
      throw new Error(`Instância ${instanceId} não encontrada`);
    }

    // 1. Persistir mensagem com status 'queued'
    const { message: msg } = await repo.insertMessage({
      workspace_id:    workspaceId,
      conversation_id: conversationId,
      direction:       'outbound',
      sender_id:       senderId,
      message:         caption?.trim() || null,
      status:          'queued',
    });

    // 2. Vincular attachment à mensagem
    try {
      await repo.linkAttachmentToMessage(workspaceId, msg.id, attachmentId, mediaType);
    } catch (err) {
      await repo.updateMessageStatus(workspaceId, msg.id, 'failed');
      msg.status = 'failed';
      logger.error({ conversationId, attachmentId, err }, 'Inbox: falha ao vincular attachment à mensagem');
      throw err;
    }
    msg.media_attachment_id = attachmentId;
    msg.media_type          = mediaType;

    const now = new Date().toISOString();

    // 3. Enviar via Evolution
    try {
      await evolutionService.sendMedia(instanceName, {
        number:    phone,
        mediatype: mediaType as 'image' | 'video' | 'audio' | 'document',
        media:     mediaUrl,
        caption:   caption?.trim() || undefined,
      });

      await repo.updateMessageStatus(workspaceId, msg.id, 'sent');
      msg.status  = 'sent';
      msg.sent_at = now;

      logger.info(
        { conversationId, instanceName, mediaType, phone: phone.slice(0, 6) + '****' },
        'Inbox: mídia outbound enviada',
      );
    } catch (err) {
      await repo.updateMessageStatus(workspaceId, msg.id, 'failed');
      msg.status = 'failed';
      logger.error({ conversationId, err }, 'Inbox: falha ao enviar mídia via Evolution');
      throw err;
    }

    // 4. Tocar last_message_at
    await repo.touchConversation(conversationId, now);

    return msg;
  }
}
