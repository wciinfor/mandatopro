-- Migration para normalização e persistência multicanal
-- Adiciona a tabela centralizada de conversas multicanais
CREATE TABLE IF NOT EXISTS central_atendimento_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL, -- 'meta', 'legada', 'instagram'
  channel VARCHAR(50) NOT NULL, -- 'whatsapp', 'whatsapp_legacy', 'instagram'
  external_conversation_id VARCHAR(255) NOT NULL,
  contact_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'nova',
  assigned_to UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  unread_count INT NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adiciona a tabela centralizada de mensagens multicanais
CREATE TABLE IF NOT EXISTS central_atendimento_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES central_atendimento_conversas(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_message_id VARCHAR(255) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  direction VARCHAR(20) NOT NULL, -- 'entrada', 'saida', 'nota'
  message TEXT NOT NULL,
  media_url TEXT,
  media_type VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'recebida',
  sender_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cria índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_central_conv_ext ON central_atendimento_conversas(provider, external_conversation_id);
CREATE INDEX IF NOT EXISTS idx_central_conv_contact ON central_atendimento_conversas(contact_id);
CREATE INDEX IF NOT EXISTS idx_central_msg_conv ON central_atendimento_mensagens(conversation_id);
CREATE INDEX IF NOT EXISTS idx_central_msg_prov ON central_atendimento_mensagens(provider, provider_message_id);
