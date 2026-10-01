-- ==============================================================================
-- Migration 262: Criar Tabelas e Funções Atômicas do Módulo SMS (SMSDev)
-- Tabelas: tenant_sms_balances, sms_service_messages, tenant_sms_transactions
-- Funções: Reserva, Consumo, Liberação, Estorno e Recarga atômica de créditos
-- ==============================================================================

-- 1. TABELA: tenant_sms_balances (Carteira de saldo e status por tenant)
CREATE TABLE IF NOT EXISTS public.tenant_sms_balances (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  saldo_creditos INTEGER NOT NULL DEFAULT 0 CHECK (saldo_creditos >= 0),
  saldo_reservado INTEGER NOT NULL DEFAULT 0 CHECK (saldo_reservado >= 0),
  alerta_saldo_minimo INTEGER NOT NULL DEFAULT 20 CHECK (alerta_saldo_minimo >= 0),
  status VARCHAR(40) NOT NULL DEFAULT 'ATIVO' 
    CHECK (status IN ('ATIVO', 'BLOQUEADO_SALDO_INSUFICIENTE', 'SUSPENSO')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_sms_reserva_menor_igual_saldo CHECK (saldo_reservado <= saldo_creditos)
);

CREATE INDEX IF NOT EXISTS idx_tenant_sms_balances_tenant ON public.tenant_sms_balances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_sms_balances_status ON public.tenant_sms_balances(status);

-- 2. TABELA: sms_service_messages (Histórico e rastreamento de SMS de serviços)
CREATE TABLE IF NOT EXISTS public.sms_service_messages (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  atendimento_id BIGINT NULL REFERENCES public.atendimentos(id) ON DELETE SET NULL,
  eleitor_id BIGINT NULL REFERENCES public.eleitores(id) ON DELETE SET NULL,
  destinatario_telefone VARCHAR(30) NOT NULL,
  destinatario_nome VARCHAR(255) NULL,
  mensagem TEXT NOT NULL,
  refer_id VARCHAR(120) NOT NULL UNIQUE,
  provider VARCHAR(50) NOT NULL DEFAULT 'SMSDEV',
  provider_message_id VARCHAR(120) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pendente' 
    CHECK (status IN ('pendente', 'reservado', 'enviado', 'entregue', 'falha', 'cancelado')),
  tentativas INTEGER NOT NULL DEFAULT 0,
  creditos_cobrados INTEGER NOT NULL DEFAULT 1 CHECK (creditos_cobrados >= 1),
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  ultimo_erro TEXT NULL,
  enviado_em TIMESTAMPTZ NULL,
  entregue_em TIMESTAMPTZ NULL,
  falhou_em TIMESTAMPTZ NULL,
  criado_por_id BIGINT NULL REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_tenant ON public.sms_service_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_atendimento ON public.sms_service_messages(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_refer ON public.sms_service_messages(refer_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_provider_id ON public.sms_service_messages(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_status ON public.sms_service_messages(status);
CREATE INDEX IF NOT EXISTS idx_sms_messages_created ON public.sms_service_messages(created_at DESC);

-- 3. TABELA: tenant_sms_transactions (Ledger contábil auditável e imutável de movimentação)
CREATE TABLE IF NOT EXISTS public.tenant_sms_transactions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL 
    CHECK (tipo IN ('RECARGA', 'DEBITO_ENVIO', 'RESERVA', 'LIBERACAO_RESERVA', 'ESTORNO_FALHA', 'AJUSTE_ADMIN')),
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  saldo_anterior INTEGER NOT NULL,
  saldo_posterior INTEGER NOT NULL,
  saldo_reservado_anterior INTEGER NOT NULL DEFAULT 0,
  saldo_reservado_posterior INTEGER NOT NULL DEFAULT 0,
  sms_message_id BIGINT NULL REFERENCES public.sms_service_messages(id) ON DELETE SET NULL,
  motivo TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_por_id BIGINT NULL REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_trans_tenant ON public.tenant_sms_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sms_trans_tipo ON public.tenant_sms_transactions(tipo);
CREATE INDEX IF NOT EXISTS idx_sms_trans_sms_msg ON public.tenant_sms_transactions(sms_message_id);
CREATE INDEX IF NOT EXISTS idx_sms_trans_created ON public.tenant_sms_transactions(created_at DESC);

-- ==============================================================================
-- 4. FUNÇÕES ATÔMICAS NO POSTGRESQL (Controle de Concorrência via Row-Level Lock)
-- ==============================================================================

-- A. Reservar Crédito (Trava a linha do saldo e garante disponibilidade antes do envio)
CREATE OR REPLACE FUNCTION public.fn_sms_reservar_credito(
  p_tenant_id BIGINT,
  p_quantidade INT,
  p_sms_message_id BIGINT DEFAULT NULL,
  p_usuario_id BIGINT DEFAULT NULL,
  p_motivo TEXT DEFAULT 'Reserva de crédito para envio de SMS'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance RECORD;
  v_saldo_disponivel INT;
  v_trans_id BIGINT;
BEGIN
  IF p_quantidade <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'QUANTIDADE_INVALIDA', 'message', 'Quantidade deve ser maior que zero');
  END IF;

  -- Bloqueia a linha da carteira do tenant para evitar race conditions
  SELECT * INTO v_balance
  FROM public.tenant_sms_balances
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CARTEIRA_NAO_ENCONTRADA', 'message', 'Instituição não possui carteira de SMS cadastrada');
  END IF;

  IF v_balance.status = 'SUSPENSO' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CARTEIRA_SUSPENSA', 'message', 'Carteira de SMS da instituição está suspensa');
  END IF;

  v_saldo_disponivel := v_balance.saldo_creditos - v_balance.saldo_reservado;

  IF v_saldo_disponivel < p_quantidade THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SALDO_INSUFICIENTE',
      'message', 'Saldo insuficiente para reservar créditos',
      'saldo_disponivel', v_saldo_disponivel,
      'quantidade_solicitada', p_quantidade
    );
  END IF;

  -- Atualiza o saldo reservado
  UPDATE public.tenant_sms_balances
  SET saldo_reservado = saldo_reservado + p_quantidade,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  -- Registra no ledger
  INSERT INTO public.tenant_sms_transactions (
    tenant_id,
    tipo,
    quantidade,
    saldo_anterior,
    saldo_posterior,
    saldo_reservado_anterior,
    saldo_reservado_posterior,
    sms_message_id,
    motivo,
    criado_por_id
  ) VALUES (
    p_tenant_id,
    'RESERVA',
    p_quantidade,
    v_balance.saldo_creditos,
    v_balance.saldo_creditos,
    v_balance.saldo_reservado,
    v_balance.saldo_reservado + p_quantidade,
    p_sms_message_id,
    p_motivo,
    p_usuario_id
  ) RETURNING id INTO v_trans_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_trans_id,
    'saldo_creditos', v_balance.saldo_creditos,
    'saldo_reservado', v_balance.saldo_reservado + p_quantidade,
    'saldo_disponivel', v_saldo_disponivel - p_quantidade
  );
END;
$$;

-- B. Confirmar Consumo (Efetiva débito do saldo total e abate a reserva)
CREATE OR REPLACE FUNCTION public.fn_sms_confirmar_consumo(
  p_tenant_id BIGINT,
  p_quantidade INT,
  p_sms_message_id BIGINT DEFAULT NULL,
  p_usuario_id BIGINT DEFAULT NULL,
  p_motivo TEXT DEFAULT 'Confirmação de envio de SMS'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance RECORD;
  v_novo_saldo INT;
  v_novo_reservado INT;
  v_novo_status VARCHAR(40);
  v_trans_id BIGINT;
BEGIN
  IF p_quantidade <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'QUANTIDADE_INVALIDA', 'message', 'Quantidade deve ser maior que zero');
  END IF;

  SELECT * INTO v_balance
  FROM public.tenant_sms_balances
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CARTEIRA_NAO_ENCONTRADA', 'message', 'Carteira não encontrada');
  END IF;

  IF v_balance.saldo_creditos < p_quantidade THEN
    RETURN jsonb_build_object('success', false, 'error', 'SALDO_INSUFICIENTE', 'message', 'Saldo insuficiente para confirmação');
  END IF;

  v_novo_saldo := v_balance.saldo_creditos - p_quantidade;
  v_novo_reservado := GREATEST(0, v_balance.saldo_reservado - p_quantidade);

  IF v_novo_saldo = 0 THEN
    v_novo_status := 'BLOQUEADO_SALDO_INSUFICIENTE';
  ELSE
    v_novo_status := v_balance.status;
  END IF;

  UPDATE public.tenant_sms_balances
  SET saldo_creditos = v_novo_saldo,
      saldo_reservado = v_novo_reservado,
      status = v_novo_status,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO public.tenant_sms_transactions (
    tenant_id,
    tipo,
    quantidade,
    saldo_anterior,
    saldo_posterior,
    saldo_reservado_anterior,
    saldo_reservado_posterior,
    sms_message_id,
    motivo,
    criado_por_id
  ) VALUES (
    p_tenant_id,
    'DEBITO_ENVIO',
    p_quantidade,
    v_balance.saldo_creditos,
    v_novo_saldo,
    v_balance.saldo_reservado,
    v_novo_reservado,
    p_sms_message_id,
    p_motivo,
    p_usuario_id
  ) RETURNING id INTO v_trans_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_trans_id,
    'saldo_creditos', v_novo_saldo,
    'saldo_reservado', v_novo_reservado,
    'saldo_disponivel', v_novo_saldo - v_novo_reservado,
    'status', v_novo_status
  );
END;
$$;

-- C. Liberar Reserva (Cancela reserva sem descontar do saldo total)
CREATE OR REPLACE FUNCTION public.fn_sms_liberar_reserva(
  p_tenant_id BIGINT,
  p_quantidade INT,
  p_sms_message_id BIGINT DEFAULT NULL,
  p_usuario_id BIGINT DEFAULT NULL,
  p_motivo TEXT DEFAULT 'Liberação de reserva de SMS não enviado'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance RECORD;
  v_novo_reservado INT;
  v_trans_id BIGINT;
BEGIN
  IF p_quantidade <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'QUANTIDADE_INVALIDA', 'message', 'Quantidade deve ser maior que zero');
  END IF;

  SELECT * INTO v_balance
  FROM public.tenant_sms_balances
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CARTEIRA_NAO_ENCONTRADA', 'message', 'Carteira não encontrada');
  END IF;

  v_novo_reservado := GREATEST(0, v_balance.saldo_reservado - p_quantidade);

  UPDATE public.tenant_sms_balances
  SET saldo_reservado = v_novo_reservado,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO public.tenant_sms_transactions (
    tenant_id,
    tipo,
    quantidade,
    saldo_anterior,
    saldo_posterior,
    saldo_reservado_anterior,
    saldo_reservado_posterior,
    sms_message_id,
    motivo,
    criado_por_id
  ) VALUES (
    p_tenant_id,
    'LIBERACAO_RESERVA',
    p_quantidade,
    v_balance.saldo_creditos,
    v_balance.saldo_creditos,
    v_balance.saldo_reservado,
    v_novo_reservado,
    p_sms_message_id,
    p_motivo,
    p_usuario_id
  ) RETURNING id INTO v_trans_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_trans_id,
    'saldo_creditos', v_balance.saldo_creditos,
    'saldo_reservado', v_novo_reservado,
    'saldo_disponivel', v_balance.saldo_creditos - v_novo_reservado
  );
END;
$$;

-- D. Estornar Crédito (Reembolsa crédito após falha definitiva confirmada)
CREATE OR REPLACE FUNCTION public.fn_sms_estornar_credito(
  p_tenant_id BIGINT,
  p_quantidade INT,
  p_sms_message_id BIGINT DEFAULT NULL,
  p_usuario_id BIGINT DEFAULT NULL,
  p_motivo TEXT DEFAULT 'Estorno de crédito por falha na entrega'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance RECORD;
  v_novo_saldo INT;
  v_novo_status VARCHAR(40);
  v_trans_id BIGINT;
BEGIN
  IF p_quantidade <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'QUANTIDADE_INVALIDA', 'message', 'Quantidade deve ser maior que zero');
  END IF;

  SELECT * INTO v_balance
  FROM public.tenant_sms_balances
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CARTEIRA_NAO_ENCONTRADA', 'message', 'Carteira não encontrada');
  END IF;

  v_novo_saldo := v_balance.saldo_creditos + p_quantidade;
  v_novo_status := CASE WHEN v_balance.status = 'BLOQUEADO_SALDO_INSUFICIENTE' THEN 'ATIVO' ELSE v_balance.status END;

  UPDATE public.tenant_sms_balances
  SET saldo_creditos = v_novo_saldo,
      status = v_novo_status,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO public.tenant_sms_transactions (
    tenant_id,
    tipo,
    quantidade,
    saldo_anterior,
    saldo_posterior,
    saldo_reservado_anterior,
    saldo_reservado_posterior,
    sms_message_id,
    motivo,
    criado_por_id
  ) VALUES (
    p_tenant_id,
    'ESTORNO_FALHA',
    p_quantidade,
    v_balance.saldo_creditos,
    v_novo_saldo,
    v_balance.saldo_reservado,
    v_balance.saldo_reservado,
    p_sms_message_id,
    p_motivo,
    p_usuario_id
  ) RETURNING id INTO v_trans_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_trans_id,
    'saldo_creditos', v_novo_saldo,
    'saldo_reservado', v_balance.saldo_reservado,
    'saldo_disponivel', v_novo_saldo - v_balance.saldo_reservado,
    'status', v_novo_status
  );
