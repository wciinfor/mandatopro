import { MetaWebhookNormalizer } from '@/services/metaWebhookNormalizer';
import { ConversasService } from '@/services/conversasService';

/**
 * API Handler oficial para receber e tratar Webhooks da Meta Cloud API.
 * Suporta GET (validação de token) e POST (recebimento de mensagens e status de envio).
 */
export default async function handler(req, res) {
  // 1. ENDPOINT GET: Verificação de Token de Validação da Meta
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const verifyToken = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const localVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'mandatopro_token_webhook';

    if (mode === 'subscribe' && verifyToken === localVerifyToken) {
      console.log('[MetaWebhook] Validação do verify_token efetuada com sucesso!');
      return res.status(200).send(challenge);
    } else {
      console.warn('[MetaWebhook] Falha de validação do verify_token da Meta.');
      return res.status(403).json({ error: 'Verification token mismatch or invalid mode' });
    }
  }

  // 2. ENDPOINT POST: Recepção de Eventos de Mensagens e Status de Envio
  if (req.method === 'POST') {
    const payload = req.body;

    console.log('[META WEBHOOK] evento recebido object=' + payload?.object);

    if (!payload.object || !payload.entry || payload.entry.length === 0) {
      return res.status(400).json({ error: 'Payload sem formato Meta esperado' });
    }

    try {
      const entry = payload.entry[0];
      // wabaId vem em entry.id no payload da Meta Cloud API
      const wabaId = entry.id || null;

      if (entry.changes && entry.changes.length > 0) {
        const change = entry.changes[0];
        const value = change.value;
        // phoneNumberId vem em value.metadata.phone_number_id
        const phoneNumberId = value?.metadata?.phone_number_id || null;

        // Trata Mensagens
        if (value.messages && value.messages.length > 0) {
          const msgNormalizada = MetaWebhookNormalizer.normalizarMensagem(value);
          if (msgNormalizada) {
            // Enriquece o evento com waba_id e phone_number_id para resolução do tenant
            msgNormalizada.waba_id = wabaId;
            msgNormalizada.phone_number_id = phoneNumberId;
            console.log('[META WEBHOOK] mensagem normalizada wamid=' + msgNormalizada.provider_message_id + ' de=' + msgNormalizada.contact_id);
            await ConversasService.processarEventoMeta(msgNormalizada);
            console.log('[META WEBHOOK] processamento concluído wamid=' + msgNormalizada.provider_message_id);
          }
        }

        // Trata Statuses
        if (value.statuses && value.statuses.length > 0) {
          const statusNormalizado = MetaWebhookNormalizer.normalizarStatus(value);
          if (statusNormalizado) {
            statusNormalizado.waba_id = wabaId;
            statusNormalizado.phone_number_id = phoneNumberId;
            console.log('[META WEBHOOK] status normalizado wamid=' + statusNormalizado.provider_message_id + ' status=' + statusNormalizado.status);
            await ConversasService.processarEventoMeta(statusNormalizado);
          }
        }
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('[META WEBHOOK] erro no processamento do evento da Meta:', err);
      return res.status(500).json({ error: 'Erro interno no processamento' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
