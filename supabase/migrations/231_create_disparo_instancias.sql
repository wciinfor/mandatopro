-- ============================================================
-- DISPAROS: instancias WhatsApp / Evolution API
-- Mantem apenas o modulo operacional no MandatoPro.
-- O admin financeiro do sistema legado nao e trazido para ca.
-- ============================================================

CREATE TABLE IF NOT EXISTS disparo_instancias (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL UNIQUE,
  api_key TEXT,
  provider VARCHAR(40) NOT NULL DEFAULT 'evolution',
  status VARCHAR(40) NOT NULL DEFAULT 'desconectada',
  numero VARCHAR(40),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_por_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  atualizado_por_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disparo_instancias_status
  ON disparo_instancias(status);

CREATE INDEX IF NOT EXISTS idx_disparo_instancias_provider
  ON disparo_instancias(provider);

ALTER TABLE disparo_instancias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_select_disparo_instancias ON disparo_instancias;
CREATE POLICY authenticated_select_disparo_instancias
  ON disparo_instancias FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS authenticated_insert_disparo_instancias ON disparo_instancias;
CREATE POLICY authenticated_insert_disparo_instancias
  ON disparo_instancias FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_update_disparo_instancias ON disparo_instancias;
CREATE POLICY authenticated_update_disparo_instancias
  ON disparo_instancias FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_delete_disparo_instancias ON disparo_instancias;
CREATE POLICY authenticated_delete_disparo_instancias
  ON disparo_instancias FOR DELETE
  TO authenticated
  USING (true);
