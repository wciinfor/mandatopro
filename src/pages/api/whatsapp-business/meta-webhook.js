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
import { MetaWebhookNormalizer } from '@/services/metaWebhookNormalizer';
import { ConversasService } from '@/services/conversasService';

export const config = {
  api: {
    bodyParser: false
  }
};

/**
 * Valida a assinatura HMAC SHA-256 enviada pela Meta no cabeçalho x-hub-signature-256
 * contra o RAW body original da requisição HTTP e o META_APP_SECRET da aplicação.
 */
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

/**
 * Executa o processamento do evento de negócio (mensagens ou alterações de status)
 * após ter sua assinatura validada e metadados gravados em log.
 */
async function processarEventoNegocioMeta(payload) {
  if (!payload || !payload.object || !payload.entry || payload.entry.length === 0) {
    return { success: false, reason: 'Payload sem formato Meta esperado' };
  }

  const entry = payload.entry[0];
  const wabaId = entry.id || null;

  if (!entry.changes || entry.changes.length === 0) {
    return { success: true, processedCount: 0 };
  }

  let processados = 0;

  for (const change of entry.changes) {
    const value = change.value;
    if (!value) continue;

    const phoneNumberId = value?.metadata?.phone_number_id || null;

    // Trata Mensagens Inbound
    if (value.messages && value.messages.length > 0) {
      const msgNormalizada = MetaWebhookNormalizer.normalizarMensagem(value);
      if (msgNormalizada) {
        msgNormalizada.waba_id = wabaId;
        msgNormalizada.phone_number_id = phoneNumberId;
        console.log(`[META WEBHOOK OFICIAL] Processando mensagem wamid=${msgNormalizada.provider_message_id} de=${msgNormalizada.contact_id}`);
        await ConversasService.processarEventoMeta(msgNormalizada);
        processados++;
      }
    }

    // Trata Statuses (sent, delivered, read, failed)
    if (value.statuses && value.statuses.length > 0) {
      const statusNormalizado = MetaWebhookNormalizer.normalizarStatus(value);
      if (statusNormalizado) {
        statusNormalizado.waba_id = wabaId;
        statusNormalizado.phone_number_id = phoneNumberId;
        console.log(`[META WEBHOOK OFICIAL] Processando status wamid=${statusNormalizado.provider_message_id} status=${statusNormalizado.status}`);
        await ConversasService.processarEventoMeta(statusNormalizado);
        processados++;
      }
    }
  }

  return { success: true, processedCount: processados };
}

/**
 * Handler oficial unificado para Webhook da Meta Cloud API (GET e POST).
 */
export default async function handler(req, res) {
  const supabase = createServerClient();

  // 1. ENDPOINT GET: Verificação segura do callback (hub.challenge) via verify_token no banco de dados
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const verifyToken = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode !== 'subscribe' || !verifyToken || !challenge) {
      return res.status(403).send('Forbidden');
    }

    const conta = await buscarContaWhatsappPorVerifyToken(supabase, verifyToken);
    if (!conta) {
      console.warn('[META WEBHOOK] Tentativa de verificação GET com verify_token inválido ou não cadastrado no banco.');
      return res.status(403).send('Forbidden');
    }

    await atualizarWebhookContaWhatsapp(supabase, conta.id, conta.tenant_id, {
      webhook_pending: false,
      webhook_verified: true,
      webhook_last_verified_at: new Date().toISOString(),
      webhook_validation_message: 'Webhook validado pela Meta com sucesso.'
    });

    console.log(`[META WEBHOOK] Verify token validado com sucesso para tenant ${conta.tenant_id} (Conta ${conta.id}).`);
    return res.status(200).send(String(challenge));
  }

  // 2. ENDPOINT POST: Recepção protegida por HMAC SHA-256, Auditoria e Processamento de Negócio
  if (req.method === 'POST') {
    const rawBody = await readRawBody(req);
    const payload = parseJson(rawBody);

    // Valida a assinatura HMAC SHA-256 usando o RAW BODY original da requisição HTTP
    const signatureStatus = validarAssinatura(
      rawBody,
      req.headers['x-hub-signature-256'],
      process.env.META_APP_SECRET
    );

    const routing = extractWebhookRouting(payload);
    const conta = await buscarContaWhatsappPorWabaOuNumero(supabase, routing);
    const logger = createWhatsAppWebhookEventLogger(supabase);

    // Grava o log de auditoria do evento recebido com status da assinatura
    await logger.log({
      conta,
      payload,
      validationStatus: signatureStatus === 'VALID' ? 'VALID' : 'INVALID',
      signatureStatus
    });

    // BLOQUEIO RIGOROSO: Se a assinatura HMAC SHA-256 for ausente ou inválida, interrompe imediatamente
    if (signatureStatus !== 'VALID') {
      console.warn(`[META WEBHOOK SECURITY] Requisição POST rejeitada devido a assinatura HMAC ${signatureStatus}.`);
      return res.status(401).json({ error: 'Assinatura HMAC SHA-256 ausente ou inválida', signatureStatus });
    }

    if (conta?.id && conta?.tenant_id) {
      await atualizarWebhookContaWhatsapp(supabase, conta.id, conta.tenant_id, {
        webhook_pending: false,
        webhook_receiving_events: true,
        webhook_last_event_at: new Date().toISOString(),
        webhook_last_signature_status: signatureStatus,
        webhook_validation_message: 'Evento recebido e autenticado com assinatura HMAC válida.'
      });
    }

    // Processa a regra de negócio (Atualização de mensagens e status de comunicação oficial)
    const resultadoNegocio = await processarEventoNegocioMeta(payload);

    return res.status(200).json({
      success: true,
      processed: resultadoNegocio.processedCount || 0
    });
  }

  return res.status(405).json({ error: 'Método não permitido' });
}

