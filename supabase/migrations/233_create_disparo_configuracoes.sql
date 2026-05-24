-- ============================================================
-- DISPAROS: configuracoes operacionais
-- Centraliza intervalos, lotes, IA e parametros do disparador.
-- ============================================================

CREATE TABLE IF NOT EXISTS disparo_configuracoes (
  id BIGSERIAL PRIMARY KEY,
  chave VARCHAR(120) NOT NULL UNIQUE,
  valor JSONB NOT NULL DEFAULT 'null'::jsonb,
  descricao TEXT,
  editavel BOOLEAN NOT NULL DEFAULT true,
  atualizado_por_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE disparo_configuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_select_disparo_configuracoes ON disparo_configuracoes;
CREATE POLICY authenticated_select_disparo_configuracoes
  ON disparo_configuracoes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_disparo_configuracoes ON disparo_configuracoes;
CREATE POLICY authenticated_insert_disparo_configuracoes
  ON disparo_configuracoes FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_update_disparo_configuracoes ON disparo_configuracoes;
CREATE POLICY authenticated_update_disparo_configuracoes
  ON disparo_configuracoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

INSERT INTO disparo_configuracoes (chave, valor, descricao)
VALUES
  ('intervalo_min_segundos', '60'::jsonb, 'Intervalo minimo entre disparos'),
  ('intervalo_max_segundos', '120'::jsonb, 'Intervalo maximo entre disparos'),
  ('limite_lote', '10'::jsonb, 'Quantidade de mensagens por lote'),
  ('pausa_lote_minutos', '10'::jsonb, 'Pausa de seguranca entre lotes'),
  ('ia_reescrita_ativa', 'false'::jsonb, 'Ativa reescrita de mensagens com IA'),
  ('ia_modelo', '"gpt-4o-mini"'::jsonb, 'Modelo padrao para recursos de IA')
ON CONFLICT (chave) DO NOTHING;
