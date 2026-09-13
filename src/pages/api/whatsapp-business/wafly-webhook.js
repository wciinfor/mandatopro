import { createServerClient } from '../../../lib/supabase-server.js';
import { readRawBody } from '../../../lib/raw-body.js';
import { WaflyWebhookNormalizer } from '../../../services/waflyWebhookNormalizer.js';
import { ConversasService } from '../../../services/conversasService.js';
import { createWhatsAppWebhookEventLogger } from '../../../services/whatsapp-webhook-event-logger.js';

export const config = {
  api: {
    bodyParser: false
  }
};

/**
 * Remove tokens e segredos de strings e mensagens para prevenir vazamento em logs
 */
function redigirSegredos(str, secrets = []) {
  if (!str || typeof str !== 'string') return str;
  let clean = str;
  for (const s of secrets) {
    if (s && String(s).length >= 4) {
      clean = clean.split(String(s)).join('[REDACTED_SECRET]');
    }
  }
  return clean;
}

/**
 * Parser defensivo de JSON a partir do buffer bruto
 */
function parseJson(rawBody) {
  try {
    const str = rawBody.toString('utf8').trim();
    if (!str) return {};
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Prioridade dos status para evitar regressão de entrega
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
 * Handler oficial do webhook WAFLY
 */
export default async function handler(req, res) {
  // 1. Aceitar exclusivamente POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Utilize POST.'
    });
  }

  // 2. Leitura do corpo bruto da requisição
  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (errRead) {
    console.error('[WAFLY WEBHOOK] Falha ao ler rawBody:', errRead?.message);
    return res.status(400).json({ success: false, error: 'Falha ao ler corpo da requisição' });
  }

  const payload = parseJson(rawBody);
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ success: false, error: 'Payload JSON inválido ou vazio' });
  }

  // 3. Extração do token secreto enviado na requisição
  // Aceita via Query Params (?token=... ou ?secret=... ou ?verify_token=...)
  // ou Headers (x-wafly-secret, x-webhook-token, Authorization: Bearer ...)
  const querySecret = req.query?.token || req.query?.secret || req.query?.verify_token;
  const authHeader = req.headers['authorization'];
  const bearerSecret = authHeader && authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : null;
  const headerSecret = req.headers['x-wafly-secret'] || req.headers['x-webhook-token'] || bearerSecret;
  const providedSecret = String(querySecret || headerSecret || '').trim();

  // NUNCA aceitar requisição sem segredo configurado
  if (!providedSecret) {
    return res.status(401).json({
      success: false,
      error: 'Token secreto de webhook obrigatório ausente'
    });
  }

  const supabase = createServerClient();

  // 4. Resolução da conta WAFLY seguindo ordem estrita de prioridade:
  // 4.1 account_id explícito
  // 4.2 connectedPhone
  // 4.3 instanceId
  let contaWafly = null;
  const accountIdParam = req.query?.account_id || req.headers['x-account-id'] || payload.account_id;

  if (accountIdParam) {
    const { data: cById } = await supabase
      .from('whatsapp_business_accounts')
      .select('id, tenant_id, provider, nome, verify_token, access_token, access_token_metadata, status')
      .eq('id', accountIdParam)
      .eq('provider', 'WAFLY')
      .eq('status', 'ATIVO')
      .limit(1)
      .maybeSingle();

    if (cById) contaWafly = cById;
  }

  // 4.2 Resolução por connectedPhone
  const rawConnectedPhone = payload.connectedPhone || payload.data?.connectedPhone || payload.to || payload.data?.to;
  const cleanConnectedPhone = rawConnectedPhone ? String(rawConnectedPhone).replace(/\D+/g, '') : null;

  if (!contaWafly && cleanConnectedPhone) {
    // Tenta primeiro em whatsapp_business_numbers vinculado à conta WAFLY
    const { data: numRow } = await supabase
      .from('whatsapp_business_numbers')
      .select('account_id, tenant_id, display_phone_number, whatsapp_business_accounts!inner(id, tenant_id, provider, nome, verify_token, access_token, access_token_metadata, status)')
      .eq('whatsapp_business_accounts.provider', 'WAFLY')
      .eq('whatsapp_business_accounts.status', 'ATIVO')
      .eq('display_phone_number', cleanConnectedPhone)
      .limit(1)
      .maybeSingle();

    if (numRow?.whatsapp_business_accounts) {
      contaWafly = numRow.whatsapp_business_accounts;
    }
  }

  // 4.3 Resolução por instanceId
  const rawInstanceId = String(payload.instanceId || payload.data?.instanceId || payload.instance || payload.data?.instance || '').trim();
  if (!contaWafly && rawInstanceId) {
    const { data: contasWaflyAtivas } = await supabase
      .from('whatsapp_business_accounts')
      .select('id, tenant_id, provider, nome, verify_token, access_token, access_token_metadata, status')
      .eq('provider', 'WAFLY')
      .eq('status', 'ATIVO');

    if (Array.isArray(contasWaflyAtivas)) {
      contaWafly = contasWaflyAtivas.find(c => {
        const meta = typeof c.access_token_metadata === 'object' && c.access_token_metadata ? c.access_token_metadata : {};
        return meta.wafly_instance === rawInstanceId || meta.instance === rawInstanceId || meta.instance_id === rawInstanceId;
      }) || null;
    }
  }

  // Se nenhuma conta for localizada:
  if (!contaWafly) {
    return res.status(404).json({
      success: false,
      error: 'Conta WAFLY correspondente não encontrada'
    });
  }

  // 5. Validação rigorosa do segredo contra a conta correspondente (com fallback de ambiente)
  const metadata = typeof contaWafly.access_token_metadata === 'object' && contaWafly.access_token_metadata
    ? contaWafly.access_token_metadata
    : {};

  const segredosPermitidos = [
    contaWafly.verify_token,
    metadata.webhook_secret,
    metadata.wafly_secret,
    metadata.token,
    contaWafly.access_token,
    process.env.WAFLY_WEBHOOK_SECRET
  ].filter(Boolean).map(s => String(s).trim());

  const secretValid = segredosPermitidos.some(s => s === providedSecret);

  // 6. Registro de Auditoria no Logger oficial
  const logger = createWhatsAppWebhookEventLogger(supabase);
  const eventId = payload.messageId || payload.id || payload.data?.messageId || payload.data?.id || `wafly_evt_${Date.now()}`;

  try {
    await logger.log({
      conta: contaWafly,
      payload,
      validationStatus: secretValid ? 'VALID' : 'INVALID',
      signatureStatus: secretValid ? 'VALID' : 'INVALID',
      eventId
    });
  } catch (logErr) {
    console.error('[WAFLY LOGGER] Falha ao gravar log de auditoria:', redigirSegredos(logErr?.message, [providedSecret]));
  }

  if (!secretValid) {
    return res.status(401).json({
      success: false,
      error: 'Token secreto inválido para a conta WAFLY especificada'
    });
  }

  // 7. Normalização exclusiva pelo WaflyWebhookNormalizer
  const evento = WaflyWebhookNormalizer.normalizarEvento(payload);
  if (!evento) {
    return res.status(400).json({
      success: false,
      error: 'Payload não reconhecido pelo normalizador WAFLY'
    });
  }

  // Enriquece o evento normalizado com tenant e conta resolvidos
  evento.tenant_id = contaWafly.tenant_id;
  evento.account_id = contaWafly.id;

  try {
    // ─── CASO A: CONEXÃO DE CONTA (ConnectedCallback) ─────────────────────────
    if (evento.tipo === 'account.connected') {
      const updateData = {
        status: 'ATIVO',
        production_ready: true,
        updated_at: new Date().toISOString()
      };

      await supabase
        .from('whatsapp_business_accounts')
        .update(updateData)
        .eq('id', contaWafly.id);

      if (evento.connectedPhone) {
        const { data: numExistente } = await supabase
          .from('whatsapp_business_numbers')
          .select('id')
          .eq('account_id', contaWafly.id)
          .maybeSingle();

        const numPayload = {
          tenant_id: contaWafly.tenant_id,
          account_id: contaWafly.id,
          phone_number_id: evento.connectedPhone,
          display_phone_number: evento.connectedPhone,
          status: 'ATIVO',
          principal: true,
          updated_at: new Date().toISOString()
        };

        if (numExistente?.id) {
          await supabase.from('whatsapp_business_numbers').update(numPayload).eq('id', numExistente.id);
        } else {
          await supabase.from('whatsapp_business_numbers').insert(numPayload);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Instância conectada registrada com sucesso',
        instanceId: evento.instanceId
      });
    }

    // ─── CASO B: DESCONEXÃO DE CONTA (DisconnectedCallback) ───────────────────
    if (evento.tipo === 'account.disconnected') {
      const metaAtualizada = {
        ...metadata,
        last_disconnect_reason: evento.reason,
        last_disconnected_at: evento.timestamp
      };

      await supabase
        .from('whatsapp_business_accounts')
        .update({
          access_token_metadata: metaAtualizada,
          updated_at: new Date().toISOString()
        })
        .eq('id', contaWafly.id);

      return res.status(200).json({
        success: true,
        message: 'Instância desconectada registrada com sucesso',
        reason: evento.reason
      });
    }

    // ─── CASO C: STATUS E CONFIRMAÇÃO DE ENTREGA (MessageStatusCallback) ─────
    if (evento.tipo === 'status' && evento.provider_message_id) {
      // 1. Atualiza disparo_envios (Campanhas Mandato Connect) se existir
      const { data: envioRow } = await supabase
        .from('disparo_envios')
        .select('id, status')
        .eq('provider_message_id', evento.provider_message_id)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (envioRow && deveAtualizarStatus(envioRow.status, evento.status)) {
        const updateEnvio = {
          status: evento.status,
          erro: evento.erro ? String(evento.erro) : null
        };
        if (evento.status === 'delivered') updateEnvio.entregue_em = evento.timestamp;
        if (evento.status === 'read') updateEnvio.lido_em = evento.timestamp;

        await supabase.from('disparo_envios').update(updateEnvio).eq('id', envioRow.id);
      }

      // 2. Encaminha ao ConversasService / processarEventoStatus
      await ConversasService.processarEventoMeta(evento);

      return res.status(200).json({
        success: true,
        status: evento.status,
        messageId: evento.provider_message_id
      });
    }

    // ─── CASO D: MENSAGEM RECEBIDA (ReceivedCallback) ──────────────────────────
    if (evento.tipo === 'mensagem' && evento.provider_message_id) {
      // Regra de segurança crítica: Nunca gerar resposta automática a mensagens outbound (fromMe=true)
      if (evento.direcao === 'outbound') {
        return res.status(200).json({
          success: true,
          ignored: true,
          reason: 'Mensagem outbound (fromMe=true) registrada sem disparo de resposta automática'
        });
      }

      // Mensagem inbound legítima: encaminha ao pipeline canônico
      await ConversasService.processarEventoMeta(evento);

      return res.status(200).json({
        success: true,
        messageId: evento.provider_message_id
      });
    }

    // Retorno padrão para outros eventos
    return res.status(200).json({ success: true, ignored: true });
  } catch (error) {
    console.error('[WAFLY WEBHOOK] Erro durante processamento:', redigirSegredos(error?.message, [providedSecret]));
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar webhook WAFLY'
    });
  }
}
