import crypto from 'crypto';
import { createServerClient } from '@/lib/supabase-server';
import { readRawBody } from '@/lib/raw-body';
import {
  buscarContaWhatsappPorYCloudEndpointId,
  atualizarWebhookContaWhatsapp
} from '@/lib/whatsapp-business-accounts';
import { createWhatsAppWebhookEventLogger } from '@/services/whatsapp-webhook-event-logger';
import { normalizarTelefone } from '@/lib/atendimento-connect';

export const config = {
  api: {
    bodyParser: false
  }
};

/**
  Valida a assinatura YCloud-Signature: t=TIMESTAMP,s=SIGNATURE
  Calcula HMAC-SHA256 de `${timestamp}.${rawBody}` usando ycloud_webhook_secret
 */
function validarAssinaturaYCloud(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return { status: 'MISSING', reason: 'Header YCloud-Signature ausente' };
  if (!secret) return { status: 'INVALID', reason: 'Secret não configurado' };

  // Parse YCloud-Signature: t=TIMESTAMP,s=SIGNATURE
  const parts = String(signatureHeader || '').split(',');
  let timestamp = '';
  let receivedSignature = '';

  for (const part of parts) {
    const [key, val] = part.split('=');
    if (key?.trim() === 't') timestamp = val?.trim() || '';
    if (key?.trim() === 's') receivedSignature = val?.trim() || '';
  }

  if (!timestamp || !receivedSignature) {
    return { status: 'INVALID', reason: 'Formato de assinatura YCloud-Signature inválido' };
  }

  // Prevenção contra replay (tolerância de 5 minutos = 300s)
  const nowInSec = Math.floor(Date.now() / 1000);
  const tsNum = Number(timestamp);
  if (Number.isFinite(tsNum) && Math.abs(nowInSec - tsNum) > 300) {
    return { status: 'INVALID', reason: 'Timestamp de webhook expirado (replay attack)' };
  }

  const payloadToSign = `${timestamp}.${rawBody.toString('utf8')}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadToSign)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const receivedBuffer = Buffer.from(receivedSignature, 'utf8');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return { status: 'INVALID', reason: 'Comprimento de assinatura divergente' };
  }

  const isMatch = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  return {
    status: isMatch ? 'VALID' : 'INVALID',
    reason: isMatch ? 'Assinatura válida' : 'Assinatura divergente'
  };
}

function parseJson(rawBody) {
  try {
    return JSON.parse(rawBody.toString('utf8') || '{}');
  } catch {
    return {};
  }
}

/**
 * Normaliza mensagens do status para evitar regressão
 */
const STATUS_PRIORITY = {
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4
};

function deveAtualizarStatus(statusAtual, novoStatus) {
  const pAtual = STATUS_PRIORITY[String(statusAtual).toLowerCase()] || 0;
  const pNovo = STATUS_PRIORITY[String(novoStatus).toLowerCase()] || 0;
  // Permite atualizar se o novo status tiver prioridade maior ou igual (ou se for novo)
  return pNovo >= pAtual;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const endpointId = req.headers['x-webhook-endpoint-id'] || req.headers['X-Webhook-Endpoint-ID'];
  if (!endpointId) {
    return res.status(404).json({ error: 'Endpoint ID ausente' });
  }

  const supabase = createServerClient();

  // 1. Localizar conta YCloud pelo endpoint ID e validar provider = YCLOUD
  const conta = await buscarContaWhatsappPorYCloudEndpointId(supabase, endpointId);
  if (!conta || conta.provider !== 'YCLOUD') {
    return res.status(404).json({ error: 'Conta YCloud não encontrada para este Endpoint ID' });
  }

  // 2. Ler raw body e validar assinatura HMAC
  const rawBody = await readRawBody(req);
  const payload = parseJson(rawBody);
  const signatureHeader = req.headers['ycloud-signature'] || req.headers['YCloud-Signature'];

  const signatureResult = validarAssinaturaYCloud(
    rawBody,
    signatureHeader,
    conta.ycloud_webhook_secret
  );

  const logger = createWhatsAppWebhookEventLogger(supabase);
  const eventId = payload.id || null;

  // Log de auditoria (sem vazar secrets)
  await logger.log({
    conta,
    payload,
    validationStatus: signatureResult.status === 'VALID' ? 'VALID' : 'INVALID',
    signatureStatus: signatureResult.status,
    eventId
  });

  if (signatureResult.status !== 'VALID') {
    return res.status(401).json({ error: 'Assinatura inválida', reason: signatureResult.reason });
  }

  // 3. Checar Idempotência pelo event.id
  if (eventId) {
    const { data: eventoExistente } = await supabase
      .from('whatsapp_business_webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .eq('validation_status', 'VALID')
      .neq('id', logger.lastInsertedId || 0) // desconsidera o log recém inserido se houver
      .limit(2);

    if (eventoExistente && eventoExistente.length > 1) {
      return res.status(200).json({ success: true, duplicate: true });
    }
  }

  // Atualizar sinalizadores da conta
  await atualizarWebhookContaWhatsapp(supabase, conta.id, conta.tenant_id, {
    webhook_pending: false,
    webhook_receiving_events: true,
    webhook_last_event_at: new Date().toISOString(),
    webhook_last_signature_status: signatureResult.status,
    webhook_validation_message: 'Evento YCloud recebido com assinatura válida'
  });

  try {
    const eventType = payload.type || (payload.whatsappInboundMessage ? 'whatsapp.inbound_message.received' : payload.whatsappMessage ? 'whatsapp.message.updated' : null);

    // 4. Processar Evento: Mensagem Recebida (whatsapp.inbound_message.received)
    if (eventType === 'whatsapp.inbound_message.received' || payload.whatsappInboundMessage) {
      const inbound = payload.whatsappInboundMessage || {};
      const wamid = inbound.wamid || inbound.id || payload.id;
      const telefoneBruto = inbound.from || '';
      const contatoTelefone = normalizarTelefone(telefoneBruto);
      const contatoNome = inbound.customerProfile?.name || 'Contato sem nome';
      const mensagemTexto = inbound.text?.body || (typeof inbound.text === 'string' ? inbound.text : '') || '[Mensagem Mídia/Outro]';
      const fromUserId = inbound.fromUserId || null; // BSUID

      if (contatoTelefone) {
        // Tentar vincular eleitor existente por telefone se a tabela/API permitir
        const { data: eleitor } = await supabase
          .from('eleitores')
          .select('id, nome')
          .or(`telefone.eq.${contatoTelefone},celular.eq.${contatoTelefone}`)
          .maybeSingle();

        // Localizar ou Criar Conversa em atendimento_connect_conversas
        const { data: conversaExistente } = await supabase
          .from('atendimento_connect_conversas')
          .select('*')
          .eq('canal', 'whatsapp')
          .eq('contato_telefone', contatoTelefone)
          .maybeSingle();

        const now = new Date().toISOString();
        let conversaId = conversaExistente?.id || null;

        const metadataPayload = {
          origem: 'ycloud',
          wabaId: inbound.wabaId || conta.waba_id,
          bsuid: fromUserId || null,
          fromUserId: fromUserId || null,
          eleitorEncontrado: Boolean(eleitor?.id)
        };

        if (!conversaExistente) {
          const { data: novaConversa, error: errConv } = await supabase
            .from('atendimento_connect_conversas')
            .insert({
              eleitor_id: eleitor?.id || null,
              contato_nome: eleitor?.nome || contatoNome,
              contato_telefone: contatoTelefone,
              canal: 'whatsapp',
              status: 'nova',
              unread_count: 1,
              ultima_mensagem: mensagemTexto,
              ultima_mensagem_em: now,
              metadata: metadataPayload
            })
            .select('id')
            .single();

          if (!errConv) conversaId = novaConversa?.id;
        } else {
          await supabase
            .from('atendimento_connect_conversas')
            .update({
              eleitor_id: conversaExistente.eleitor_id || eleitor?.id || null,
              contato_nome: conversaExistente.contato_nome || eleitor?.nome || contatoNome,
              status: conversaExistente.status === 'concluida' ? 'nova' : conversaExistente.status,
              unread_count: (conversaExistente.unread_count || 0) + 1,
              ultima_mensagem: mensagemTexto,
              ultima_mensagem_em: now,
              metadata: { ...(conversaExistente.metadata || {}), ...metadataPayload },
              updated_at: now
            })
            .eq('id', conversaExistente.id);
        }

        // Registrar mensagem em atendimento_connect_mensagens
        if (conversaId) {
          await supabase.from('atendimento_connect_mensagens').insert({
            conversa_id: conversaId,
            direcao: 'entrada',
            mensagem: mensagemTexto,
            provider_message_id: wamid,
            status: 'received',
            raw_payload: {
              ...payload,
              fromUserId,
              bsuid: fromUserId
            }
          });
        }
      }
    }

    // 5. Processar Evento: Status de Mensagem (whatsapp.message.updated)
    if (eventType === 'whatsapp.message.updated' || payload.whatsappMessage) {
      const msgStatus = payload.whatsappMessage || {};
      const wamid = msgStatus.wamid || msgStatus.id || payload.id;
      const novoStatus = String(msgStatus.status || '').toLowerCase();
      const recipientUserId = msgStatus.recipientUserId || null; // BSUID
      const parentRecipientUserId = msgStatus.parentRecipientUserId || null;

      if (wamid && novoStatus) {
        // Buscar mensagem enviada pelo provider_message_id
        const { data: mensagemExistente } = await supabase
          .from('atendimento_connect_mensagens')
          .select('id, status, raw_payload')
          .eq('provider_message_id', wamid)
          .maybeSingle();

        if (mensagemExistente && deveAtualizarStatus(mensagemExistente.status, novoStatus)) {
          const updatePayload = {
            status: novoStatus,
            raw_payload: {
              ...(mensagemExistente.raw_payload || {}),
              statusUpdate: msgStatus,
              recipientUserId,
              parentRecipientUserId
            }
          };

          // Se for erro, grava detalhes de erro na metadata
          if (novoStatus === 'failed') {
            updatePayload.raw_payload.errorCode = msgStatus.errorCode || msgStatus.error?.code || null;
            updatePayload.raw_payload.errorMessage = msgStatus.errorMessage || msgStatus.error?.message || null;
            updatePayload.raw_payload.whatsappApiError = msgStatus.whatsappApiError || null;
          }

          await supabase
            .from('atendimento_connect_mensagens')
            .update(updatePayload)
            .eq('id', mensagemExistente.id);
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro no processamento do webhook YCloud:', error);
    return res.status(500).json({ error: 'Erro interno ao processar webhook' });
  }
}
