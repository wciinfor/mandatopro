import crypto from 'crypto';
import { createServerClient } from '@/lib/supabase-server';
import {
  atualizarWebhookContaWhatsapp,
  buscarContaWhatsappPorVerifyToken,
  buscarContaWhatsappPorWabaOuNumero
} from '@/lib/whatsapp-business-accounts';
import { readRawBody } from '@/lib/raw-body';
import {
  createWhatsAppWebhookEventLogger,
  extractWebhookRouting
} from '@/services/whatsapp-webhook-event-logger';

export const config = {
  api: {
    bodyParser: false
  }
};

function validarAssinatura(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader) return 'MISSING';
  if (!appSecret) return 'INVALID';

  const expected = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`;

  const received = String(signatureHeader || '');
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) return 'INVALID';
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer) ? 'VALID' : 'INVALID';
}

function parseJson(rawBody) {
  try {
    return JSON.parse(rawBody.toString('utf8') || '{}');
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  const supabase = createServerClient();

  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const verifyToken = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode !== 'subscribe' || !verifyToken || !challenge) {
      return res.status(403).send('Forbidden');
    }

    const conta = await buscarContaWhatsappPorVerifyToken(supabase, verifyToken);
    if (!conta) {
      return res.status(403).send('Forbidden');
    }

    await atualizarWebhookContaWhatsapp(supabase, conta.id, conta.tenant_id, {
      webhook_pending: false,
      webhook_verified: true,
      webhook_last_verified_at: new Date().toISOString(),
      webhook_validation_message: 'Webhook validado pela Meta.'
    });

    return res.status(200).send(String(challenge));
  }

  if (req.method === 'POST') {
    const rawBody = await readRawBody(req);
    const payload = parseJson(rawBody);
    const signatureStatus = validarAssinatura(
      rawBody,
      req.headers['x-hub-signature-256'],
      process.env.META_APP_SECRET
    );
    const routing = extractWebhookRouting(payload);
    const conta = await buscarContaWhatsappPorWabaOuNumero(supabase, routing);
    const logger = createWhatsAppWebhookEventLogger(supabase);

    await logger.log({
      conta,
      payload,
      validationStatus: signatureStatus === 'VALID' ? 'VALID' : 'INVALID',
      signatureStatus
    });

    if (signatureStatus !== 'VALID') {
      return res.status(200).json({ success: true, ignored: true });
    }

    if (conta?.id && conta?.tenant_id) {
      await atualizarWebhookContaWhatsapp(supabase, conta.id, conta.tenant_id, {
        webhook_pending: false,
        webhook_receiving_events: true,
        webhook_last_event_at: new Date().toISOString(),
        webhook_last_signature_status: signatureStatus,
        webhook_validation_message: 'Evento recebido com assinatura valida.'
      });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}
