-- ==============================================================================
-- Migration 265: Controle de Idempotência Atômica Inbound WhatsApp
-- Data: 2026-11-19
-- Projeto: MandatoPRO
-- 
-- OBJETIVO:
-- Garantir deduplicação atômica e concorrência estrita para novos eventos de entrada
-- via webhooks de WhatsApp através de tabela de controle dedicada, com:
-- 1. Transição atômica condicional (compare-and-swap) na retomada de locks FAILED/expirados,
--    revalidando atomicamente o timeout no WHERE do UPDATE usando o estado atual da linha.
-- 2. Fencing Token monotônico (attempt_number) e validação de status = 'PROCESSING'
--    em concluir_reserva_inbound e liberar_reserva_inbound.
-- 3. Permissões estritas concedidas exclusivamente a service_role.
-- 4. Preservação 100% integral dos dados históricos (ZERO UPDATE / ZERO DELETE nas mensagens).
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_idempotency (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  provider VARCHAR(40) NOT NULL,
  account_id BIGINT NOT NULL,
  instance_id VARCHAR(120),
  provider_message_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  attempt_number BIGINT NOT NULL DEFAULT 1,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint UNIQUE atômica que garante exclusão mútua por escopo
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_inbound_idempotency_key
  ON public.whatsapp_inbound_idempotency (tenant_id, provider, account_id, provider_message_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_idempotency_status_locked
  ON public.whatsapp_inbound_idempotency (status, locked_at);

-- 1. Função atômica com Fencing Token para adquirir ou retomar reserva
CREATE OR REPLACE FUNCTION public.adquirir_reserva_inbound(
  p_tenant_id BIGINT,
  p_provider VARCHAR,
  p_account_id BIGINT,
  p_instance_id VARCHAR,
  p_provider_message_id VARCHAR,
  p_timeout_segundos INT DEFAULT 60
)
RETURNS TABLE (
  sucesso BOOLEAN,
  duplicada BOOLEAN,
  bloqueada BOOLEAN,
  reserva_id BIGINT,
  fencing_token BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reserva_id BIGINT;
  v_fencing_token BIGINT;
  v_reg RECORD;
BEGIN
  -- 1. Tentativa de inserção direta para evento novo
  INSERT INTO public.whatsapp_inbound_idempotency (
    tenant_id,
    provider,
    account_id,
    instance_id,
    provider_message_id,
    status,
    attempt_number,
    locked_at,
    updated_at
  ) VALUES (
    p_tenant_id,
    p_provider,
    p_account_id,
    p_instance_id,
    p_provider_message_id,
    'PROCESSING',
    1,
    NOW(),
    NOW()
  )
  ON CONFLICT (tenant_id, provider, account_id, provider_message_id) DO NOTHING
  RETURNING id, attempt_number INTO v_reserva_id, v_fencing_token;

  IF v_reserva_id IS NOT NULL THEN
    RETURN QUERY SELECT TRUE, FALSE, FALSE, v_reserva_id, v_fencing_token;
    RETURN;
  END IF;

  -- 2. Conflito: inspeciona registro existente
  SELECT id, status, attempt_number, locked_at INTO v_reg
  FROM public.whatsapp_inbound_idempotency
  WHERE tenant_id = p_tenant_id
    AND provider = p_provider
    AND account_id = p_account_id
    AND provider_message_id = p_provider_message_id;

  IF v_reg.status = 'COMPLETED' THEN
    RETURN QUERY SELECT FALSE, TRUE, FALSE, v_reg.id, v_reg.attempt_number;
    RETURN;
  END IF;

  -- 3. Retomada atômica condicional com revalidação estrita do timeout no WHERE do UPDATE (Ajuste 1)
  IF v_reg.status = 'FAILED' OR (v_reg.status = 'PROCESSING' AND v_reg.locked_at < (NOW() - (p_timeout_segundos || ' seconds')::INTERVAL)) THEN
    UPDATE public.whatsapp_inbound_idempotency
    SET status = 'PROCESSING',
        attempt_number = attempt_number + 1,
        locked_at = NOW(),
        updated_at = NOW(),
        last_error = NULL
    WHERE id = v_reg.id
      AND attempt_number = v_reg.attempt_number
      AND (
        status = 'FAILED' 
        OR (status = 'PROCESSING' AND locked_at < (NOW() - (p_timeout_segundos || ' seconds')::INTERVAL))
      )
    RETURNING id, attempt_number INTO v_reserva_id, v_fencing_token;

    -- Se o UPDATE afetou a linha, a reserva exclusiva foi ganha por este nó
    IF v_reserva_id IS NOT NULL THEN
      RETURN QUERY SELECT TRUE, FALSE, FALSE, v_reserva_id, v_fencing_token;
      RETURN;
    END IF;
  END IF;

  -- 4. Bloqueio ativo por outro nó
  RETURN QUERY SELECT FALSE, FALSE, TRUE, v_reg.id, v_reg.attempt_number;
  RETURN;
END;
$$;

-- 2. Conclusão da reserva validada por Fencing Token e status = 'PROCESSING' (Ajuste 2)
CREATE OR REPLACE FUNCTION public.concluir_reserva_inbound(
  p_reserva_id BIGINT,
  p_fencing_token BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE public.whatsapp_inbound_idempotency
  SET status = 'COMPLETED',
      completed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_reserva_id
    AND attempt_number = p_fencing_token
    AND status = 'PROCESSING';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- 3. Liberação da reserva validada por Fencing Token e status = 'PROCESSING' (Ajuste 2)
CREATE OR REPLACE FUNCTION public.liberar_reserva_inbound(
  p_reserva_id BIGINT,
  p_fencing_token BIGINT,
  p_erro TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE public.whatsapp_inbound_idempotency
  SET status = 'FAILED',
      failed_at = NOW(),
      last_error = p_erro,
      updated_at = NOW()
  WHERE id = p_reserva_id
    AND attempt_number = p_fencing_token
    AND status = 'PROCESSING';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- 4. Restrição estrita de permissões ao backend (Ajuste 4)
REVOKE ALL ON TABLE public.whatsapp_inbound_idempotency FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.adquirir_reserva_inbound FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.concluir_reserva_inbound FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.liberar_reserva_inbound FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.whatsapp_inbound_idempotency TO service_role;
GRANT EXECUTE ON FUNCTION public.adquirir_reserva_inbound TO service_role;
GRANT EXECUTE ON FUNCTION public.concluir_reserva_inbound TO service_role;
GRANT EXECUTE ON FUNCTION public.liberar_reserva_inbound TO service_role;

COMMIT;
