-- ============================================================
-- DISPARO PRO EMBED: tabelas runtime usadas pelo frontend legado
-- Mantem fora do MandatoPro o admin financeiro/payments do sistema antigo.
-- Estas tabelas atendem os modulos operacionais ja existentes:
-- instancias, contatos importados, historico de campanhas e resultados.
-- ============================================================

CREATE TABLE IF NOT EXISTS instances (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  apikey TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  total_sent INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  last_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS contacts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  email TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, phone)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  instance_id BIGINT REFERENCES instances(id) ON DELETE SET NULL,
  instance_name TEXT,
  name TEXT,
  total_contacts INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  message_preview TEXT,
  has_media BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_results (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  contact_name TEXT,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_msg TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disparo_pro_instances_user
  ON instances(user_id, status);

CREATE INDEX IF NOT EXISTS idx_disparo_pro_contacts_user
  ON contacts(user_id, name);

CREATE INDEX IF NOT EXISTS idx_disparo_pro_campaigns_user_started
  ON campaigns(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_disparo_pro_results_campaign
  ON campaign_results(campaign_id, status);

ALTER TABLE instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS disparo_pro_instances_owner ON instances;
CREATE POLICY disparo_pro_instances_owner
  ON instances FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = instances.user_id
        AND lower(usuarios.email) = lower(auth.jwt() ->> 'email')
        AND usuarios.ativo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = instances.user_id
        AND lower(usuarios.email) = lower(auth.jwt() ->> 'email')
        AND usuarios.ativo = true
    )
  );

DROP POLICY IF EXISTS disparo_pro_contacts_owner ON contacts;
CREATE POLICY disparo_pro_contacts_owner
  ON contacts FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = contacts.user_id
        AND lower(usuarios.email) = lower(auth.jwt() ->> 'email')
        AND usuarios.ativo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = contacts.user_id
        AND lower(usuarios.email) = lower(auth.jwt() ->> 'email')
        AND usuarios.ativo = true
    )
  );

DROP POLICY IF EXISTS disparo_pro_campaigns_owner ON campaigns;
CREATE POLICY disparo_pro_campaigns_owner
  ON campaigns FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = campaigns.user_id
        AND lower(usuarios.email) = lower(auth.jwt() ->> 'email')
        AND usuarios.ativo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = campaigns.user_id
        AND lower(usuarios.email) = lower(auth.jwt() ->> 'email')
        AND usuarios.ativo = true
    )
  );

DROP POLICY IF EXISTS disparo_pro_results_owner ON campaign_results;
CREATE POLICY disparo_pro_results_owner
  ON campaign_results FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = campaign_results.user_id
        AND lower(usuarios.email) = lower(auth.jwt() ->> 'email')
        AND usuarios.ativo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = campaign_results.user_id
        AND lower(usuarios.email) = lower(auth.jwt() ->> 'email')
        AND usuarios.ativo = true
    )
  );
