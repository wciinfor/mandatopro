/**
 * Normalizador de eventos oficiais do Webhook WaBlast Partner API
 * 
 * Traduz os eventos brutos recebidos da WaBlast para o formato canônico interno do MandatoPRO.
 * Eventos suportados:
 * - account.connected
 * - message.sent
 * - message.delivered
 * - message.read
 * - message.failed
 * - message.received / inbound
 */

export class WaBlastWebhookNormalizer {
  /**
   * Normaliza um payload bruto recebido da WaBlast
   * @param {Object} payload - Objeto JSON recebido no webhook
   * @returns {Object|null}
   */
  static normalizarEvento(payload) {
    if (!payload || typeof payload !== 'object') return null;

    const eventType = payload.event || payload.type || payload.event_type || '';

    // ─── 1. CONEXÃO DE CONTA (account.connected) ──────────────────────────────
    if (eventType === 'account.connected' || eventType === 'account_connected') {
      const data = payload.data || payload;
      return {
        tipo: 'account.connected',
        rawType: eventType,
        external_ref: data.external_ref || payload.external_ref || null,
        account_id: data.account_id || data.id || payload.account_id || null,
        waba_id: data.waba_id || payload.waba_id || null,
        phone_number: data.phone_number || data.display_phone_number || null,
        phone_number_id: data.phone_number_id || null,
        verified_name: data.verified_name || data.display_name || null,
        status: data.status || 'connected',
        timestamp: payload.timestamp || data.timestamp || new Date().toISOString()
      };
    }

    // ─── 2. STATUS DE MENSAGEM (sent, delivered, read, failed) ─────────────────
    // Exclui message.received explicitamente para que seja tratado pelo bloco de INBOUND (Bloco 3)
    if (
      (eventType.startsWith('message.') && eventType !== 'message.received') ||
      (eventType.startsWith('messages.') && eventType !== 'messages.inbound') ||
      eventType === 'message_status'
    ) {
      const data = payload.data || payload;
      let statusNorm = 'sent';

      const subType = eventType.replace(/^messages?\./, '').toLowerCase();
      if (['delivered', 'entregue'].includes(subType) || data.status === 'delivered') {
        statusNorm = 'delivered';
      } else if (['read', 'lida', 'viewed'].includes(subType) || data.status === 'read') {
        statusNorm = 'read';
      } else if (['failed', 'falhou', 'error'].includes(subType) || data.status === 'failed') {
        statusNorm = 'failed';
      } else if (['sent', 'enviada'].includes(subType) || data.status === 'sent') {
        statusNorm = 'sent';
      }

      const providerMessageId = data.id || data.message_id || data.wamid || payload.id || null;
      const recipient = data.to || data.recipient || data.phone || payload.to || null;

      return {
        tipo: 'status',
        rawType: eventType,
        status: statusNorm,
        provider_message_id: providerMessageId,
        contact_id: recipient,
        timestamp: payload.timestamp || data.timestamp || new Date().toISOString(),
        erro: statusNorm === 'failed' ? (data.error || data.failure_reason || data.message || 'Falha no envio') : null
      };
    }

    // ─── 3. MENSAGEM RECEBIDA (INBOUND) ────────────────────────────────────────
    if (eventType === 'message.received' || eventType === 'messages.inbound' || payload.messages) {
      const data = payload.data || (payload.messages && payload.messages[0]) || payload;
      const msgObj = data.message || (data.messages && data.messages[0]) || data;

      const providerMessageId = msgObj.id 
        || msgObj.message_id 
        || msgObj.meta_message_id 
        || msgObj.wamid 
        || data.id 
        || data.message_id 
        || data.meta_message_id 
        || data.wamid 
        || payload.id 
        || null;

      const rawSender = msgObj.from 
        || msgObj.sender 
        || msgObj.sender_phone 
        || data.from 
        || data.sender 
        || data.sender_phone 
        || payload.from 
        || null;

      // Normaliza o telefone do remetente (apenas dígitos) para compatibilidade com a Central e banco
      const cleanSender = rawSender ? String(rawSender).replace(/\D+/g, '') : null;

      let textContent = '';
      if (typeof msgObj.text === 'object' && msgObj.text?.body) {
        textContent = msgObj.text.body;
      } else if (typeof data.text === 'object' && data.text?.body) {
        textContent = data.text.body;
      } else if (msgObj.text && typeof msgObj.text === 'string') {
        textContent = msgObj.text;
      } else if (msgObj.body) {
        textContent = msgObj.body;
      } else if (msgObj.content) {
        textContent = msgObj.content;
      } else if (data.text && typeof data.text === 'string') {
        textContent = data.text;
      } else if (data.body) {
        textContent = data.body;
      } else if (data.content) {
        textContent = data.content;
      }

      const senderName = msgObj.contact_name 
        || msgObj.sender_name 
        || data.contact_name 
        || data.sender_name 
        || data.name 
        || cleanSender 
        || 'Contato';

      return {
        tipo: 'mensagem',
        rawType: eventType,
        provider_message_id: providerMessageId,
        contact_id: cleanSender,
        contato_nome: senderName,
        timestamp: payload.timestamp || data.timestamp || msgObj.timestamp || new Date().toISOString(),
        mensagem_tipo: msgObj.type || data.type || 'text',
        conteudo: textContent,
        media_id: msgObj.media_id || data.media_id || null,
        waba_id: data.waba_id || payload.waba_id || null,
        phone_number_id: data.phone_number_id || payload.phone_number_id || null
      };
    }

    // Evento genérico ou desconhecido
    return {
      tipo: 'desconhecido',
      rawType: eventType,
      raw: payload
    };
  }
}

export default WaBlastWebhookNormalizer;
