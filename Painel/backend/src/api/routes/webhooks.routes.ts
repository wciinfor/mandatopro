import { FastifyInstance } from 'fastify';
import { supabaseAdmin }    from '../../config/supabase';
import { sendOk }           from '../../utils/response';
import { logger }           from '../../utils/logger';
import { n8nService }       from '../../services/n8n.service';
import { enqueueInboxInbound } from '../../jobs/queue';
import { isWebhookAllowed } from '../../middleware/workspace-rate-limit';
import { webhookEventsTotal } from '../../utils/metrics';

// ──────────────────────────────────────────────────────────────
// ROTAS DE WEBHOOK (entrada de eventos externos)
//
// Fase 7: adicionada flood protection por instance + métricas
//
// Segurança garantida por:
//   • Flood protection: limite configurável por instance (token bucket)
//   • Rate limiting global (app.ts)
//   • IP allowlist no firewall/proxy reverso
//   • TODO: assinatura HMAC por provedor
// ──────────────────────────────────────────────────────────────

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {

  // POST /webhooks/evolution — eventos da Evolution API (WhatsApp)
  fastify.post('/evolution', async (request, reply) => {
    const payload  = request.body as Record<string, unknown>;
    const event    = payload['event'] as string ?? 'unknown';
    const instance = payload['instance'] as string ?? '';

    // ── Flood protection ─────────────────────────────────────
    if (!isWebhookAllowed(instance)) {
      logger.warn({ event, instance }, 'Webhook: flood bloqueado por rate limit de instância');
      webhookEventsTotal.inc({ provider: 'evolution', event_type: event, result: 'throttled' });
      // Retornar 200 mesmo bloqueado para não acionar retry da Evolution
      return sendOk(reply, { received: true, throttled: true });
    }

    logger.info({ event, instance }, 'Webhook Evolution recebido');
    webhookEventsTotal.inc({ provider: 'evolution', event_type: event, result: 'accepted' });

    // 1. Persistir para auditoria e processamento assíncrono
    await supabaseAdmin.from('webhook_events').insert({
      provider:    'evolution',
      event_type:  event,
      status:      'received',
      payload,
      received_at: new Date().toISOString(),
    });

    // 2. Processar eventos críticos de forma síncrona
    if (event === 'CONNECTION_UPDATE') {
      const state = (payload['data'] as Record<string, unknown>)?.['state'] as string;
      if (instance && state) {
        const status = mapEvolutionStatus(state);
        await supabaseAdmin
          .from('instances')
          .update({ status, last_check: new Date().toISOString() })
          .eq('name', instance);

        if (status === 'connected') {
          const { data: inst } = await supabaseAdmin
            .from('instances')
            .select('workspace_id')
            .eq('name', instance)
            .maybeSingle();

          if (inst) {
            void n8nService.triggerInstanceConnected(instance, inst.workspace_id);
          }
        }
      }
    }

    // MESSAGES_UPSERT / MESSAGE_UPDATE → enfileirar para processamento assíncrono
    if (event === 'MESSAGES_UPSERT' || event === 'MESSAGE_UPDATE') {
      void enqueueInboxInbound({ event, instanceName: instance, payload });
    }

    // N8N complementar (mantido para compatibilidade)
    if (event === 'MESSAGES_UPSERT') {
      const { data: inst } = await supabaseAdmin
        .from('instances')
        .select('workspace_id')
        .eq('name', instance)
        .maybeSingle();

      if (inst) {
        void n8nService.triggerInboxNewMessage('', inst.workspace_id);
      }
    }

    return sendOk(reply, { received: true });
  });

  // POST /webhooks/asaas — eventos de cobrança Asaas
  fastify.post('/asaas', async (request, reply) => {
    const payload  = request.body as Record<string, unknown>;
    const event    = payload['event'] as string ?? 'unknown';
    const paymentId = (payload['payment'] as Record<string, unknown>)?.['id'] as string ?? '';

    logger.info({ event, paymentId }, 'Webhook Asaas recebido');

    await supabaseAdmin.from('webhook_events').insert({
      provider:    'asaas',
      event_type:  event,
      status:      'received',
      payload,
      received_at: new Date().toISOString(),
    });

    // Repassar eventos de pagamento ao N8N
    if (event === 'PAYMENT_RECEIVED' && paymentId) {
      void n8nService.triggerPaymentReceived(paymentId, '');
    }

    return sendOk(reply, { received: true });
  });
}

function mapEvolutionStatus(state: string): string {
  const map: Record<string, string> = {
    open:       'connected',
    connecting: 'connecting',
    close:      'disconnected',
  };
  return map[state] ?? 'unknown';
}
