-- Atendimento Connect: atendimento restrito aos retornos do Mandato Connect

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'usuarios'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%nivel%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE usuarios DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_nivel_check
  CHECK (nivel IN ('ADMINISTRADOR', 'LIDERANCA', 'OPERADOR', 'ATENDENTE_CONNECT', 'SUPERVISOR_CONNECT'));

CREATE TABLE IF NOT EXISTS atendimento_connect_conversas (
  id BIGSERIAL PRIMARY KEY,
  eleitor_id BIGINT REFERENCES eleitores(id) ON DELETE SET NULL,
  campanha_id BIGINT REFERENCES disparo_campanhas(id) ON DELETE SET NULL,
  instancia_id BIGINT REFERENCES disparo_instancias(id) ON DELETE SET NULL,
  contato_nome VARCHAR(255),
  contato_telefone VARCHAR(32) NOT NULL,
  canal VARCHAR(30) NOT NULL DEFAULT 'whatsapp',
  status VARCHAR(40) NOT NULL DEFAULT 'nova'
    CHECK (status IN ('nova', 'em_atendimento', 'aguardando_eleitor', 'resolver_depois', 'concluida')),
  prioridade VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  responsavel_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  ultima_mensagem TEXT,
  ultima_mensagem_em TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_por_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  atualizado_por_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS atendimento_connect_mensagens (
  id BIGSERIAL PRIMARY KEY,
  conversa_id BIGINT NOT NULL REFERENCES atendimento_connect_conversas(id) ON DELETE CASCADE,
  direcao VARCHAR(20) NOT NULL CHECK (direcao IN ('entrada', 'saida', 'sistema', 'nota')),
  mensagem TEXT NOT NULL,
  media_url TEXT,
  media_tipo VARCHAR(80),
  provider_message_id VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'registrada',
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS atendimento_connect_etiquetas (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(80) NOT NULL UNIQUE,
  cor VARCHAR(20) NOT NULL DEFAULT '#0d9488',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS atendimento_connect_conversa_etiquetas (
  conversa_id BIGINT NOT NULL REFERENCES atendimento_connect_conversas(id) ON DELETE CASCADE,
  etiqueta_id BIGINT NOT NULL REFERENCES atendimento_connect_etiquetas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversa_id, etiqueta_id)
);

CREATE TABLE IF NOT EXISTS atendimento_connect_eventos (
  id BIGSERIAL PRIMARY KEY,
  conversa_id BIGINT NOT NULL REFERENCES atendimento_connect_conversas(id) ON DELETE CASCADE,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo VARCHAR(60) NOT NULL,
  descricao TEXT,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_atendimento_connect_conversas_canal_tel_inst
  ON atendimento_connect_conversas (canal, contato_telefone, (COALESCE(instancia_id, 0)));

CREATE INDEX IF NOT EXISTS idx_atendimento_connect_conversas_status
  ON atendimento_connect_conversas (status);

CREATE INDEX IF NOT EXISTS idx_atendimento_connect_conversas_responsavel
  ON atendimento_connect_conversas (responsavel_id);

CREATE INDEX IF NOT EXISTS idx_atendimento_connect_conversas_ultima
  ON atendimento_connect_conversas (ultima_mensagem_em DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_atendimento_connect_mensagens_conversa
  ON atendimento_connect_mensagens (conversa_id, created_at ASC);
