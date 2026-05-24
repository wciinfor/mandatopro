-- ============================================================
-- DISPAROS: campanhas, contatos, envios e logs
-- Estrutura isolada do modulo antigo Disparo PRO.
-- Os contatos de campanha sao snapshots da base do MandatoPro.
-- ============================================================

CREATE TABLE IF NOT EXISTS disparo_campanhas (
  id BIGSERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  mensagem TEXT NOT NULL,
  instancia_id BIGINT REFERENCES disparo_instancias(id) ON DELETE SET NULL,
  origem_contatos VARCHAR(30) NOT NULL DEFAULT 'filtros'
    CHECK (origem_contatos IN ('filtros', 'csv', 'misto', 'manual')),
  filtros JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(40) NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'agendada', 'em_andamento', 'pausada', 'concluida', 'cancelada', 'falhou')),
  total_contatos INTEGER NOT NULL DEFAULT 0,
  total_validos INTEGER NOT NULL DEFAULT 0,
  total_invalidos INTEGER NOT NULL DEFAULT 0,
  total_enviados INTEGER NOT NULL DEFAULT 0,
  total_falhas INTEGER NOT NULL DEFAULT 0,
  intervalo_min_segundos INTEGER NOT NULL DEFAULT 8,
  intervalo_max_segundos INTEGER NOT NULL DEFAULT 20,
  agendada_para TIMESTAMPTZ,
  iniciada_em TIMESTAMPTZ,
  concluida_em TIMESTAMPTZ,
  criado_por_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  atualizado_por_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disparo_contatos (
  id BIGSERIAL PRIMARY KEY,
  campanha_id BIGINT REFERENCES disparo_campanhas(id) ON DELETE CASCADE,
  origem VARCHAR(30) NOT NULL DEFAULT 'eleitor'
    CHECK (origem IN ('eleitor', 'lideranca', 'funcionario', 'csv', 'manual')),
  origem_id BIGINT,
  nome VARCHAR(255),
  telefone_original VARCHAR(60),
  telefone_normalizado VARCHAR(30),
  cidade VARCHAR(150),
  bairro VARCHAR(150),
  valido BOOLEAN NOT NULL DEFAULT false,
  motivo_invalido TEXT,
  duplicado BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disparo_envios (
  id BIGSERIAL PRIMARY KEY,
  campanha_id BIGINT REFERENCES disparo_campanhas(id) ON DELETE CASCADE,
  contato_id BIGINT REFERENCES disparo_contatos(id) ON DELETE SET NULL,
  instancia_id BIGINT REFERENCES disparo_instancias(id) ON DELETE SET NULL,
  telefone VARCHAR(30) NOT NULL,
  mensagem TEXT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'processando', 'enviado', 'falhou', 'cancelado')),
  tentativas INTEGER NOT NULL DEFAULT 0,
  provider_message_id VARCHAR(255),
  erro TEXT,
  agendado_para TIMESTAMPTZ,
  enviado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disparo_logs (
  id BIGSERIAL PRIMARY KEY,
  campanha_id BIGINT REFERENCES disparo_campanhas(id) ON DELETE CASCADE,
  envio_id BIGINT REFERENCES disparo_envios(id) ON DELETE SET NULL,
  instancia_id BIGINT REFERENCES disparo_instancias(id) ON DELETE SET NULL,
  nivel VARCHAR(20) NOT NULL DEFAULT 'info'
    CHECK (nivel IN ('debug', 'info', 'warn', 'error')),
  evento VARCHAR(100) NOT NULL,
  mensagem TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disparo_campanhas_status
  ON disparo_campanhas(status);

CREATE INDEX IF NOT EXISTS idx_disparo_campanhas_instancia
  ON disparo_campanhas(instancia_id);

CREATE INDEX IF NOT EXISTS idx_disparo_contatos_campanha
  ON disparo_contatos(campanha_id);

CREATE INDEX IF NOT EXISTS idx_disparo_contatos_telefone
  ON disparo_contatos(telefone_normalizado);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_disparo_contato_campanha_telefone
  ON disparo_contatos(campanha_id, telefone_normalizado)
  WHERE telefone_normalizado IS NOT NULL AND telefone_normalizado <> '';

CREATE INDEX IF NOT EXISTS idx_disparo_envios_campanha_status
  ON disparo_envios(campanha_id, status);

CREATE INDEX IF NOT EXISTS idx_disparo_envios_agendado
  ON disparo_envios(agendado_para)
  WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS idx_disparo_logs_campanha
  ON disparo_logs(campanha_id, created_at DESC);

ALTER TABLE disparo_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE disparo_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE disparo_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE disparo_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_select_disparo_campanhas ON disparo_campanhas;
CREATE POLICY authenticated_select_disparo_campanhas
  ON disparo_campanhas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_disparo_campanhas ON disparo_campanhas;
CREATE POLICY authenticated_insert_disparo_campanhas
  ON disparo_campanhas FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_update_disparo_campanhas ON disparo_campanhas;
CREATE POLICY authenticated_update_disparo_campanhas
  ON disparo_campanhas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_delete_disparo_campanhas ON disparo_campanhas;
CREATE POLICY authenticated_delete_disparo_campanhas
  ON disparo_campanhas FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_select_disparo_contatos ON disparo_contatos;
CREATE POLICY authenticated_select_disparo_contatos
  ON disparo_contatos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_disparo_contatos ON disparo_contatos;
CREATE POLICY authenticated_insert_disparo_contatos
  ON disparo_contatos FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_update_disparo_contatos ON disparo_contatos;
CREATE POLICY authenticated_update_disparo_contatos
  ON disparo_contatos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_delete_disparo_contatos ON disparo_contatos;
CREATE POLICY authenticated_delete_disparo_contatos
  ON disparo_contatos FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_select_disparo_envios ON disparo_envios;
CREATE POLICY authenticated_select_disparo_envios
  ON disparo_envios FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_disparo_envios ON disparo_envios;
CREATE POLICY authenticated_insert_disparo_envios
  ON disparo_envios FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_update_disparo_envios ON disparo_envios;
CREATE POLICY authenticated_update_disparo_envios
  ON disparo_envios FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_delete_disparo_envios ON disparo_envios;
CREATE POLICY authenticated_delete_disparo_envios
  ON disparo_envios FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_select_disparo_logs ON disparo_logs;
CREATE POLICY authenticated_select_disparo_logs
  ON disparo_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_disparo_logs ON disparo_logs;
CREATE POLICY authenticated_insert_disparo_logs
  ON disparo_logs FOR INSERT TO authenticated WITH CHECK (true);