END;
$$;

-- E. Recarregar / Adicionar Crédito (Gestão Administrativa)
CREATE OR REPLACE FUNCTION public.fn_sms_adicionar_credito(
  p_tenant_id BIGINT,
  p_quantidade INT,
  p_usuario_id BIGINT DEFAULT NULL,
  p_motivo TEXT DEFAULT 'Recarga de créditos de SMS'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance RECORD;
  v_novo_saldo INT;
  v_trans_id BIGINT;
BEGIN
  IF p_quantidade <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'QUANTIDADE_INVALIDA', 'message', 'Quantidade deve ser maior que zero');
  END IF;

  -- Cria a carteira caso ainda não exista para o tenant (saldo inicial zero antes da recarga)
  INSERT INTO public.tenant_sms_balances (tenant_id, saldo_creditos, saldo_reservado, status)
  VALUES (p_tenant_id, 0, 0, 'ATIVO')
  ON CONFLICT (tenant_id) DO NOTHING;

  SELECT * INTO v_balance
  FROM public.tenant_sms_balances
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  v_novo_saldo := v_balance.saldo_creditos + p_quantidade;

  UPDATE public.tenant_sms_balances
  SET saldo_creditos = v_novo_saldo,
      status = 'ATIVO',
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO public.tenant_sms_transactions (
    tenant_id,
    tipo,
    quantidade,
    saldo_anterior,
    saldo_posterior,
    saldo_reservado_anterior,
    saldo_reservado_posterior,
    motivo,
    criado_por_id
  ) VALUES (
    p_tenant_id,
    'RECARGA',
    p_quantidade,
    v_balance.saldo_creditos,
    v_novo_saldo,
    v_balance.saldo_reservado,
    v_balance.saldo_reservado,
    p_motivo,
    p_usuario_id
  ) RETURNING id INTO v_trans_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_trans_id,
    'saldo_creditos', v_novo_saldo,
    'saldo_reservado', v_balance.saldo_reservado,
    'saldo_disponivel', v_novo_saldo - v_balance.saldo_reservado,
    'status', 'ATIVO'
  );
