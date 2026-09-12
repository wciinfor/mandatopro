/**
 * Normalizador de eventos oficiais do Webhook WAFLY WhatsApp Bridge API
 * 
 * Traduz os callbacks brutos recebidos da Wafly para o formato canônico interno do MandatoPRO.
 * 
 * Callbacks suportados:
 * - ReceivedCallback (Mensagens inbound/outbound individuais ou em grupo, com texto, áudio, imagem, documento, vídeo)
 * - MessageStatusCallback (Alteração de status de mensagens: SENT, DELIVERED, READ, FAILED)
 * - DeliveryCallback (Confirmação de entrega)
 * - ConnectedCallback (Instância conectada ao WhatsApp)
 * - DisconnectedCallback (Instância desconectada com motivo)
 * 
 * Todos os segredos e credenciais são mascarados para auditoria segura.
 */

export class WaflyWebhookNormalizer {
  /**
   * Converte timestamps em milissegundos (ou segundos / strings) para ISO 8601
   * @private
   */
  static _normalizarTimestamp(val) {
    if (!val) return new Date().toISOString();
    if (typeof val === 'string' && val.includes('T')) return val;
    const num = Number(val);
    if (!Number.isFinite(num) || num <= 0) return new Date().toISOString();
    // Se o valor estiver em segundos (menor que 10^11), converte para ms
    const ms = num < 100000000000 ? num * 1000 : num;
    return new Date(ms).toISOString();
  }

  /**
   * Limpa telefone mantendo apenas dígitos
   * @private
   */
  static _limparTelefone(phone) {
    if (!phone) return null;
    const clean = String(phone).replace(/\D+/g, '');
    return clean || null;
  }

  /**
   * Remove chaves e tokens confidenciais do payload bruto para auditoria segura
   * @private
   */
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

  /**
   * Mapeia status bruto da Wafly para o padrão canônico do MandatoPRO
   * SENT -> sent
   * DELIVERED -> delivered
   * READ -> read
   * FAILED / ERROR -> failed
   * @private
   */
  static _normalizarStatus(statusRaw) {
    const s = String(statusRaw || '').toUpperCase();
    if (s === 'SENT' || s === 'ENVIADA' || s === 'ENVIADO') return 'sent';
    if (s === 'DELIVERED' || s === 'ENTREGUE') return 'delivered';
    if (s === 'READ' || s === 'LIDA' || s === 'LIDO' || s === 'VIEWED') return 'read';
    if (s === 'FAILED' || s === 'ERROR' || s === 'FALHOU' || s === 'FALHA') return 'failed';
    return s.toLowerCase() || 'sent';
  }

