-- Migration 254: Criar tabela para rastreamento de sessoes de onboarding WaBlast Partner
CREATE TABLE IF NOT EXISTS public.whatsapp_wablast_onboarding_sessions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id VARCHAR(120) NOT NULL UNIQUE,
  external_ref VARCHAR(120) NOT NULL,
  status VARCHAR(60) NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ,
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wablast_sessions_tenant_status
  ON public.whatsapp_wablast_onboarding_sessions(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_wablast_sessions_external_ref
  ON public.whatsapp_wablast_onboarding_sessions(external_ref);

ALTER TABLE public.whatsapp_wablast_onboarding_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_all_wablast_sessions ON public.whatsapp_wablast_onboarding_sessions;
CREATE POLICY authenticated_all_wablast_sessions
  ON public.whatsapp_wablast_onboarding_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