END;
$$;

-- F. Consultar Saldo Seguro por Tenant
CREATE OR REPLACE FUNCTION public.fn_sms_consultar_saldo(
  p_tenant_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance RECORD;
BEGIN
  SELECT * INTO v_balance
  FROM public.tenant_sms_balances
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'existe', false,
      'tenant_id', p_tenant_id,
      'saldo_creditos', 0,
      'saldo_reservado', 0,
      'saldo_disponivel', 0,
      'alerta_saldo_minimo', 20,
      'status', 'BLOQUEADO_SALDO_INSUFICIENTE'
    );
  END IF;

  RETURN jsonb_build_object(
    'existe', true,
    'tenant_id', v_balance.tenant_id,
    'saldo_creditos', v_balance.saldo_creditos,
    'saldo_reservado', v_balance.saldo_reservado,
    'saldo_disponivel', v_balance.saldo_creditos - v_balance.saldo_reservado,
    'alerta_saldo_minimo', v_balance.alerta_saldo_minimo,
    'status', v_balance.status,
    'updated_at', v_balance.updated_at
  );
END;
$$;

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.tenant_sms_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_service_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_sms_transactions ENABLE ROW LEVEL SECURITY;

-- Balances: Leitura autenticada permitida
DROP POLICY IF EXISTS authenticated_select_tenant_sms_balances ON public.tenant_sms_balances;
CREATE POLICY authenticated_select_tenant_sms_balances
  ON public.tenant_sms_balances FOR SELECT TO authenticated USING (true);

