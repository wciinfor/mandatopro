-- ==============================================================================
-- Migration 258: Criar Tabelas do Módulo de Comunicação Oficial (WhatsApp Cloud API)
-- communication_templates, communication_audiences, communication_campaigns, communication_campaign_items
-- ==============================================================================

-- 1. Tabela: communication_templates (Templates WhatsApp oficiais da Meta / YCloud)
CREATE TABLE IF NOT EXISTS public.communication_templates (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT REFERENCES public.tenants(id) ON DELETE SET NULL,
  nome VARCHAR(255) NOT NULL,
  categoria VARCHAR(100) NOT NULL DEFAULT 'MARKETING',
  idioma VARCHAR(20) NOT NULL DEFAULT 'pt_BR',
  status VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
  canal VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  componentes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_templates_nome ON public.communication_templates(nome);
CREATE INDEX IF NOT EXISTS idx_comm_templates_tenant ON public.communication_templates(tenant_id);

-- 2. Tabela: communication_audiences (Públicos e regras de segmentação / timeline)
CREATE TABLE IF NOT EXISTS public.communication_audiences (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT REFERENCES public.tenants(id) ON DELETE SET NULL,
  nome VARCHAR(255) NOT NULL,
  regras JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_audiences_tenant ON public.communication_audiences(tenant_id);

-- 3. Tabela: communication_campaigns (Disparos oficiais em massa)
CREATE TABLE IF NOT EXISTS public.communication_campaigns (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT REFERENCES public.tenants(id) ON DELETE SET NULL,
  nome VARCHAR(255) NOT NULL,
  canal VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  status VARCHAR(50) NOT NULL DEFAULT 'rascunho',
  template_id BIGINT REFERENCES public.communication_templates(id) ON DELETE SET NULL,
  audience_id BIGINT REFERENCES public.communication_audiences(id) ON DELETE SET NULL,
  total_destinatarios INTEGER NOT NULL DEFAULT 0,
  total_enviadas INTEGER NOT NULL DEFAULT 0,
  total_entregues INTEGER NOT NULL DEFAULT 0,
  total_lidas INTEGER NOT NULL DEFAULT 0,
  total_falhas INTEGER NOT NULL DEFAULT 0,
  agendado_para TIMESTAMPTZ NULL,
  iniciada_em TIMESTAMPTZ NULL,
  concluida_em TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_campaigns_tenant ON public.communication_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comm_campaigns_status ON public.communication_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_comm_campaigns_template ON public.communication_campaigns(template_id);
CREATE INDEX IF NOT EXISTS idx_comm_campaigns_audience ON public.communication_campaigns(audience_id);

-- 4. Tabela: communication_campaign_items (Fila de destinatários e status de entrega de cada mensagem)
CREATE TABLE IF NOT EXISTS public.communication_campaign_items (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT REFERENCES public.tenants(id) ON DELETE SET NULL,
  campaign_id BIGINT NOT NULL REFERENCES public.communication_campaigns(id) ON DELETE CASCADE,
  contact_id VARCHAR(60) NOT NULL,
  template_id VARCHAR(255) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pendente',
  provider_message_id VARCHAR(255) NULL,
  variaveis_mapeadas JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  delivered_at TIMESTAMPTZ NULL,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices estratégicos para performance da fila e concorrência
CREATE INDEX IF NOT EXISTS idx_comm_items_campaign_id ON public.communication_campaign_items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_comm_items_status ON public.communication_campaign_items(status);
CREATE INDEX IF NOT EXISTS idx_comm_items_provider_msg_id ON public.communication_campaign_items(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_comm_items_queue_fetch ON public.communication_campaign_items(status, campaign_id, id);
CREATE INDEX IF NOT EXISTS idx_comm_items_contact_id ON public.communication_campaign_items(contact_id);
