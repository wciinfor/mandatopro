import { createServerClient } from '../../../lib/supabase-server.js';
import { VibeWhatsWebhookNormalizer } from '../../../services/vibewhatsWebhookNormalizer.js';
import { ConversasService } from '../../../services/conversasService.js';
import { createWhatsAppWebhookEventLogger } from '../../../services/whatsapp-webhook-event-logger.js';

export const runtime = 'nodejs';

/**
 * Endpoint de Webhook VibeWhats - Processamento Inbound e Status Operacional
 * 
 * Rota: POST /api/whatsapp-business/vibewhats-webhook?token={verify_token}
 * 
 * Funcionalidades:
 * 1. Autenticação estrita por segredo (?token=) vinculado à conta VIBEWHATS do gabinete.
 * 2. Isolamento rigoroso multi-tenant: localiza exclusivamente a conta do tenant proprietário.
 * 3. Deduplicação por provider_message_id impedindo reprocessamento de mensagens concorrentes.
 * 4. Descarte de mensagens outbound (fromMe: true) e descarte de eventos desconhecidos/corrompidos.
 * 5. Integração com o pipeline canônico ConversasService.processarEventoMeta para Atendimento Connect.
 * 6. Registro de auditoria seguro sem expor tokens ou credenciais em logs.
 */
export default async function handler(req, res) {
  // 1. Aceitar exclusivamente POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Método não permitido. Utilize POST.' });
  }

  const { token: providedSecret } = req.query;
  const payload = req.body;

  if (!providedSecret || typeof providedSecret !== 'string' || !providedSecret.trim()) {
    return res.status(401).json({ success: false, error: 'Token de webhook ausente ou não informado' });
  }

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ success: false, error: 'Payload JSON inválido ou vazio' });
  }

  const cleanSecret = String(providedSecret).trim();
  const supabase = req.supabaseClient || createServerClient();

  try {
    // 2. Localiza a conta VIBEWHATS vinculada ao verify_token
    const { data: contaVibe, error: errBusca } = await supabase
      .from('whatsapp_business_accounts')
      .select(`
        id,
        tenant_id,
        provider,
        nome,
        status,
        principal,
        verify_token,
        access_token,
        access_token_metadata,
        whatsapp_business_numbers (*)
      `)
      .eq('provider', 'VIBEWHATS')
      .eq('verify_token', cleanSecret)
      .maybeSingle();

    if (errBusca) {
      console.error('[VIBEWHATS WEBHOOK] Erro ao buscar conta:', errBusca.message);
      return res.status(500).json({ success: false, error: 'Erro interno ao validar conta' });
    }

    if (!contaVibe) {
      return res.status(401).json({ success: false, error: 'Token de webhook inválido ou não associado a nenhuma conta VibeWhats' });
    }

    // 3. Auditoria estruturada no logger oficial
    const eventId = payload.messageId || payload.id || payload.zaapId || payload.data?.messageId || `vibe_evt_${Date.now()}`;
    const logger = createWhatsAppWebhookEventLogger(supabase);

    try {
      await logger.log({
        conta: contaVibe,
        payload,
        validationStatus: 'VALID',
        signatureStatus: 'VALID',
        eventId
      });
    } catch (logErr) {
      console.warn('[VIBEWHATS LOGGER] Falha ao registrar log de auditoria:', logErr?.message);
    }

    // 4. Normalização pelo VibeWhatsWebhookNormalizer
    const evento = VibeWhatsWebhookNormalizer.normalizarEvento(payload);
    if (!evento) {
      return res.status(400).json({ success: false, error: 'Payload não reconhecido pelo normalizador VibeWhats' });
    }

    // Enriquece com tenant e conta garantidos pelo token
    evento.tenant_id = contaVibe.tenant_id;
    evento.account_id = contaVibe.id;

    const numVibe = (contaVibe.whatsapp_business_numbers || [])[0];
    const instanceIdDaConta = numVibe?.phone_number_id || contaVibe.access_token_metadata?.vibewhats_instance || null;
    const connectedPhoneDaConta = numVibe?.display_phone_number || contaVibe.access_token_metadata?.connected_phone || null;

    if (!evento.metadata) evento.metadata = {};
    if (!evento.metadata.instanceId && instanceIdDaConta) {
      evento.metadata.instanceId = instanceIdDaConta;
    }
    if (!evento.to && connectedPhoneDaConta) {
      evento.to = connectedPhoneDaConta;
    }
    if (!evento.phone_number_id && instanceIdDaConta) {
      evento.phone_number_id = instanceIdDaConta;
    }

    // ─── CASO 1: MENSAGEM RECEBIDA (Inbound / Outbound) ────────────────────────
    if (evento.tipo === 'mensagem' && evento.provider_message_id) {
      // Regra de ouro: Descartar mensagens enviadas pelo próprio número (fromMe: true)
      if (evento.direcao === 'outbound') {
        return res.status(200).json({
          success: true,
          ignored: true,
          reason: 'Mensagem outbound (fromMe=true) descartada para evitar loops'
        });
      }

      // Prevenção de duplicidade e idempotência concorrente
      const { data: msgExistente } = await supabase
        .from('atendimento_connect_mensagens')
        .select('id')
        .eq('provider_message_id', evento.provider_message_id)
        .limit(1)
        .maybeSingle();

      if (msgExistente?.id) {
        return res.status(200).json({
          success: true,
          duplicate: true,
          messageId: evento.provider_message_id,
          reason: 'Mensagem já processada anteriormente'
        });
      }

      // Encaminha ao serviço canônico ConversasService
      const resultadoProcessamento = await ConversasService.processarEventoMeta(evento, supabase);

      if (resultadoProcessamento?.duplicated) {
        return res.status(200).json({
          success: true,
          duplicate: true,
          messageId: evento.provider_message_id,
          reason: 'Mensagem duplicada detectada no pipeline'
        });
      }

      if (resultadoProcessamento?.locked) {
        // HTTP 429 para que o provedor retente de forma segura sem considerar como sucesso
        return res.status(429).json({
          success: false,
          locked: true,
          messageId: evento.provider_message_id,
          error: 'Evento em processamento ativo concorrente por outro nó'
        });
      }

      if (resultadoProcessamento?.success === false) {
        return res.status(500).json({
          success: false,
          messageId: evento.provider_message_id,
          error: resultadoProcessamento?.error || 'Falha ao persistir mensagem'
        });
      }

      return res.status(200).json({
        success: true,
        processed: true,
        messageId: evento.provider_message_id
      });
    }

    // ─── CASO 2: STATUS E CONFIRMAÇÃO DE ENTREGA ──────────────────────────────
    if (evento.tipo === 'status' && evento.provider_message_id) {
      await ConversasService.processarEventoMeta(evento);

      return res.status(200).json({
        success: true,
        status: evento.status,
        messageId: evento.provider_message_id
      });
    }

    return res.status(200).json({ success: true, ignored: true });
  } catch (err) {
    console.error('[VIBEWHATS WEBHOOK] Erro no processamento do evento:', err?.message || err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar webhook VibeWhats'
    });
  }
}