-- Messages: Leitura autenticada permitida; Inserção e atualização restritas ao backend (service_role)
DROP POLICY IF EXISTS authenticated_select_sms_service_messages ON public.sms_service_messages;
CREATE POLICY authenticated_select_sms_service_messages
  ON public.sms_service_messages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_sms_service_messages ON public.sms_service_messages;
DROP POLICY IF EXISTS authenticated_update_sms_service_messages ON public.sms_service_messages;

-- Transactions: Leitura autenticada (inserções e updates controlados pelas funções SECURITY DEFINER)
DROP POLICY IF EXISTS authenticated_select_tenant_sms_transactions ON public.tenant_sms_transactions;
CREATE POLICY authenticated_select_tenant_sms_transactions
  ON public.tenant_sms_transactions FOR SELECT TO authenticated USING (true);

-- ==============================================================================
-- 6. PERMISSÕES E RESTRIÇÃO DE ACESSO ÀS FUNÇÕES RPC (SECURITY HARDENING)
-- ==============================================================================
-- Funções SECURITY DEFINER de saldo e ledger NUNCA devem ser invocadas diretamente
-- por clientes anônimos ou autenticados (PostgREST). Somente o backend (service_role)
-- ou triggers internos possuem permissão de execução.
-- Revoga acesso público/anon/authenticated e garante acesso estrito ao service_role
DO $$
BEGIN
  -- Permissões das funções RPC de saldo
  GRANT EXECUTE ON FUNCTION public.fn_sms_reservar_credito TO service_role;
  GRANT EXECUTE ON FUNCTION public.fn_sms_confirmar_consumo TO service_role;
  GRANT EXECUTE ON FUNCTION public.fn_sms_liberar_reserva TO service_role;
  GRANT EXECUTE ON FUNCTION public.fn_sms_estornar_credito TO service_role;
  GRANT EXECUTE ON FUNCTION public.fn_sms_adicionar_credito TO service_role;
  GRANT EXECUTE ON FUNCTION public.fn_sms_consultar_saldo TO service_role;
  
  REVOKE EXECUTE ON FUNCTION public.fn_sms_reservar_credito FROM anon, authenticated;
  REVOKE EXECUTE ON FUNCTION public.fn_sms_confirmar_consumo FROM anon, authenticated;
  REVOKE EXECUTE ON FUNCTION public.fn_sms_liberar_reserva FROM anon, authenticated;
  REVOKE EXECUTE ON FUNCTION public.fn_sms_estornar_credito FROM anon, authenticated;
  REVOKE EXECUTE ON FUNCTION public.fn_sms_adicionar_credito FROM anon, authenticated;
  REVOKE EXECUTE ON FUNCTION public.fn_sms_consultar_saldo FROM anon, authenticated;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Aviso nas permissões RPC: %', SQLERRM;
END $$;
