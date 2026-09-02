import crypto from 'crypto';
import { createServerClient } from '@/lib/supabase-server';
import { readRawBody } from '@/lib/raw-body';
import { WaBlastWebhookNormalizer } from '@/services/wablastWebhookNormalizer';
import { ConversasService } from '@/services/conversasService';

export const config = {
  api: {
    bodyParser: false
  }
};

/**
 * Prioridade dos status para evitar regressão
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
  return pNovo >= pAtual;
}

/**
 * Validação Oficial de Assinatura HMAC baseada no protocolo Standard Webhooks (WaBlast)
 * 
 * Requisitos:
 * - Headers: webhook-id, webhook-timestamp, webhook-signature
 * - Formato da assinatura esperada: v1,<assinatura_base64>
 * - Secret no formato: whsec_<base64>
 * - Conteúdo assinado: `${webhookId}.${webhookTimestamp}.${rawBodyString}`
 * - Chave HMAC: decodificação Base64 dos bytes após "whsec_"
 * - Tolerância anti-replay de timestamp: 5 minutos (300 segundos)
 */
function validarAssinaturaWaBlast({ rawBody, webhookId, webhookTimestamp, signatureHeader, secret }) {
  if (!webhookId) {
    return { status: 'MISSING', reason: 'Header webhook-id ausente' };
  }
  if (!webhookTimestamp) {
    return { status: 'MISSING', reason: 'Header webhook-timestamp ausente' };
  }
  if (!signatureHeader) {
    return { status: 'MISSING', reason: 'Header webhook-signature ausente' };
  }
  if (!secret) {
    return { status: 'INVALID', reason: 'WABLAST_WEBHOOK_SECRET não configurado no servidor' };
  }

  try {
    // 1. Validar tolerância do timestamp (anti-replay: 5 minutos)
    const tsSeconds = Number(webhookTimestamp);
    if (!Number.isFinite(tsSeconds)) {
      return { status: 'INVALID', reason: 'Header webhook-timestamp inválido' };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const diffSeconds = Math.abs(nowSeconds - tsSeconds);
    const TOLERANCIA_SEGUNDOS = 300; // 5 minutos

    if (diffSeconds > TOLERANCIA_SEGUNDOS) {
      return { status: 'INVALID', reason: `Timestamp fora da janela de tolerância de 5 minutos (drift: ${diffSeconds}s)` };
    }

    // 2. Extrair a chave binária a partir do secret (whsec_<base64> ou raw)
    let secretKeyBuffer;
    const cleanSecret = String(secret || '').trim();
    if (cleanSecret.startsWith('whsec_')) {
      const base64Part = cleanSecret.replace('whsec_', '');
      secretKeyBuffer = Buffer.from(base64Part, 'base64');
    } else {
      secretKeyBuffer = Buffer.from(cleanSecret, 'utf8');
    }

    // 3. Montar o payload assinado: `${webhookId}.${webhookTimestamp}.${rawBodyString}`
    const rawBodyString = rawBody.toString('utf8');
    const toSign = `${webhookId}.${webhookTimestamp}.${rawBodyString}`;

    // 4. Calcular o HMAC-SHA256 em Base64
    const computedSignatureBase64 = crypto
      .createHmac('sha256', secretKeyBuffer)
      .update(toSign)
      .digest('base64');

    const expectedSignatureWithPrefix = `v1,${computedSignatureBase64}`;

    // 5. Comparar com as assinaturas fornecidas no header (pode haver múltiplas assinaturas separadas por espaço)
    // Exemplo de header: "v1,g0hM9SsE+OTPJTGtAhWS..." ou "v1,..."
    const receivedSignatures = String(signatureHeader).trim().split(/\s+/);
    let matched = false;

    const expectedBuffer = Buffer.from(expectedSignatureWithPrefix, 'utf8');

    for (const sig of receivedSignatures) {
      const receivedBuffer = Buffer.from(sig, 'utf8');
      if (expectedBuffer.length === receivedBuffer.length) {
        if (crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
          matched = true;
          break;
        }
      }
    }

    return {
      status: matched ? 'VALID' : 'INVALID',
      reason: matched ? 'Assinatura válida' : 'Assinatura divergente'
    };
  } catch (err) {
    return { status: 'INVALID', reason: `Erro ao verificar assinatura: ${err.message}` };
  }
}

function parseJson(rawBody) {
  try {
    return JSON.parse(rawBody.toString('utf8') || '{}');
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const rawBody = await readRawBody(req);
  
  const webhookId = req.headers['webhook-id'] 
    || req.headers['x-webhook-id'] 
    || req.headers['msg-id'];

  const webhookTimestamp = req.headers['webhook-timestamp'] 
    || req.headers['x-webhook-timestamp'];

  const signatureHeader = req.headers['webhook-signature'] 
    || req.headers['x-wablast-signature'] 
    || req.headers['wablast-signature']
    || req.headers['x-signature']
    || req.headers['signature'];

  const webhookSecret = process.env.WABLAST_WEBHOOK_SECRET;

  // 1. Validação de Assinatura Oficial Standard Webhooks
  if (process.env.NODE_ENV === 'production' || signatureHeader || webhookId) {
    const validacao = validarAssinaturaWaBlast({
      rawBody,
      webhookId,
      webhookTimestamp,
      signatureHeader,
      secret: webhookSecret
    });

    if (validacao.status !== 'VALID') {
      console.warn('[WABLAST WEBHOOK] Assinatura inválida:', validacao.reason);
      return res.status(401).json({ success: false, error: 'Assinatura inválida', reason: validacao.reason });
    }
  }

  const rawPayload = parseJson(rawBody);
  const evento = WaBlastWebhookNormalizer.normalizarEvento(rawPayload);

  if (!evento) {
    return res.status(400).json({ success: false, error: 'Payload de webhook inválido' });
  }

  const supabase = createServerClient();

  try {
    // ─── CASO 1: CONEXÃO DE CONTA (account.connected) ───────────────────────────
    if (evento.tipo === 'account.connected') {
      console.log(`[WABLAST WEBHOOK] Recebido account.connected para external_ref=${evento.external_ref}`);

      let tenantId = null;
      if (evento.external_ref && evento.external_ref.startsWith('tenant_')) {
        tenantId = Number(evento.external_ref.replace('tenant_', ''));
      }

      if (!tenantId || !Number.isFinite(tenantId)) {
        // Tenta localizar por conta existente com o mesmo external_ref
        const { data: contaExistente } = await supabase
          .from('whatsapp_business_accounts')
          .select('tenant_id, id')
          .eq('wablast_external_ref', evento.external_ref)
          .maybeSingle();

        tenantId = contaExistente?.tenant_id || null;
      }

      if (!tenantId) {
        console.warn('[WABLAST WEBHOOK] Tenant não identificado para external_ref:', evento.external_ref);
        return res.status(200).json({ success: true, warning: 'Tenant não localizado' });
      }

      // Localiza a conta WABLAST do tenant (ou conta principal se for migração)
      const { data: contasTenant } = await supabase
        .from('whatsapp_business_accounts')
        .select('id, provider, principal')
        .eq('tenant_id', tenantId);

      let targetAccountId = null;
      const contaWablastExistente = (contasTenant || []).find(c => c.provider === 'WABLAST');
      if (contaWablastExistente) {
        targetAccountId = contaWablastExistente.id;
      }

      const updateData = {
        wablast_account_id: evento.account_id,
        wablast_external_ref: evento.external_ref,
        wablast_waba_id: evento.waba_id || null,
        phone_validated: Boolean(evento.phone_number),
        production_ready: Boolean(evento.account_id),
        updated_at: new Date().toISOString()
      };

      if (targetAccountId) {
        await supabase
          .from('whatsapp_business_accounts')
          .update(updateData)
          .eq('id', targetAccountId);
      } else {
        // Insere nova conta de suporte ao WaBlast sem marcar como principal para não quebrar Meta/YCloud
        const { data: novaConta } = await supabase
          .from('whatsapp_business_accounts')
          .insert({
            tenant_id: tenantId,
            provider: 'WABLAST',
            nome: 'WhatsApp Business WaBlast',
            status: 'ATIVO',
            principal: false,
            ...updateData
          })
          .select('id')
          .single();

        targetAccountId = novaConta?.id;
      }

      // Se forneceu dados do número, atualiza ou insere em whatsapp_business_numbers
      if (targetAccountId && (evento.phone_number || evento.phone_number_id)) {
        const phoneId = evento.phone_number_id || evento.phone_number;
        const { data: numExistente } = await supabase
          .from('whatsapp_business_numbers')
          .select('id')
          .eq('account_id', targetAccountId)
          .maybeSingle();

        const numPayload = {
          tenant_id: tenantId,
          account_id: targetAccountId,
          phone_number_id: phoneId,
          display_phone_number: evento.phone_number || phoneId,
          verified_name: evento.verified_name || null,
          status: 'ATIVO',
          principal: true,
          updated_at: new Date().toISOString()
        };

        if (numExistente?.id) {
          await supabase
            .from('whatsapp_business_numbers')
            .update(numPayload)
            .eq('id', numExistente.id);
        } else {
          await supabase
            .from('whatsapp_business_numbers')
            .insert(numPayload);
        }
      }

      console.log(`[WABLAST WEBHOOK] Conta WaBlast atualizada com sucesso para tenant=${tenantId}`);
      return res.status(200).json({ success: true, message: 'Conta conectada registrada' });
    }

    // ─── CASO 2: STATUS DE MENSAGEM (sent, delivered, read, failed) ─────────────
    if (evento.tipo === 'status' && evento.provider_message_id) {
      console.log(`[WABLAST WEBHOOK] Atualizando status wamid=${evento.provider_message_id} -> ${evento.status}`);

      // 1. Atualiza disparo_envios (Campanhas do Disparo Pro)
      const { data: envioRow } = await supabase
        .from('disparo_envios')
        .select('id, status')
        .eq('provider_message_id', evento.provider_message_id)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (envioRow) {
        if (deveAtualizarStatus(envioRow.status, evento.status)) {
          const updatePayload = {
            status: evento.status,
            erro: evento.erro ? String(evento.erro) : null
          };
          if (evento.status === 'delivered') updatePayload.entregue_em = evento.timestamp;
          if (evento.status === 'read') updatePayload.lido_em = evento.timestamp;

          await supabase
            .from('disparo_envios')
            .update(updatePayload)
            .eq('id', envioRow.id);
        }
      }

      // 2. Atualiza communication_messages / Central de Atendimento
      await ConversasService.processarEventoMeta(evento);

      return res.status(200).json({ success: true });
    }

    // ─── CASO 3: MENSAGEM RECEBIDA (INBOUND) ───────────────────────────────────
    if (evento.tipo === 'mensagem' && evento.provider_message_id) {
      console.log(`[WABLAST WEBHOOK] Mensagem inbound wamid=${evento.provider_message_id} de=${evento.contact_id}`);
      await ConversasService.processarEventoMeta(evento);
      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ success: true, ignored: true });
  } catch (error) {
    console.error('[WABLAST WEBHOOK] Erro ao processar evento:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
