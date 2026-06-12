-- ============================================================
-- DISPARO PRO — SCHEMA SAAS MULTI-TENANT (PRODUÇÃO v2.0)
-- Data: 2026-05-08 | Supabase Dashboard → SQL Editor
-- ============================================================
--
-- ORDEM DE EXECUÇÃO (obrigatória):
--   1. Extensões
--   2. Enums
--   3. Função set_updated_at (sem deps de tabela)
--   4. Tabelas-base: users_profiles → workspaces → workspace_members
--   5. Funções de acesso SECURITY DEFINER (após workspace_members)
--   6. Função bootstrap create_workspace_with_owner (SECURITY DEFINER)
--   7. Billing: plans → subscriptions → payments
--   8. Instâncias: instances → sessions → health_logs → warmups
--   9. Contatos: contacts → contact_tags → contact_notes
--  10. Agentes: departments → agents → agent_status
--  11. Campanhas: campaigns → messages → contacts → jobs → logs
--  12. Conversas: conversations → messages → assignments → labels → ai
--  13. Infra: notifications → audit_logs → webhook_events → system_settings
--  14. Triggers updated_at
--  15. Auth hook
--  16. Índices
--  17. Habilitar RLS
--  18. Políticas RLS
--  19. Realtime REPLICA IDENTITY
--  20. Tabelas legadas (preservadas para migração gradual)
-- ============================================================


-- ============================================================
-- 1. EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 2. ENUMS
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_role') THEN
        CREATE TYPE public.workspace_role AS ENUM ('owner','admin','agent','operator');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_member_status') THEN
        CREATE TYPE public.workspace_member_status AS ENUM ('active','invited','disabled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','paused','canceled','incomplete');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE public.payment_status AS ENUM ('pending','paid','overdue','canceled','refunded');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'instance_status') THEN
        CREATE TYPE public.instance_status AS ENUM ('connected','disconnected','connecting','error','unknown');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'instance_session_status') THEN
        CREATE TYPE public.instance_session_status AS ENUM ('open','closed','error');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_status') THEN
        CREATE TYPE public.campaign_status AS ENUM ('draft','scheduled','running','paused','completed','failed','canceled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_job_status') THEN
        CREATE TYPE public.dispatch_job_status AS ENUM ('queued','scheduled','running','retrying','completed','failed','canceled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_log_status') THEN
        CREATE TYPE public.dispatch_log_status AS ENUM ('pending','success','error','skipped');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_status') THEN
        CREATE TYPE public.conversation_status AS ENUM ('open','pending','waiting','closed','archived');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_direction') THEN
        CREATE TYPE public.message_direction AS ENUM ('inbound','outbound','system','ai');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_status') THEN
        CREATE TYPE public.message_status AS ENUM ('queued','sent','delivered','read','failed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_presence_status') THEN
        CREATE TYPE public.agent_presence_status AS ENUM ('online','offline','busy','away','dnd');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
        CREATE TYPE public.notification_status AS ENUM ('unread','read');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_event_status') THEN
        CREATE TYPE public.webhook_event_status AS ENUM ('received','processing','processed','failed');
    END IF;
END $$;


-- ============================================================
-- 0. PRÉ-MIGRAÇÃO: renomear tabelas legadas conflitantes
-- ============================================================
-- CAUSA DO ERRO "column workspace_id does not exist":
--   O banco já possui tabelas do schema single-tenant anterior
--   (sem workspace_id). O CREATE TABLE IF NOT EXISTS as ignora,
--   mas as policies RLS tentam referenciar workspace_id nelas.
--
-- SOLUÇÃO: renomear para *_legacy ANTES de criar as novas.
--   • A renomeação só ocorre se a tabela existir E não tiver workspace_id.
--   • Se a tabela já tiver workspace_id (schema v1 ou v2 anterior),
--     nada é feito — evita afetar execuções subsequentes.
--   • FKs internas entre as tabelas legadas são preservadas pelo PostgreSQL
--     (rastreadas por OID, não pelo nome).
DO $$
BEGIN
    -- instances (renomeia somente se não tiver workspace_id)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'instances'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'instances'
          AND column_name = 'workspace_id'
    ) THEN
        ALTER TABLE public.instances RENAME TO instances_legacy;
        RAISE NOTICE 'Pré-migração: instances → instances_legacy';
    END IF;

    -- contacts
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'contacts'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'contacts'
          AND column_name = 'workspace_id'
    ) THEN
        ALTER TABLE public.contacts RENAME TO contacts_legacy;
        RAISE NOTICE 'Pré-migração: contacts → contacts_legacy';
    END IF;

    -- campaigns
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'campaigns'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'campaigns'
          AND column_name = 'workspace_id'
    ) THEN
        ALTER TABLE public.campaigns RENAME TO campaigns_legacy;
        RAISE NOTICE 'Pré-migração: campaigns → campaigns_legacy';
    END IF;

    -- campaign_results → campaign_results_legacy (nome muda no novo schema)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'campaign_results'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'campaign_results_legacy'
    ) THEN
        ALTER TABLE public.campaign_results RENAME TO campaign_results_legacy;
        RAISE NOTICE 'Pré-migração: campaign_results → campaign_results_legacy';
    END IF;

    -- payments
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'payments'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payments'
          AND column_name = 'workspace_id'
    ) THEN
        ALTER TABLE public.payments RENAME TO payments_legacy;
        RAISE NOTICE 'Pré-migração: payments → payments_legacy';
    END IF;
