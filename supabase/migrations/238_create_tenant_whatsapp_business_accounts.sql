CREATE TABLE IF NOT EXISTS public.tenants (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  slug VARCHAR(120) UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'ATIVO'
    CHECK (status IN ('ATIVO', 'INATIVO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.tenants (nome, slug)
SELECT 'Tenant principal', 'principal'
WHERE NOT EXISTS (SELECT 1 FROM public.tenants);

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES public.tenants(id) ON DELETE RESTRICT;

UPDATE public.usuarios
SET tenant_id = (SELECT id FROM public.tenants ORDER BY id ASC LIMIT 1)
WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_tenant_id
  ON public.usuarios(tenant_id);

CREATE TABLE IF NOT EXISTS public.whatsapp_business_accounts (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL DEFAULT 'WhatsApp Business',
  business_manager_id VARCHAR(120),
  business_manager_name VARCHAR(255),
  business_verification_status VARCHAR(120),
  waba_id VARCHAR(120),
  waba_name VARCHAR(255),
  waba_verification_status VARCHAR(120),
  access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  access_token_obtained_at TIMESTAMPTZ,
  access_token_type VARCHAR(80),
  access_token_source VARCHAR(40) NOT NULL DEFAULT 'MANUAL'
    CHECK (access_token_source IN ('MANUAL', 'EMBEDDED_SIGNUP', 'RENEWAL')),
  access_token_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  token_debug_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  waba_validation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  phone_validation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedded_signup_completed BOOLEAN NOT NULL DEFAULT FALSE,
  token_validated BOOLEAN NOT NULL DEFAULT FALSE,
  waba_validated BOOLEAN NOT NULL DEFAULT FALSE,
  phone_validated BOOLEAN NOT NULL DEFAULT FALSE,
  production_ready BOOLEAN NOT NULL DEFAULT FALSE,
  phone_registration_pending BOOLEAN NOT NULL DEFAULT FALSE,
  phone_registered BOOLEAN NOT NULL DEFAULT FALSE,
  phone_registration_failed BOOLEAN NOT NULL DEFAULT FALSE,
  phone_registered_at TIMESTAMPTZ,
  phone_registration_message TEXT,
  phone_registration_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  webhook_pending BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_verified BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_receiving_events BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_last_verified_at TIMESTAMPTZ,
  webhook_last_event_at TIMESTAMPTZ,
  webhook_last_signature_status VARCHAR(30),
  webhook_validation_message TEXT,
  last_synced_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(30),
  sync_message TEXT,
  verify_token TEXT,
  app_id VARCHAR(120),
  app_secret TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'ATIVO'
    CHECK (status IN ('ATIVO', 'INATIVO')),
  principal BOOLEAN NOT NULL DEFAULT FALSE,
  criado_por_id BIGINT REFERENCES public.usuarios(id) ON DELETE SET NULL,
  atualizado_por_id BIGINT REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waba_principal_por_tenant
  ON public.whatsapp_business_accounts(tenant_id)
  WHERE principal = TRUE;

CREATE INDEX IF NOT EXISTS idx_waba_tenant_status
  ON public.whatsapp_business_accounts(tenant_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waba_verify_token
  ON public.whatsapp_business_accounts(verify_token)
  WHERE verify_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_business_numbers (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES public.whatsapp_business_accounts(id) ON DELETE CASCADE,
  phone_number_id VARCHAR(120) NOT NULL,
  display_phone_number VARCHAR(40),
  display_name VARCHAR(255),
  verified_name VARCHAR(255),
  quality_rating VARCHAR(80),
  messaging_limit_tier VARCHAR(120),
  number_status VARCHAR(80),
  country_code VARCHAR(20),
  name_status VARCHAR(120),
  profile_about TEXT,
  profile_address TEXT,
  profile_description TEXT,
  profile_email VARCHAR(255),
  profile_websites JSONB NOT NULL DEFAULT '[]'::jsonb,
  profile_vertical VARCHAR(120),
  profile_picture_url TEXT,
  profile_synced_at TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'ATIVO'
    CHECK (status IN ('ATIVO', 'INATIVO')),
  principal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, phone_number_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waba_number_principal_por_account
  ON public.whatsapp_business_numbers(account_id)
  WHERE principal = TRUE;

CREATE INDEX IF NOT EXISTS idx_waba_numbers_tenant_status
  ON public.whatsapp_business_numbers(tenant_id, status);

CREATE TABLE IF NOT EXISTS public.whatsapp_business_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT REFERENCES public.tenants(id) ON DELETE SET NULL,
  account_id BIGINT REFERENCES public.whatsapp_business_accounts(id) ON DELETE SET NULL,
  event_type VARCHAR(120),
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  waba_id VARCHAR(120),
  phone_number_id VARCHAR(120),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_status VARCHAR(30) NOT NULL DEFAULT 'INVALID'
    CHECK (validation_status IN ('VALID', 'INVALID')),
  signature_status VARCHAR(30) NOT NULL DEFAULT 'MISSING'
    CHECK (signature_status IN ('VALID', 'INVALID', 'MISSING')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waba_webhook_events_tenant_created
  ON public.whatsapp_business_webhook_events(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_waba_webhook_events_waba_phone
  ON public.whatsapp_business_webhook_events(waba_id, phone_number_id);

CREATE TABLE IF NOT EXISTS public.whatsapp_business_sync_history (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT REFERENCES public.tenants(id) ON DELETE SET NULL,
  account_id BIGINT REFERENCES public.whatsapp_business_accounts(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  updated_items INTEGER NOT NULL DEFAULT 0,
  meta_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  diff JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waba_sync_history_tenant_started
  ON public.whatsapp_business_sync_history(tenant_id, started_at DESC);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_business_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_business_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_business_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_business_sync_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_select_tenants ON public.tenants;
CREATE POLICY authenticated_select_tenants
  ON public.tenants FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_select_whatsapp_business_accounts ON public.whatsapp_business_accounts;
CREATE POLICY authenticated_select_whatsapp_business_accounts
  ON public.whatsapp_business_accounts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_whatsapp_business_accounts ON public.whatsapp_business_accounts;
CREATE POLICY authenticated_insert_whatsapp_business_accounts
  ON public.whatsapp_business_accounts FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_update_whatsapp_business_accounts ON public.whatsapp_business_accounts;
CREATE POLICY authenticated_update_whatsapp_business_accounts
  ON public.whatsapp_business_accounts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_whatsapp_business_numbers ON public.whatsapp_business_numbers;
CREATE POLICY authenticated_select_whatsapp_business_numbers
  ON public.whatsapp_business_numbers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_whatsapp_business_numbers ON public.whatsapp_business_numbers;
CREATE POLICY authenticated_insert_whatsapp_business_numbers
  ON public.whatsapp_business_numbers FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_update_whatsapp_business_numbers ON public.whatsapp_business_numbers;
CREATE POLICY authenticated_update_whatsapp_business_numbers
  ON public.whatsapp_business_numbers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_whatsapp_business_webhook_events ON public.whatsapp_business_webhook_events;
CREATE POLICY authenticated_select_whatsapp_business_webhook_events
  ON public.whatsapp_business_webhook_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_whatsapp_business_webhook_events ON public.whatsapp_business_webhook_events;
CREATE POLICY authenticated_insert_whatsapp_business_webhook_events
  ON public.whatsapp_business_webhook_events FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_whatsapp_business_sync_history ON public.whatsapp_business_sync_history;
CREATE POLICY authenticated_select_whatsapp_business_sync_history
  ON public.whatsapp_business_sync_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_whatsapp_business_sync_history ON public.whatsapp_business_sync_history;
CREATE POLICY authenticated_insert_whatsapp_business_sync_history
  ON public.whatsapp_business_sync_history FOR INSERT TO authenticated WITH CHECK (true);
