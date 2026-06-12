import { env } from '../config/env';
import { logger } from '../utils/logger';

// ──────────────────────────────────────────────────────────────
// SERVIÇO DE COMUNICAÇÃO COM O N8N
//
// Durante a MIGRAÇÃO GRADUAL, a API aciona webhooks do N8N para
// automações que ainda não foram portadas para workers nativos.
//
// ROADMAP DE MIGRAÇÃO:
//   Fase 1 (atual): API chama N8N via webhook para tudo
//   Fase 2: Billing, campanhas → BullMQ workers nativos
//   Fase 3: IA, inbox → serviços próprios
//   Fase 4: N8N reduzido a integrações externas e orquestração
//
// Comunicação:
//   API → N8N  (chamada de webhook POST, fire-and-forget)
//   N8N → API  (chamada de endpoint interno /api/v1/internal/*)
// ──────────────────────────────────────────────────────────────

// Status de cada trigger (para documentar o roadmap inline)
type MigrationStatus = 'n8n' | 'native' | 'hybrid';

interface TriggerMeta {
  path:   string;
  status: MigrationStatus;
  note?:  string;
}

const TRIGGERS: Record<string, TriggerMeta> = {
  'billing.subscription_created': { path: 'billing/subscription-created', status: 'n8n'    },
  'billing.payment_received':     { path: 'billing/payment-received',     status: 'n8n'    },
  'campaigns.start':              { path: 'campaigns/start',              status: 'hybrid', note: 'Migrar para BullMQ - Fase 2' },
  'campaigns.pause':              { path: 'campaigns/pause',              status: 'hybrid', note: 'Migrar para BullMQ - Fase 2' },
  'instances.connected':          { path: 'instances/connected',          status: 'n8n'    },
  'instances.disconnected':       { path: 'instances/disconnected',       status: 'n8n'    },
  'ai.analyze':                   { path: 'ai/analyze',                   status: 'n8n',   note: 'Migrar para serviço de IA - Fase 3' },
  'inbox.new_message':            { path: 'inbox/new-message',            status: 'n8n',   note: 'Migrar para workers Fase 3' },
};

export class N8nService {
  private readonly baseUrl: string;
  private readonly apiKey:  string;
  private readonly enabled: boolean;

  constructor() {
    this.baseUrl = env.N8N_WEBHOOK_BASE_URL ?? '';
    this.apiKey  = env.N8N_API_KEY ?? '';
    this.enabled = Boolean(this.baseUrl && this.apiKey);

    if (!this.enabled) {
      logger.warn('N8N não configurado (N8N_WEBHOOK_BASE_URL / N8N_API_KEY ausentes) — todos os triggers serão no-ops');
    }
  }

  private async trigger(
    triggerKey: string,
    payload:    Record<string, unknown>,
  ): Promise<boolean> {
    const meta = TRIGGERS[triggerKey];
    if (!meta) {
      logger.warn({ triggerKey }, 'N8N trigger não mapeado');
      return false;
    }

    if (!this.enabled) {
      // N8N não configurado — no-op silencioso
      return false;
    }

    if (meta.status === 'native') {
      // Já migrado — não chamar N8N
      return true;
    }

    const url = `${this.baseUrl}/${meta.path}`;
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key':    this.apiKey,
        },
        body: JSON.stringify({ ...payload, _source: 'disparo-pro-api' }),
      });

      if (!res.ok) {
        logger.warn({ url, status: res.status, triggerKey }, 'N8N webhook retornou erro');
        return false;
      }

      logger.debug({ triggerKey }, 'N8N trigger acionado');
      return true;
    } catch (err) {
      // Falha no N8N NÃO deve quebrar o fluxo principal — apenas logamos
      logger.error({ url, triggerKey, err }, 'Falha ao acionar N8N webhook');
      return false;
    }
  }

  // ── Billing ────────────────────────────────────────────
  async triggerSubscriptionCreated(workspaceId: string, planCode: string): Promise<boolean> {
    return this.trigger('billing.subscription_created', { workspaceId, planCode });
  }

  async triggerPaymentReceived(paymentId: string, workspaceId: string): Promise<boolean> {
    return this.trigger('billing.payment_received', { paymentId, workspaceId });
  }

  // ── Campanhas ─────────────────────────────────────────
  async triggerCampaignStart(campaignId: string, workspaceId: string): Promise<boolean> {
    return this.trigger('campaigns.start', { campaignId, workspaceId });
  }

  async triggerCampaignPause(campaignId: string): Promise<boolean> {
    return this.trigger('campaigns.pause', { campaignId });
  }

  // ── Instâncias ────────────────────────────────────────
  async triggerInstanceConnected(instanceName: string, workspaceId: string): Promise<boolean> {
    return this.trigger('instances.connected', { instanceName, workspaceId });
  }

  async triggerInstanceDisconnected(instanceName: string, workspaceId: string): Promise<boolean> {
    return this.trigger('instances.disconnected', { instanceName, workspaceId });
  }

  // ── IA ────────────────────────────────────────────────
  async triggerAiAnalysis(conversationId: string, workspaceId: string): Promise<boolean> {
    return this.trigger('ai.analyze', { conversationId, workspaceId });
  }

  // ── Inbox ─────────────────────────────────────────────
  async triggerInboxNewMessage(conversationId: string, workspaceId: string): Promise<boolean> {
    return this.trigger('inbox.new_message', { conversationId, workspaceId });
  }
}

export const n8nService = new N8nService();