  /**
   * Normaliza qualquer evento do webhook Wafly para o contrato canônico
   * @param {Object} payload - Objeto bruto recebido no corpo da requisição HTTP
   * @returns {Object|null} Objeto canônico normalizado
   */
  static normalizarEvento(payload) {
    if (!payload || typeof payload !== 'object') return null;

    const data = payload.data || payload;
    const eventName = String(payload.event || payload.type || payload.event_type || payload.callback || '').trim();

    // ─── 1. EVENTOS DE CONEXÃO (ConnectedCallback / DisconnectedCallback) ─────
    if (
      eventName === 'ConnectedCallback' ||
      eventName === 'update-webhook-connected' ||
      eventName === 'connected' ||
      payload.connected === true
    ) {
      const instanceId = String(data.instanceId || data.instance || payload.instanceId || payload.instance || '').trim();
      const connectedPhone = WaflyWebhookNormalizer._limparTelefone(data.connectedPhone || data.phone || payload.connectedPhone || payload.phone);
      const timestamp = WaflyWebhookNormalizer._normalizarTimestamp(data.momment || data.timestamp || payload.momment || payload.timestamp);

      return {
        tipo: 'account.connected',
        rawType: eventName || 'ConnectedCallback',
        provider: 'WAFLY',
        instanceId: instanceId || null,
        connectedPhone: connectedPhone || null,
        status: 'connected',
        timestamp,
        metadata: {
          instanceId,
          connectedPhone,
          rawPayload: WaflyWebhookNormalizer._sanitizarPayload(payload)
        }
      };
    }

    if (
      eventName === 'DisconnectedCallback' ||
      eventName === 'update-webhook-disconnected' ||
      eventName === 'disconnected' ||
      payload.disconnected === true
    ) {
      const instanceId = String(data.instanceId || data.instance || payload.instanceId || payload.instance || '').trim();
      const connectedPhone = WaflyWebhookNormalizer._limparTelefone(data.connectedPhone || data.phone || payload.connectedPhone || payload.phone);
      const timestamp = WaflyWebhookNormalizer._normalizarTimestamp(data.momment || data.timestamp || payload.momment || payload.timestamp);
      const reason = data.reason || data.disconnectionReason || payload.reason || 'UNKNOWN_DISCONNECTION';

      return {
        tipo: 'account.disconnected',
        rawType: eventName || 'DisconnectedCallback',
        provider: 'WAFLY',
        instanceId: instanceId || null,
        connectedPhone: connectedPhone || null,
        status: 'disconnected',
        reason: String(reason),
        timestamp,
        metadata: {
          instanceId,
          connectedPhone,
          reason: String(reason),
          rawPayload: WaflyWebhookNormalizer._sanitizarPayload(payload)
        }
      };
    }

    // ─── 2. STATUS E ENTREGA (MessageStatusCallback / DeliveryCallback) ────────
    const isStatusEvent =
      eventName === 'MessageStatusCallback' ||
      eventName === 'DeliveryCallback' ||
      eventName === 'update-webhook-delivery' ||
      eventName === 'message_status' ||
      eventName === 'delivery' ||
      Boolean(data.status && !data.text && (data.messageId || data.id));

    if (isStatusEvent) {
      const rawStatus = eventName === 'DeliveryCallback' || eventName === 'update-webhook-delivery'
        ? 'DELIVERED'
        : (data.status || payload.status || 'SENT');

      const statusNorm = WaflyWebhookNormalizer._normalizarStatus(rawStatus);
      const messageId = String(data.messageId || data.id || payload.messageId || payload.id || '').trim();
      const recipientPhone = WaflyWebhookNormalizer._limparTelefone(data.phone || data.recipient || data.to || payload.phone || payload.recipient || payload.to);
      const timestamp = WaflyWebhookNormalizer._normalizarTimestamp(data.momment || data.timestamp || payload.momment || payload.timestamp);
      const instanceId = String(data.instanceId || data.instance || payload.instanceId || payload.instance || '').trim();
      const errorDetail = statusNorm === 'failed'
        ? (data.error || data.reason || data.failure_reason || payload.error || 'Falha no envio WAFLY')
        : null;

      return {
        tipo: 'status',
        rawType: eventName || 'MessageStatusCallback',
        event_id: messageId,
        provider_message_id: messageId,
        provider: 'WAFLY',
        origem: 'wafly',
        status: statusNorm,
        contact_id: recipientPhone,
        timestamp,
        erro: errorDetail,
        metadata: {
          instanceId,
          rawPayload: WaflyWebhookNormalizer._sanitizarPayload(payload)
        }
      };
    }

    // ─── 3. MENSAGEM RECEBIDA / INBOUND OU OUTBOUND (ReceivedCallback) ──────────
    const messageId = String(
      data.messageId ||
      data.id ||
      payload.messageId ||
      payload.id ||
      data.key?.id ||
      payload.key?.id ||
      ''
    ).trim();

    const fromMe = Boolean(data.fromMe ?? payload.fromMe ?? false);
    const direcao = fromMe ? 'outbound' : 'inbound';

    const isGroup = Boolean(data.isGroup ?? payload.isGroup ?? false);
    const instanceId = String(data.instanceId || data.instance || payload.instanceId || payload.instance || '').trim();
    const connectedPhone = WaflyWebhookNormalizer._limparTelefone(
      data.connectedPhone || data.to || payload.connectedPhone || payload.to
    );

    // Identificação do remetente (from):
    // Em conversa privada -> phone
    // Em grupo -> participantPhone quando disponível, ou phone
    const rawSender = isGroup
      ? (data.participantPhone || payload.participantPhone || data.phone || payload.phone)
      : (data.phone || payload.phone);

    const contactId = WaflyWebhookNormalizer._limparTelefone(rawSender);
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

    const timestamp = WaflyWebhookNormalizer._normalizarTimestamp(
      data.momment || data.timestamp || payload.momment || payload.timestamp
    );

    // Extração do tipo e conteúdo de mídia/texto
    let mensagemTipo = 'text';
    let conteudo = '';
    let mediaUrl = null;
    let audioUrl = null;
    let imageUrl = null;
    let documentUrl = null;
    let videoUrl = null;
    let transcriptionText = null;

    // A) Texto
    if (data.text || payload.text) {
      mensagemTipo = 'text';
      conteudo = typeof data.text === 'object' && data.text?.message !== undefined
        ? String(data.text.message || '')
        : (typeof payload.text === 'object' && payload.text?.message !== undefined
            ? String(payload.text.message || '')
            : String(data.text || payload.text || ''));
    } else if (data.message || payload.message) {
      mensagemTipo = 'text';
      conteudo = String(data.message || payload.message || '');
    }

    // B) Áudio
    const audioObj = data.audio || payload.audio;
    if (audioObj) {
      mensagemTipo = 'audio';
      audioUrl = typeof audioObj === 'object'
        ? (audioObj.audioUrl || audioObj.audio || audioObj.url || null)
        : String(audioObj);
      mediaUrl = audioUrl;
      conteudo = `[Áudio Wafly]${audioUrl ? ' ' + audioUrl : ''}`;

      const transObj = data.transcription || payload.transcription || (typeof audioObj === 'object' ? audioObj.transcription : null);
      if (transObj) {
        transcriptionText = typeof transObj === 'object' ? (transObj.text || null) : String(transObj);
        if (transcriptionText) {
          conteudo = `[Áudio transcrito]: ${transcriptionText}`;
        }
      }
    }

    // C) Imagem
    const imageObj = data.image || payload.image;
    if (imageObj) {
      mensagemTipo = 'image';
      imageUrl = typeof imageObj === 'object'
        ? (imageObj.imageUrl || imageObj.image || imageObj.url || null)
        : String(imageObj);
      mediaUrl = imageUrl;
      const caption = typeof imageObj === 'object' ? (imageObj.caption || '') : '';
      conteudo = `[Imagem Wafly]${caption ? ' - ' + caption : ''}${imageUrl ? ' ' + imageUrl : ''}`;
    }

    // D) Documento
    const docObj = data.document || payload.document;
    if (docObj) {
      mensagemTipo = 'document';
      documentUrl = typeof docObj === 'object'
        ? (docObj.documentUrl || docObj.document || docObj.url || null)
        : String(docObj);
      mediaUrl = documentUrl;
      const fileName = typeof docObj === 'object' ? (docObj.fileName || docObj.filename || '') : '';
      conteudo = `[Documento Wafly]${fileName ? ' ' + fileName : ''}${documentUrl ? ' ' + documentUrl : ''}`;
    }

    // E) Vídeo
    const videoObj = data.video || payload.video;
    if (videoObj) {
      mensagemTipo = 'video';
      videoUrl = typeof videoObj === 'object'
        ? (videoObj.videoUrl || videoObj.video || videoObj.url || null)
        : String(videoObj);
      mediaUrl = videoUrl;
      const caption = typeof videoObj === 'object' ? (videoObj.caption || '') : '';
      conteudo = `[Vídeo Wafly]${caption ? ' - ' + caption : ''}${videoUrl ? ' ' + videoUrl : ''}`;
    }

    // Quoted / Reply
    const quotedId = data.quotedMessage?.messageId ||
      data.quotedMessage?.id ||
      payload.quotedMessage?.messageId ||
      payload.quotedMessage?.id ||
      data.context?.quotedMessageId ||
      payload.context?.quotedMessageId ||
      null;

    const rawStatus = data.status || payload.status || (fromMe ? 'SENT' : 'DELIVERED');
    const statusNorm = WaflyWebhookNormalizer._normalizarStatus(rawStatus);

    return {
      tipo: 'mensagem',
      rawType: eventName || 'ReceivedCallback',
      event_id: messageId,
      provider_message_id: messageId,
      provider: 'WAFLY',
      origem: 'wafly',
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
      conteudo,
      media_url: mediaUrl,
      audio_url: audioUrl,
      image_url: imageUrl,
      document_url: documentUrl,
      video_url: videoUrl,
      transcription: transcriptionText,
      quoted_message_id: quotedId,
      metadata: {
        instanceId,
        isGroup,
        participantPhone: isGroup ? contactId : null,
        connectedPhone,
        fromMe,
        rawPayload: WaflyWebhookNormalizer._sanitizarPayload(payload)
      }
    };
  }
}

export default WaflyWebhookNormalizer;
