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

    console.log('[MetaWebhook] Evento bruto recebido:', JSON.stringify(payload, null, 2));

    if (!payload.object || !payload.entry || payload.entry.length === 0) {
      return res.status(400).json({ error: 'Payload sem formato Meta esperado' });
    }

    try {
      const entry = payload.entry[0];
      if (entry.changes && entry.changes.length > 0) {
        const change = entry.changes[0];
        const value = change.value;

        // Trata Mensagens
        if (value.messages && value.messages.length > 0) {
          const msgNormalizada = MetaWebhookNormalizer.normalizarMensagem(value);
          if (msgNormalizada) {
            await ConversasService.processarEventoMeta(msgNormalizada);
          }
        }

        // Trata Statuses
        if (value.statuses && value.statuses.length > 0) {
          const statusNormalizado = MetaWebhookNormalizer.normalizarStatus(value);
          if (statusNormalizado) {
            await ConversasService.processarEventoMeta(statusNormalizado);
          }
        }
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('[MetaWebhook] Erro no processamento do evento da Meta:', err);
      return res.status(500).json({ error: 'Erro interno no processamento' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
