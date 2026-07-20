-- Adiciona os novos campos de status do webhook da Meta na tabela de fila de disparos
CREATE TABLE IF NOT EXISTS central_atendimento_fila_disparos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID,
  contact_id VARCHAR(255) NOT NULL,
  template_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pendente',
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  attempts INT DEFAULT 0,
  last_error TEXT,
  variaveis_mapeadas JSONB DEFAULT '{}'::jsonb,
  provider_message_id VARCHAR(255),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adiciona as colunas caso a tabela já exista
ALTER TABLE central_atendimento_fila_disparos ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(255);
ALTER TABLE central_atendimento_fila_disparos ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE central_atendimento_fila_disparos ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Índices de busca por id de envio da Meta
CREATE INDEX IF NOT EXISTS idx_fila_prov_msg ON central_atendimento_fila_disparos(provider_message_id);