END $$;


-- ============================================================
-- 3. FUNÇÃO set_updated_at (sem dependência de tabela)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 4. TABELAS-BASE
-- ============================================================

-- 4.1 Perfis de usuário
--     default_workspace_id recebe FK via ALTER após workspaces ser criada
CREATE TABLE IF NOT EXISTS public.users_profiles (
    id                   UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name            TEXT        NOT NULL DEFAULT '',
    email                TEXT,
    phone                TEXT,
    avatar_url           TEXT,
    is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
    default_workspace_id UUID,                          -- FK adicionada abaixo
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.2 Workspaces (tenants raiz)
CREATE TABLE IF NOT EXISTS public.workspaces (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT        NOT NULL,
    slug          TEXT        UNIQUE,
    owner_user_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    status        TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','suspended','canceled')),
    timezone      TEXT        NOT NULL DEFAULT 'America/Sao_Paulo',
    metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK users_profiles.default_workspace_id → workspaces (workspaces já existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name   = 'fk_users_profiles_default_workspace'
          AND table_name        = 'users_profiles'
          AND constraint_schema = 'public'        -- evita colisão com outros schemas
    ) THEN
        ALTER TABLE public.users_profiles
            ADD CONSTRAINT fk_users_profiles_default_workspace
            FOREIGN KEY (default_workspace_id)
            REFERENCES public.workspaces(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- 4.3 Membros do workspace
--     Tabela central de isolamento multi-tenant.
--     Todas as funções de acesso consultam esta tabela.
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id           UUID                           PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID                           NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id      UUID                           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role         public.workspace_role          NOT NULL DEFAULT 'operator',
    status       public.workspace_member_status NOT NULL DEFAULT 'active',
    invited_by   UUID                           REFERENCES auth.users(id) ON DELETE SET NULL,
    joined_at    TIMESTAMPTZ                    NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ                    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ                    NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, user_id)
);


-- ============================================================
-- 5. FUNÇÕES DE ACESSO AO WORKSPACE (SECURITY DEFINER)
-- ============================================================
-- ESTRATÉGIA ANTI-RECURSÃO DE RLS:
--
--   Problema clássico: uma policy em workspace_members chama
--   has_workspace_access(), que por sua vez faz SELECT em
--   workspace_members — infinito.
--
--   Solução: SECURITY DEFINER + SET search_path = public
--     • A função executa como dono (postgres/superuser)
--     • Isso bypassa o RLS nas consultas internas da função
--     • Quebra o ciclo: policy → função → tabela sem policy
--
--   Segurança mantida:
--     • search_path fixo evita schema poisoning
--     • auth.uid() valida o usuário corrente dentro da função
--     • Não há parâmetros externos que possam ser injetados
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_workspace_access(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND user_id      = auth.uid()
          AND status       = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND user_id      = auth.uid()
          AND status       = 'active'
          AND role         IN ('owner','admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND user_id      = auth.uid()
          AND status       = 'active'
          AND role         = 'owner'
    );
$$;

-- GRANT para o papel authenticated poder chamar as funções de acesso.
-- Necessário porque Supabase pode revogar EXECUTE de PUBLIC por padrão.
-- Estas funções são invocadas nas policies RLS sempre que o usuário autenticado
-- faz qualquer operação em tabelas protegidas.
GRANT EXECUTE ON FUNCTION public.has_workspace_access(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(UUID)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(UUID)    TO authenticated;


-- ============================================================
-- 6. BOOTSTRAP: CRIAR WORKSPACE COM OWNER (SECURITY DEFINER)
-- ============================================================
-- PROBLEMA RESOLVIDO:
--   Sem esta função, o fluxo de criação quebraria assim:
--     INSERT workspaces  → OK (policy: owner_user_id = auth.uid())
--     INSERT workspace_members (owner) → BLOQUEADO pelo RLS
--       (is_workspace_admin retorna FALSE: usuário ainda não é membro)
--
-- SOLUÇÃO:
--   Função SECURITY DEFINER que atomicamente:
--     1. Valida auth.uid() (sem autenticação = erro imediato)
--     2. Insere o workspace
--     3. Insere o criador como owner (bypassa RLS por SECURITY DEFINER)
--     4. Define como workspace padrão do perfil (se vazio)
--
-- USO NO FRONTEND (JS):
--   const { data: workspaceId, error } = await supabase
--     .rpc('create_workspace_with_owner', {
--       p_name: 'Minha Empresa',
--       p_slug: 'minha-empresa'          -- opcional
--     });
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(
    p_name TEXT,
    p_slug TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_workspace_id UUID;
    v_caller_id    UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado: impossível criar workspace sem usuário válido.';
    END IF;

    -- Insere workspace
    INSERT INTO public.workspaces (name, slug, owner_user_id)
    VALUES (TRIM(p_name), NULLIF(TRIM(COALESCE(p_slug,'')), ''), v_caller_id)
    RETURNING id INTO v_workspace_id;

    -- Insere owner sem passar por RLS (SECURITY DEFINER)
    INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
    VALUES (v_workspace_id, v_caller_id, 'owner', 'active')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    -- Define workspace padrão (apenas se ainda não tiver)
    UPDATE public.users_profiles
       SET default_workspace_id = v_workspace_id
     WHERE id = v_caller_id
       AND default_workspace_id IS NULL;

    RETURN v_workspace_id;
END;
$$;

-- GRANT para chamada direta via supabase.rpc('create_workspace_with_owner')
-- no frontend. Apenas authenticated pode criar workspaces.
GRANT EXECUTE ON FUNCTION public.create_workspace_with_owner(TEXT, TEXT) TO authenticated;


-- ============================================================
-- 7. BILLING: PLANOS, ASSINATURAS, PAGAMENTOS
-- ============================================================

-- 7.1 Planos globais (sem workspace_id — catálogo público da plataforma)
CREATE TABLE IF NOT EXISTS public.plans (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    code             TEXT          NOT NULL UNIQUE,
    name             TEXT          NOT NULL,
    price            NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency         TEXT          NOT NULL DEFAULT 'BRL',
    billing_interval TEXT          NOT NULL DEFAULT 'monthly',
    limits           JSONB         NOT NULL DEFAULT '{}'::jsonb,
    is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 7.2 Assinaturas por workspace
--     workspace_id NOT NULL: sem assinaturas órfãs ou compartilhadas
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                       UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id             UUID                       NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    plan_id                  UUID                       NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
    status                   public.subscription_status NOT NULL DEFAULT 'trialing',
    current_period_start     TIMESTAMPTZ,
    current_period_end       TIMESTAMPTZ,
    trial_end                TIMESTAMPTZ,
    cancel_at                TIMESTAMPTZ,
    quantity                 INTEGER                    NOT NULL DEFAULT 1,
    provider                 TEXT,
    provider_subscription_id TEXT,
    metadata                 JSONB                      NOT NULL DEFAULT '{}'::jsonb,
    created_at               TIMESTAMPTZ                NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ                NOT NULL DEFAULT NOW()
);

-- 7.3 Pagamentos por workspace
--     workspace_id NOT NULL: dados financeiros sempre isolados por tenant
--     Escrita somente via service_role (n8n/Asaas webhook)
--     Leitura somente por admins do workspace
CREATE TABLE IF NOT EXISTS public.payments (
    id                  UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID                  NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    subscription_id     UUID                  REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    status              public.payment_status NOT NULL DEFAULT 'pending',
    amount              NUMERIC(12,2)         NOT NULL DEFAULT 0,
    currency            TEXT                  NOT NULL DEFAULT 'BRL',
    due_date            DATE,
    paid_at             TIMESTAMPTZ,
    provider            TEXT,
    provider_payment_id TEXT,
    payment_link        TEXT,
    boleto_url          TEXT,
    notes               TEXT,
    metadata            JSONB                 NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 8. INSTÂNCIAS WHATSAPP + HEALTH/WARMUP
-- ============================================================
CREATE TABLE IF NOT EXISTS public.instances (
    id            UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID                   NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name          TEXT                   NOT NULL,
    apikey        TEXT                   NOT NULL,
    provider      TEXT                   NOT NULL DEFAULT 'evolution',
    status        public.instance_status NOT NULL DEFAULT 'disconnected',
    last_check    TIMESTAMPTZ,
    last_error    TEXT,
    total_sent    INTEGER                NOT NULL DEFAULT 0,
    success_count INTEGER                NOT NULL DEFAULT 0,
    error_count   INTEGER                NOT NULL DEFAULT 0,
    metadata      JSONB                  NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.instance_sessions (
    id              UUID                           PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID                           NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    instance_id     UUID                           NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
    status          public.instance_session_status NOT NULL DEFAULT 'open',
    started_at      TIMESTAMPTZ                    NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    last_heartbeat  TIMESTAMPTZ,
    reconnect_count INTEGER                        NOT NULL DEFAULT 0,
    metadata        JSONB                          NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ                    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ                    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.instance_health_logs (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID          NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    instance_id  UUID          NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
    score        NUMERIC(5,2)  NOT NULL DEFAULT 0,
    stability    NUMERIC(5,2)  NOT NULL DEFAULT 0,
    quality      NUMERIC(5,2)  NOT NULL DEFAULT 0,
    event_type   TEXT          NOT NULL,
    details      JSONB         NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.instance_warmups (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID          NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    instance_id  UUID          NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
    status       TEXT          NOT NULL DEFAULT 'queued',
    progress     INTEGER       NOT NULL DEFAULT 0,
    score        NUMERIC(5,2)  NOT NULL DEFAULT 0,
    stability    NUMERIC(5,2)  NOT NULL DEFAULT 0,
    quality      NUMERIC(5,2)  NOT NULL DEFAULT 0,
    started_at   TIMESTAMPTZ,
    ended_at     TIMESTAMPTZ,
    metadata     JSONB         NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 9. CONTATOS + CRM
-- ============================================================
-- IMPORTANTE: contacts DEVE ser criada ANTES de campanhas.
--   campaign_contacts e campaign_dispatch_logs referenciam
--   contacts via FK. Ordem incorreta gera erro de relação.
CREATE TABLE IF NOT EXISTS public.contacts (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name         TEXT        NOT NULL DEFAULT '',
    phone        TEXT        NOT NULL,
    email        TEXT,
    source       TEXT,
    metadata     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, phone)
);

CREATE TABLE IF NOT EXISTS public.contact_tags (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    contact_id   UUID        NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    tag          TEXT        NOT NULL,
    created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, contact_id, tag)
);

CREATE TABLE IF NOT EXISTS public.contact_notes (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    contact_id   UUID        NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    note         TEXT        NOT NULL,
    created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 10. DEPARTAMENTOS + AGENTES
-- ============================================================
-- IMPORTANTE: agents DEVE ser criada ANTES de conversas.
--   conversations.assigned_agent_id e conversation_assignments.agent_id
--   referenciam agents. Ordem incorreta gera erro de relação.
CREATE TABLE IF NOT EXISTS public.departments (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name         TEXT        NOT NULL,
    description  TEXT,
    is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.agents (
    id            UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID                  NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id       UUID                  REFERENCES auth.users(id) ON DELETE SET NULL,
    display_name  TEXT,
    department_id UUID                  REFERENCES public.departments(id) ON DELETE SET NULL,
    role          public.workspace_role NOT NULL DEFAULT 'agent',
    is_active     BOOLEAN               NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.agent_status (
    id           UUID                         PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID                         NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id     UUID                         NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    status       public.agent_presence_status NOT NULL DEFAULT 'offline',
    last_seen_at TIMESTAMPTZ,
    metadata     JSONB                        NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
    UNIQUE (agent_id)
);


-- ============================================================
-- 11. CAMPANHAS + FILA DE DISPARO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
    id             UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   UUID                   NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name           TEXT                   NOT NULL,
    status         public.campaign_status NOT NULL DEFAULT 'draft',
    channel        TEXT                   NOT NULL DEFAULT 'whatsapp',
    priority       INTEGER                NOT NULL DEFAULT 3,
    scheduled_at   TIMESTAMPTZ,
    started_at     TIMESTAMPTZ,
    finished_at    TIMESTAMPTZ,
    created_by     UUID                   REFERENCES auth.users(id) ON DELETE SET NULL,
    total_contacts INTEGER                NOT NULL DEFAULT 0,
    sent_count     INTEGER                NOT NULL DEFAULT 0,
    success_count  INTEGER                NOT NULL DEFAULT 0,
    error_count    INTEGER                NOT NULL DEFAULT 0,
    last_error     TEXT,
    settings       JSONB                  NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.campaign_messages (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    campaign_id  UUID        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    sequence     INTEGER     NOT NULL DEFAULT 1,
    content      TEXT,
    media_url    TEXT,
    media_type   TEXT,
    is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
    metadata     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (campaign_id, sequence)
);

-- contacts já existe (seção 9) → FK válida
CREATE TABLE IF NOT EXISTS public.campaign_contacts (
    id              UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID                       NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    campaign_id     UUID                       NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    contact_id      UUID                       NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    status          public.dispatch_log_status NOT NULL DEFAULT 'pending',
    last_attempt_at TIMESTAMPTZ,
    attempt_count   INTEGER                    NOT NULL DEFAULT 0,
    error_msg       TEXT,
    created_at      TIMESTAMPTZ                NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ                NOT NULL DEFAULT NOW(),
    UNIQUE (campaign_id, contact_id)
);

CREATE TABLE IF NOT EXISTS public.campaign_dispatch_jobs (
    id            UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID                       NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    campaign_id   UUID                       NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    status        public.dispatch_job_status NOT NULL DEFAULT 'queued',
    queue         TEXT                       NOT NULL DEFAULT 'default',
    scheduled_at  TIMESTAMPTZ,
    run_at        TIMESTAMPTZ,
    started_at    TIMESTAMPTZ,
    finished_at   TIMESTAMPTZ,
    retry_count   INTEGER                    NOT NULL DEFAULT 0,
    max_retries   INTEGER                    NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    payload       JSONB                      NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ                NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ                NOT NULL DEFAULT NOW()
);

-- contacts, instances, campaign_messages já existem → FKs válidas
CREATE TABLE IF NOT EXISTS public.campaign_dispatch_logs (
    id                  UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID                       NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    campaign_id         UUID                       NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    contact_id          UUID                       REFERENCES public.contacts(id) ON DELETE SET NULL,
    instance_id         UUID                       REFERENCES public.instances(id) ON DELETE SET NULL,
    message_id          UUID                       REFERENCES public.campaign_messages(id) ON DELETE SET NULL,
    status              public.dispatch_log_status NOT NULL DEFAULT 'pending',
    error_msg           TEXT,
    sent_at             TIMESTAMPTZ,
    provider_message_id TEXT,
    message_snapshot    JSONB                      NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ                NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ                NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 12. INBOX + CONVERSAS + IA
-- ============================================================
-- agents já existe (seção 10) → FKs válidas
CREATE TABLE IF NOT EXISTS public.conversations (
    id                UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      UUID                       NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    contact_id        UUID                       REFERENCES public.contacts(id) ON DELETE SET NULL,
    instance_id       UUID                       REFERENCES public.instances(id) ON DELETE SET NULL,
    status            public.conversation_status NOT NULL DEFAULT 'open',
    priority          INTEGER                    NOT NULL DEFAULT 3,
    subject           TEXT,
    channel           TEXT                       NOT NULL DEFAULT 'whatsapp',
    external_id       TEXT,
    last_message_at   TIMESTAMPTZ,
    assigned_agent_id UUID                       REFERENCES public.agents(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ                NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ                NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id                  UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID                     NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    conversation_id     UUID                     NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    direction           public.message_direction NOT NULL DEFAULT 'inbound',
    sender_id           UUID,
    message             TEXT,
    media_url           TEXT,
    media_type          TEXT,
    status              public.message_status    NOT NULL DEFAULT 'queued',
    sent_at             TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    read_at             TIMESTAMPTZ,
    provider_message_id TEXT,
    metadata            JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ              NOT NULL DEFAULT NOW()
);

-- agents já existe → FK válida
CREATE TABLE IF NOT EXISTS public.conversation_assignments (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    conversation_id UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    agent_id        UUID        NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    assigned_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unassigned_at   TIMESTAMPTZ,
    status          TEXT        NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversation_labels (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    conversation_id UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    label           TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, conversation_id, label)
);

CREATE TABLE IF NOT EXISTS public.conversation_ai_analysis (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID         NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    conversation_id UUID         NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    classification  TEXT,
    priority        INTEGER,
    summary         TEXT,
    intent          TEXT,
    lead_score      NUMERIC(5,2) NOT NULL DEFAULT 0,
    sentiment       TEXT,
    tags            JSONB        NOT NULL DEFAULT '[]'::jsonb,
    model           TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 13. NOTIFICAÇÕES + AUDIT + WEBHOOKS + CONFIGURAÇÕES
-- ============================================================

-- 13.1 Notificações por usuário
--   workspace_id NOT NULL: sem notificações órfãs.
--   POLÍTICA DEDICADA (não entra no loop genérico):
--     somente o destinatário (user_id = auth.uid()) acessa.
--   Isso impede que membros do mesmo workspace vejam
--   notificações uns dos outros.
CREATE TABLE IF NOT EXISTS public.notifications (
    id           UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID                       NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id      UUID                       NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type         TEXT                       NOT NULL,
    title        TEXT,
    message      TEXT,
    status       public.notification_status NOT NULL DEFAULT 'unread',
    read_at      TIMESTAMPTZ,
    metadata     JSONB                      NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ                NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ                NOT NULL DEFAULT NOW()
);

-- 13.2 Audit logs
--   workspace_id NOT NULL: logs sempre vinculados a um tenant.
--   POLÍTICA DEDICADA: somente admins leem; escrita só service_role.
--   NÃO entra no loop genérico (evitar que operadores leiam logs).
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id            UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID                  NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    actor_user_id UUID                  REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_role    public.workspace_role,
    action        TEXT                  NOT NULL,
    entity_type   TEXT                  NOT NULL,
    entity_id     UUID,
    ip            INET,
    user_agent    TEXT,
    metadata      JSONB                 NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

-- 13.3 Eventos de webhook
--   workspace_id NULLABLE: webhooks podem chegar sem workspace
--   identificado (ex: novo cliente Asaas antes do matching).
--   Após processamento pelo n8n, workspace_id deve ser preenchido.
--   POLÍTICA DEDICADA: service_role insere/atualiza; admins leem.
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id           UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID                        REFERENCES public.workspaces(id) ON DELETE CASCADE,
    provider     TEXT                        NOT NULL,
    event_type   TEXT                        NOT NULL,
    status       public.webhook_event_status NOT NULL DEFAULT 'received',
    payload      JSONB                       NOT NULL DEFAULT '{}'::jsonb,
    received_at  TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_msg    TEXT,
    created_at   TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);

-- 13.4 Configurações por workspace
--   workspace_id NOT NULL: sem configurações globais expostas.
--   Configs da plataforma ficam em variáveis de ambiente / service_role.
--   POLÍTICA DEDICADA: somente admins do workspace.
CREATE TABLE IF NOT EXISTS public.system_settings (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    key          TEXT        NOT NULL,
    value        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, key)
);


-- ============================================================
-- 14. TRIGGERS set_updated_at (todas as tabelas)
-- ============================================================
DO $$
DECLARE tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'users_profiles','workspaces','workspace_members',
        'plans','subscriptions','payments',
        'instances','instance_sessions','instance_health_logs','instance_warmups',
        'contacts','contact_tags','contact_notes',
        'departments','agents','agent_status',
        'campaigns','campaign_messages','campaign_contacts',
        'campaign_dispatch_jobs','campaign_dispatch_logs',
        'conversations','conversation_messages','conversation_assignments',
        'conversation_labels','conversation_ai_analysis',
        'notifications','audit_logs','webhook_events','system_settings'
    ]
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS set_updated_at_%s ON public.%I;
             CREATE TRIGGER set_updated_at_%s
             BEFORE UPDATE ON public.%I
             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
            tbl, tbl, tbl, tbl
        );
    END LOOP;
END $$;


-- ============================================================
-- 15. AUTH HOOK — PERFIL AUTOMÁTICO (V2)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_v2()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users_profiles (id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        NEW.email
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created_v2 ON auth.users;
CREATE TRIGGER on_auth_user_created_v2
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_v2();


-- ============================================================
-- 16. ÍNDICES (COBERTURA COMPLETA)
-- ============================================================

-- Core / membros
CREATE INDEX IF NOT EXISTS idx_workspaces_owner          ON public.workspaces(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug            ON public.workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_wm_user                   ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_wm_workspace_role_status  ON public.workspace_members(workspace_id, role, status);

-- Billing
CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace   ON public.subscriptions(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end  ON public.subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_payments_workspace_status ON public.payments(workspace_id, status, due_date);

-- Instâncias
CREATE INDEX IF NOT EXISTS idx_instances_workspace       ON public.instances(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_inst_sessions_instance    ON public.instance_sessions(instance_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_inst_sessions_workspace   ON public.instance_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_inst_health_instance      ON public.instance_health_logs(instance_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inst_health_workspace     ON public.instance_health_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_inst_warmups_instance     ON public.instance_warmups(instance_id, status);
CREATE INDEX IF NOT EXISTS idx_inst_warmups_workspace    ON public.instance_warmups(workspace_id);

-- Contatos
CREATE INDEX IF NOT EXISTS idx_contacts_workspace_phone  ON public.contacts(workspace_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_workspace_name   ON public.contacts(workspace_id, name);
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact      ON public.contact_tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_workspace    ON public.contact_tags(workspace_id, tag);
CREATE INDEX IF NOT EXISTS idx_contact_notes_contact     ON public.contact_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_workspace   ON public.contact_notes(workspace_id);

-- Agentes
CREATE INDEX IF NOT EXISTS idx_agents_workspace          ON public.agents(workspace_id, role);
CREATE INDEX IF NOT EXISTS idx_agents_user               ON public.agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_status_agent        ON public.agent_status(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_status_workspace    ON public.agent_status(workspace_id, status);

-- Campanhas (alto crescimento)
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace       ON public.campaigns(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cmp_msgs_campaign         ON public.campaign_messages(campaign_id, sequence);
CREATE INDEX IF NOT EXISTS idx_cmp_msgs_workspace        ON public.campaign_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cmp_contacts_campaign     ON public.campaign_contacts(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_cmp_contacts_workspace    ON public.campaign_contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_jobs_status_run  ON public.campaign_dispatch_jobs(status, run_at);
CREATE INDEX IF NOT EXISTS idx_dispatch_jobs_workspace   ON public.campaign_dispatch_jobs(workspace_id, status);
-- Índice crítico para fila de disparo: busca por workspace + status + created_at
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_campaign    ON public.campaign_dispatch_logs(campaign_id, status, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_workspace   ON public.campaign_dispatch_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_contact     ON public.campaign_dispatch_logs(contact_id, status);

-- Conversas (alto crescimento — índices críticos para inbox)
CREATE INDEX IF NOT EXISTS idx_conversations_workspace   ON public.conversations(workspace_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_contact     ON public.conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent       ON public.conversations(assigned_agent_id, status);
-- Mensagens: índice primário para paginação do chat
CREATE INDEX IF NOT EXISTS idx_conv_msgs_conversation    ON public.conversation_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_msgs_workspace       ON public.conversation_messages(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_assign_conversation  ON public.conversation_assignments(conversation_id, status);
CREATE INDEX IF NOT EXISTS idx_conv_assign_workspace     ON public.conversation_assignments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conv_labels_conversation  ON public.conversation_labels(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_labels_workspace     ON public.conversation_labels(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conv_ai_conversation      ON public.conversation_ai_analysis(conversation_id);

-- Notificações
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON public.notifications(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace   ON public.notifications(workspace_id, created_at DESC);

-- Audit (alto crescimento — sem REPLICA IDENTITY, usar polling)
CREATE INDEX IF NOT EXISTS idx_audit_workspace_time      ON public.audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor               ON public.audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity              ON public.audit_logs(entity_type, entity_id);

-- Webhooks (alto crescimento — sem REPLICA IDENTITY, usar polling)
CREATE INDEX IF NOT EXISTS idx_webhook_workspace_status  ON public.webhook_events(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_webhook_provider_type     ON public.webhook_events(provider, event_type, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_received          ON public.webhook_events(received_at DESC);

-- System settings
CREATE INDEX IF NOT EXISTS idx_settings_workspace_key    ON public.system_settings(workspace_id, key);


-- ============================================================
-- 17. RLS — HABILITAR EM TODAS AS TABELAS
-- ============================================================
ALTER TABLE public.users_profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instances                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instance_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instance_health_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instance_warmups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tags             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_notes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_status             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_contacts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_dispatch_jobs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_dispatch_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_labels      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings          ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 18. RLS — POLÍTICAS
-- ============================================================

-- ── users_profiles: somente o próprio usuário ──
DROP POLICY IF EXISTS "users_profiles_self" ON public.users_profiles;
CREATE POLICY "users_profiles_self" ON public.users_profiles
    FOR ALL
    USING  (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ── workspaces ──
DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete" ON public.workspaces;

-- Leitura: qualquer membro ativo do workspace
CREATE POLICY "workspaces_select" ON public.workspaces
    FOR SELECT USING (public.has_workspace_access(id));

-- INSERT: use preferencialmente create_workspace_with_owner()
-- Esta policy existe como fallback; o front pode usar a RPC.
CREATE POLICY "workspaces_insert" ON public.workspaces
    FOR INSERT WITH CHECK (owner_user_id = auth.uid());

-- Atualização e remoção: somente owner
CREATE POLICY "workspaces_update" ON public.workspaces
    FOR UPDATE
    USING  (public.is_workspace_owner(id))
    WITH CHECK (public.is_workspace_owner(id));

CREATE POLICY "workspaces_delete" ON public.workspaces
    FOR DELETE USING (public.is_workspace_owner(id));

-- ── workspace_members ──
-- ANTI-RECURSÃO: todas as funções são SECURITY DEFINER → sem loop
-- SELECT: membros ativos veem todos os colegas do workspace
-- INSERT/UPDATE/DELETE: somente admins/owners gerenciam membros
DROP POLICY IF EXISTS "wm_select"  ON public.workspace_members;
DROP POLICY IF EXISTS "wm_insert"  ON public.workspace_members;
DROP POLICY IF EXISTS "wm_update"  ON public.workspace_members;
DROP POLICY IF EXISTS "wm_delete"  ON public.workspace_members;

CREATE POLICY "wm_select" ON public.workspace_members
    FOR SELECT USING (public.has_workspace_access(workspace_id));

CREATE POLICY "wm_insert" ON public.workspace_members
    FOR INSERT WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "wm_update" ON public.workspace_members
    FOR UPDATE
    USING  (public.is_workspace_admin(workspace_id))
    WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "wm_delete" ON public.workspace_members
    FOR DELETE USING (public.is_workspace_admin(workspace_id));

-- ── plans: leitura pública, escrita somente service_role ──
DROP POLICY IF EXISTS "plans_select" ON public.plans;
DROP POLICY IF EXISTS "plans_manage" ON public.plans;

CREATE POLICY "plans_select" ON public.plans
    FOR SELECT USING (TRUE);

CREATE POLICY "plans_manage" ON public.plans
    FOR ALL
    USING  (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ── subscriptions: leitura por membros, escrita admin ou service_role ──
DROP POLICY IF EXISTS "subscriptions_select" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_manage" ON public.subscriptions;

CREATE POLICY "subscriptions_select" ON public.subscriptions
    FOR SELECT USING (public.has_workspace_access(workspace_id));

CREATE POLICY "subscriptions_manage" ON public.subscriptions
    FOR ALL
    USING  (auth.role() = 'service_role' OR public.is_workspace_admin(workspace_id))
    WITH CHECK (auth.role() = 'service_role' OR public.is_workspace_admin(workspace_id));

-- ── payments: leitura somente admins, escrita somente service_role ──
-- Dados financeiros sensíveis: operadores e agentes NÃO acessam
DROP POLICY IF EXISTS "payments_select" ON public.payments;
DROP POLICY IF EXISTS "payments_manage" ON public.payments;

CREATE POLICY "payments_select" ON public.payments
    FOR SELECT USING (public.is_workspace_admin(workspace_id));

CREATE POLICY "payments_manage" ON public.payments
    FOR ALL
    USING  (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ── tabelas de workspace: acesso genérico por membros ativos ──
-- Inclui instâncias, contatos, agentes, campanhas, conversas.
-- NÃO inclui: notifications, audit_logs, webhook_events, system_settings
-- (essas têm políticas específicas abaixo).
DO $$
DECLARE tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'instances','instance_sessions','instance_health_logs','instance_warmups',
        'contacts','contact_tags','contact_notes',
        'departments','agents','agent_status',
        'campaigns','campaign_messages','campaign_contacts',
        'campaign_dispatch_jobs','campaign_dispatch_logs',
        'conversations','conversation_messages','conversation_assignments',
        'conversation_labels','conversation_ai_analysis'
    ]
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "ws_access_%s" ON public.%I;', tbl, tbl);
        EXECUTE format(
            'CREATE POLICY "ws_access_%s" ON public.%I
             FOR ALL
             USING  (public.has_workspace_access(workspace_id))
             WITH CHECK (public.has_workspace_access(workspace_id));',
            tbl, tbl
        );
    END LOOP;
END $$;

-- ── notifications: somente o destinatário (user_id = auth.uid()) ──
-- ISOLAMENTO CRÍTICO: membros do mesmo workspace NÃO veem
-- notificações uns dos outros, mesmo com has_workspace_access.
-- Políticas separadas por operação para máximo controle.
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

-- service_role cria notificações para qualquer destinatário válido
CREATE POLICY "notifications_insert" ON public.notifications
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role'
        OR (user_id = auth.uid() AND public.has_workspace_access(workspace_id))
    );

-- Somente o destinatário marca como lida ou atualiza
CREATE POLICY "notifications_update" ON public.notifications
    FOR UPDATE
    USING  (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_delete" ON public.notifications
    FOR DELETE USING (user_id = auth.uid());

-- ── audit_logs: leitura somente admins, escrita somente service_role ──
DROP POLICY IF EXISTS "audit_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_insert" ON public.audit_logs;

CREATE POLICY "audit_select" ON public.audit_logs
    FOR SELECT USING (public.is_workspace_admin(workspace_id));

CREATE POLICY "audit_insert" ON public.audit_logs
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ── webhook_events: service_role escreve, admins leem ──
DROP POLICY IF EXISTS "webhook_select"  ON public.webhook_events;
DROP POLICY IF EXISTS "webhook_insert"  ON public.webhook_events;
DROP POLICY IF EXISTS "webhook_update"  ON public.webhook_events;

-- workspace_id pode ser NULL (pré-matching); nesse caso só service_role acessa
CREATE POLICY "webhook_select" ON public.webhook_events
    FOR SELECT USING (
        auth.role() = 'service_role'
        OR (workspace_id IS NOT NULL AND public.is_workspace_admin(workspace_id))
    );

CREATE POLICY "webhook_insert" ON public.webhook_events
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "webhook_update" ON public.webhook_events
    FOR UPDATE
    USING  (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ── system_settings: somente admins do workspace ──
DROP POLICY IF EXISTS "settings_access" ON public.system_settings;

CREATE POLICY "settings_access" ON public.system_settings
    FOR ALL
    USING  (public.is_workspace_admin(workspace_id))
    WITH CHECK (public.is_workspace_admin(workspace_id));


-- ============================================================
-- 19. REALTIME — REPLICA IDENTITY FULL
-- ============================================================
-- REPLICA IDENTITY FULL: envia o registro completo (antes + depois)
-- para o canal realtime do Supabase em UPDATEs e DELETEs.
--
-- Custo: maior volume no WAL. Usar SOMENTE onde o frontend
-- precisa de streaming ao vivo de atualizações.
--
-- NÃO usar em: audit_logs, campaign_dispatch_logs, webhook_events
-- (alto volume → usar polling ou Supabase Edge Functions).
--
-- Tabelas habilitadas para realtime:
--   conversations        → status de atendimento ao vivo
--   conversation_messages → chat em tempo real
--   notifications        → alertas push instantâneos
--   agent_status         → presença online dos agentes

ALTER TABLE public.conversations         REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications         REPLICA IDENTITY FULL;
ALTER TABLE public.agent_status          REPLICA IDENTITY FULL;

-- Para ativar no painel do Supabase (Database → Replication),
-- ou executar separadamente após o schema:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_status;


-- ============================================================
-- 20. TABELAS LEGADAS (PRESERVADAS PARA MIGRAÇÃO GRADUAL)
-- ============================================================
-- NÃO DROPAR até a migração dos dados estar completa e validada.
--
-- PLANO DE MIGRAÇÃO (executar em produção, nessa ordem):
--   1. Para cada user_id único nas tabelas legadas:
--        SELECT public.create_workspace_with_owner('Nome Empresa','slug');
--   2. Copiar profiles           → users_profiles
--   3. Copiar instances_legacy   → instances     (adicionar workspace_id)
--   4. Copiar contacts_legacy    → contacts      (adicionar workspace_id)
--   5. Copiar campaigns_legacy   → campaigns     (adicionar workspace_id)
--   6. Copiar campaign_results_legacy → campaign_dispatch_logs
--   7. Copiar payments_legacy    → payments      (adicionar workspace_id)
--   8. Validar integridade referencial
--   9. Bloquear acesso às tabelas legadas (DROP POLICY + ENABLE RLS)
--  10. Dropar tabelas legadas após 30 dias de operação estável

CREATE TABLE IF NOT EXISTS public.profiles (
    id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name  TEXT,
    plan       TEXT        NOT NULL DEFAULT 'free',
    is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.instances_legacy (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    apikey        TEXT        NOT NULL,
    status        TEXT        NOT NULL DEFAULT 'disconnected',
    total_sent    INTEGER     NOT NULL DEFAULT 0,
    success_count INTEGER     NOT NULL DEFAULT 0,
    error_count   INTEGER     NOT NULL DEFAULT 0,
    last_check    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS public.contacts_legacy (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name       TEXT        NOT NULL DEFAULT '',
    phone      TEXT        NOT NULL,
    email      TEXT,
    tags       TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, phone)
);

CREATE TABLE IF NOT EXISTS public.campaigns_legacy (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    instance_id     UUID        REFERENCES public.instances_legacy(id) ON DELETE SET NULL,
    instance_name   TEXT,
    name            TEXT,
    total_contacts  INTEGER     NOT NULL DEFAULT 0,
    sent_count      INTEGER     NOT NULL DEFAULT 0,
    success_count   INTEGER     NOT NULL DEFAULT 0,
    error_count     INTEGER     NOT NULL DEFAULT 0,
    status          TEXT        NOT NULL DEFAULT 'completed',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    message_preview TEXT,
    has_media       BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.campaign_results_legacy (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id  UUID        NOT NULL REFERENCES public.campaigns_legacy(id) ON DELETE CASCADE,
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_name TEXT,
    phone        TEXT        NOT NULL,
    status       TEXT        NOT NULL DEFAULT 'pending',
    error_msg    TEXT,
    sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments_legacy (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan              TEXT          NOT NULL DEFAULT 'free',
    status            TEXT          NOT NULL DEFAULT 'pending',
    amount            NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency          TEXT          NOT NULL DEFAULT 'BRL',
    due_date          DATE,
    paid_at           TIMESTAMPTZ,
    notes             TEXT,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    asaas_payment_id  TEXT,
    asaas_customer_id TEXT,
    payment_link      TEXT,
    boleto_url        TEXT,
    instance_count    INTEGER       NOT NULL DEFAULT 1
);


-- ============================================================
-- FIM DO SCHEMA — DISPARO PRO v2.0 (PRODUÇÃO)
-- ============================================================
