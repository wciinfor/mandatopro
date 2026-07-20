-- Migration consolidada para persistir toda a arquitetura de comunicação oficial multitenant

-- 1. Tabela de contas oficiais de WhatsApp Business / Meta (communication_accounts)
CREATE TABLE IF NOT EXISTS communication_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, -- Suporte a RLS multi-tenant
  provider VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  phone_number_id VARCHAR(255),
  waba_id VARCHAR(255),
  access_token TEXT,
  status VARCHAR(50) DEFAULT 'inativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Públicos/Audiências reutilizáveis (communication_audiences)
CREATE TABLE IF NOT EXISTS communication_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  canal VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  quantidade_contatos INT DEFAULT 0,
  origem VARCHAR(100),
  filtros_segmentacao JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Templates HSM oficiais homologados pela Meta (communication_templates)
CREATE TABLE IF NOT EXISTS communication_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  nome VARCHAR(255) NOT NULL,
  categoria VARCHAR(100),
  idioma VARCHAR(10) DEFAULT 'pt_BR',
  status VARCHAR(50) DEFAULT 'PENDING_APPROVAL',
  canal VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  conteudo_estrutura JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Campanhas de disparos oficiais (communication_campaigns)
CREATE TABLE IF NOT EXISTS communication_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  nome VARCHAR(255) NOT NULL,
  canal VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  status VARCHAR(50) DEFAULT 'rascunho',
  template_id UUID REFERENCES communication_templates(id) ON DELETE SET NULL,
  audience_id UUID REFERENCES communication_audiences(id) ON DELETE SET NULL,
  agendado_para TIMESTAMPTZ,
  total_destinatarios INT DEFAULT 0,
  total_enviadas INT DEFAULT 0,
  total_entregues INT DEFAULT 0,
  total_lidas INT DEFAULT 0,
  total_falhas INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Conversas Normalizadas (communication_conversations)
CREATE TABLE IF NOT EXISTS communication_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  contact_id VARCHAR(255) NOT NULL,
  channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  status VARCHAR(50) NOT NULL DEFAULT 'pendente',
  assigned_to UUID,
  unread_count INT DEFAULT 0,
  external_conversation_id VARCHAR(255),
  provider VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabela de Mensagens Multicanal Normalizadas (communication_messages)
CREATE TABLE IF NOT EXISTS communication_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  conversation_id UUID REFERENCES communication_conversations(id) ON DELETE CASCADE,
  provider_message_id VARCHAR(255),
  provider VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  direction VARCHAR(20) NOT NULL, -- entrada ou saida
  mensagem TEXT NOT NULL,
  meta_dados JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Fila de Execução / Itens individuais de envio da Campanha (communication_campaign_items)
CREATE TABLE IF NOT EXISTS communication_campaign_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  campaign_id UUID NOT NULL REFERENCES communication_campaigns(id) ON DELETE CASCADE,
  contact_id VARCHAR(255) NOT NULL,
  template_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pendente',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  attempts INT DEFAULT 0,
  last_error TEXT,
  variaveis_mapeadas JSONB DEFAULT '{}'::jsonb,
  provider_message_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criação de Índices para Otimização de Busca e Webhooks
CREATE INDEX IF NOT EXISTS idx_comm_acc_tenant ON communication_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comm_aud_tenant ON communication_audiences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comm_tmpl_tenant ON communication_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comm_camp_tenant ON communication_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comm_conv_tenant ON communication_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comm_conv_contact ON communication_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_comm_msg_conv ON communication_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_comm_msg_prov ON communication_messages(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_comm_items_camp ON communication_campaign_items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_comm_items_status ON communication_campaign_items(status);
CREATE INDEX IF NOT EXISTS idx_comm_items_prov_msg ON communication_campaign_items(provider_message_id);

-- Ativação do RLS (Row Level Security) Multi-Tenant para Segurança das tabelas de Comunicação
ALTER TABLE communication_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_campaign_items ENABLE ROW LEVEL SECURITY;
