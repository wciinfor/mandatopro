/**
 * Normalizador de eventos oficiais do Webhook VIBEWHATS (Padrão Z-API)
 * 
 * Traduz os callbacks brutos recebidos da VibeWhats para o formato canônico interno do MandatoPRO.
 * 
 * Callbacks suportados:
 * - Mensagens Inbound (texto, mídia, localização, contatos)
 * - Status de envio / confirmação de entrega (delivery, message-status)
 * - Conexão e desconexão de instância
 * 
 * Redaction de segredos e credenciais para auditoria segura.
 */

export class VibeWhatsWebhookNormalizer {
  static _normalizarTimestamp(val) {
    if (!val) return new Date().toISOString();
    if (typeof val === 'string' && val.includes('T')) return val;
    const num = Number(val);
    if (!Number.isFinite(num) || num <= 0) return new Date().toISOString();
    const ms = num < 100000000000 ? num * 1000 : num;
    return new Date(ms).toISOString();
  }

  static _limparTelefone(phone) {
    if (!phone) return null;
    const clean = String(phone).replace(/\D+/g, '');
    return clean || null;
  }

  static _sanitizarPayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    try {
      const clone = JSON.parse(JSON.stringify(payload));
      const camposSensiveis = ['clientToken', 'client_token', 'token', 'access_token', 'secret', 'password', 'app_secret'];

      const redigir = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
          if (camposSensiveis.some(s => key.toLowerCase().includes(s))) {
            obj[key] = '[REDACTED]';
          } else if (typeof obj[key] === 'object') {
            redigir(obj[key]);
          }
        }
      };

      redigir(clone);
      return clone;
    } catch {
      return {};
    }
  }

  static _normalizarStatus(statusRaw) {
    const s = String(statusRaw || '').toUpperCase();
    if (s === 'SENT' || s === 'ENVIADA' || s === 'ENVIADO') return 'sent';
    if (s === 'DELIVERED' || s === 'ENTREGUE' || s === 'RECEIVED') return 'delivered';
    if (s === 'READ' || s === 'LIDA' || s === 'LIDO' || s === 'VIEWED') return 'read';
    if (s === 'FAILED' || s === 'ERROR' || s === 'FALHOU' || s === 'FALHA') return 'failed';
    return s.toLowerCase() || 'sent';
  }

  /**
   * Normaliza qualquer evento do webhook VibeWhats para o contrato canônico
   * @param {Object} payload - Objeto bruto recebido no corpo da requisição HTTP
   * @returns {Object|null} Objeto canônico normalizado
   */
  static normalizarEvento(payload) {
    if (!payload || typeof payload !== 'object') return null;

    const data = payload.data || payload;
    const eventName = String(payload.event || payload.type || payload.event_type || payload.callback || '').trim();

    // ─── 1. STATUS E ENTREGA ───────────────────────────────────────────────────
    const isStatusEvent =
      eventName === 'DeliveryCallback' ||
      eventName === 'MessageStatusCallback' ||
      eventName === 'delivery' ||
      eventName === 'message-status' ||
      eventName === 'message_status' ||
      Boolean(data.status && !data.text && !data.message && (data.messageId || data.zaapId || data.id));

    if (isStatusEvent) {
      const rawStatus = eventName === 'DeliveryCallback' || eventName === 'delivery'
        ? 'DELIVERED'
        : (data.status || payload.status || 'SENT');

      const statusNorm = VibeWhatsWebhookNormalizer._normalizarStatus(rawStatus);
      const messageId = String(data.messageId || data.id || data.zaapId || payload.messageId || payload.id || '').trim();
      const recipientPhone = VibeWhatsWebhookNormalizer._limparTelefone(
        data.phone || data.recipient || data.to || payload.phone || payload.recipient || payload.to
      );
      const timestamp = VibeWhatsWebhookNormalizer._normalizarTimestamp(
        data.momment || data.timestamp || payload.momment || payload.timestamp
      );
      const instanceId = String(data.instanceId || data.instance || payload.instanceId || payload.instance || '').trim();
      const errorDetail = statusNorm === 'failed'
        ? (data.error || data.reason || payload.error || 'Falha no envio VibeWhats')
        : null;

      return {
        tipo: 'status',
        rawType: eventName || 'MessageStatusCallback',
        event_id: messageId,
        provider_message_id: messageId,
        provider: 'VIBEWHATS',
        origem: 'vibewhats',
        status: statusNorm,
        contact_id: recipientPhone,
        timestamp,
        erro: errorDetail,
        metadata: {
          instanceId,
          rawPayload: VibeWhatsWebhookNormalizer._sanitizarPayload(payload)
        }
      };
    }

    // ─── 2. MENSAGEM RECEBIDA / INBOUND OU OUTBOUND ────────────────────────────
    const messageId = String(
      data.messageId ||
      data.id ||
      data.zaapId ||
      payload.messageId ||
      payload.id ||
      payload.zaapId ||
      data.key?.id ||
      payload.key?.id ||
      ''
    ).trim();

    const fromMe = Boolean(data.fromMe ?? payload.fromMe ?? false);
    const direcao = fromMe ? 'outbound' : 'inbound';
    const isGroup = Boolean(data.isGroup ?? payload.isGroup ?? false);
    const instanceId = String(data.instanceId || data.instance || payload.instanceId || payload.instance || '').trim();
    const connectedPhone = VibeWhatsWebhookNormalizer._limparTelefone(
      data.connectedPhone || data.to || payload.connectedPhone || payload.to
    );

    const rawSender = isGroup
      ? (data.participantPhone || payload.participantPhone || data.phone || payload.phone)
      : (data.phone || payload.phone);

    const contactId = VibeWhatsWebhookNormalizer._limparTelefone(rawSender);
    if (!contactId && !messageId) {
      return null; // Payload inválido / sem identificadores
    }

    const contactName = String(
      data.senderName ||
      data.contactName ||
      payload.senderName ||
      payload.contactName ||
      data.name ||
      payload.name ||
      contactId ||
      'Contato'
    ).trim();

    const timestamp = VibeWhatsWebhookNormalizer._normalizarTimestamp(
      data.momment || data.timestamp || payload.momment || payload.timestamp
    );

    // Extração do conteúdo da mensagem
    let mensagemTipo = 'text';
    let conteudo = '';
    let mediaUrl = null;

    if (data.text || payload.text) {
      mensagemTipo = 'text';
      conteudo = typeof data.text === 'object' && data.text?.message !== undefined
        ? String(data.text.message || '')
        : String(data.text || payload.text || '');
    } else if (data.message || payload.message) {
      mensagemTipo = 'text';
      conteudo = typeof data.message === 'object' && data.message?.text !== undefined
        ? String(data.message.text || '')
        : String(data.message || payload.message || '');
    } else if (data.image || payload.image) {
      mensagemTipo = 'image';
      const img = data.image || payload.image;
      mediaUrl = typeof img === 'object' ? (img.imageUrl || img.url || null) : String(img);
      conteudo = '[Imagem VibeWhats]';
    } else if (data.audio || payload.audio) {
      mensagemTipo = 'audio';
      const aud = data.audio || payload.audio;
      mediaUrl = typeof aud === 'object' ? (aud.audioUrl || aud.url || null) : String(aud);
      conteudo = '[Áudio VibeWhats]';
    } else if (data.document || payload.document) {
      mensagemTipo = 'document';
      const doc = data.document || payload.document;
      mediaUrl = typeof doc === 'object' ? (doc.documentUrl || doc.url || null) : String(doc);
      conteudo = '[Documento VibeWhats]';
    } else {
      conteudo = String(data.body || payload.body || '');
    }

    const quotedId = data.quotedMessage?.messageId ||
      data.quotedMessage?.id ||
      payload.quotedMessage?.messageId ||
      payload.quotedMessage?.id ||
      null;

    const rawStatus = data.status || payload.status || (fromMe ? 'SENT' : 'DELIVERED');
    const statusNorm = VibeWhatsWebhookNormalizer._normalizarStatus(rawStatus);

    return {
      tipo: 'mensagem',
      rawType: eventName || 'ReceivedCallback',
      event_id: messageId,
      provider_message_id: messageId,
      provider: 'VIBEWHATS',
      origem: 'vibewhats',
      direcao,
      from: contactId,
      contact_id: contactId,
      contato_nome: contactName,
      to: connectedPhone,
      phone_number_id: connectedPhone || instanceId,
      waba_id: null,
      timestamp,
      status: statusNorm,
      mensagem_tipo: mensagemTipo,
      conteudo: conteudo.trim(),
      media_url: mediaUrl,
      quoted_message_id: quotedId,
      metadata: {
        instanceId,
        isGroup,
        connectedPhone,
        fromMe,
        rawPayload: VibeWhatsWebhookNormalizer._sanitizarPayload(payload)
      }
    };
  }
}

export default VibeWhatsWebhookNormalizer;
