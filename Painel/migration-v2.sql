-- ============================================================
-- MIGRATION v2.0 — DISPARO PRO
-- De: schema single-tenant (tabelas _legacy)
-- Para: schema SaaS multi-tenant (supabase-schema.sql v2.0)
--
-- Execute no Supabase SQL Editor como service_role.
-- Leia migration-plan-v2.md antes de executar.
-- Faça backup ANTES de executar este script.
--
-- Gerado em: 2026-05-08
-- ============================================================
--
-- PROPRIEDADES GERAIS:
--   • Idempotente: pode ser re-executado sem duplicar dados.
--   • Não destrutivo: nenhuma tabela legada é apagada.
--   • Rastreável: cada registro migrado recebe metadata com origem.
--   • Seguro: ON CONFLICT DO NOTHING / DO UPDATE em todos os INSERTs.
--
-- PRÉ-CONDIÇÕES (verificar antes de executar):
--   1. supabase-schema.sql v2.0 executado sem erros
--   2. Tabelas _legacy existem com dados
--   3. Backup do banco realizado
-- ============================================================


-- ============================================================
-- PASSO 0: CONTAGENS PRÉ-MIGRAÇÃO
-- ============================================================
DO $$
DECLARE
    cnt_profiles  BIGINT;
    cnt_inst      BIGINT;
    cnt_cont      BIGINT;
    cnt_camp      BIGINT;
    cnt_results   BIGINT;
    cnt_payments  BIGINT;
    cnt_users_wsp BIGINT;
    missing_tbls  TEXT := '';
BEGIN
    -- ── Verificar existência de todas as tabelas necessárias ──
    -- Falha rápida com mensagem clara antes de tentar qualquer SELECT.
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        missing_tbls := missing_tbls || ' profiles';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'instances_legacy') THEN
        missing_tbls := missing_tbls || ' instances_legacy';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'contacts_legacy') THEN
        missing_tbls := missing_tbls || ' contacts_legacy';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'campaigns_legacy') THEN
        missing_tbls := missing_tbls || ' campaigns_legacy';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'campaign_results_legacy') THEN
        missing_tbls := missing_tbls || ' campaign_results_legacy';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'payments_legacy') THEN
        missing_tbls := missing_tbls || ' payments_legacy';
    END IF;
    -- Tabelas de destino (schema v2.0 deve estar aplicado)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'workspaces') THEN
        missing_tbls := missing_tbls || ' workspaces';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'workspace_members') THEN
        missing_tbls := missing_tbls || ' workspace_members';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'instances') THEN
        missing_tbls := missing_tbls || ' instances';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'contacts') THEN
        missing_tbls := missing_tbls || ' contacts';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'campaigns') THEN
        missing_tbls := missing_tbls || ' campaigns';
    END IF;

    IF missing_tbls <> '' THEN
        RAISE EXCEPTION
            E'PRÉ-CONDIÇÃO FALHOU — tabelas ausentes: %\n'
            'Verifique: (1) supabase-schema.sql v2.0 executado; '
            '(2) banco legado com tabelas _legacy existentes.',
            missing_tbls;
    END IF;

    -- ── Contagens das origens ──
    SELECT COUNT(*) INTO cnt_profiles FROM public.profiles;
    SELECT COUNT(*) INTO cnt_inst     FROM public.instances_legacy;
    SELECT COUNT(*) INTO cnt_cont     FROM public.contacts_legacy;
    SELECT COUNT(*) INTO cnt_camp     FROM public.campaigns_legacy;
    SELECT COUNT(*) INTO cnt_results  FROM public.campaign_results_legacy;
    SELECT COUNT(*) INTO cnt_payments FROM public.payments_legacy;

    SELECT COUNT(DISTINCT user_id) INTO cnt_users_wsp
    FROM (
        SELECT user_id FROM public.instances_legacy
        UNION SELECT user_id FROM public.contacts_legacy
        UNION SELECT user_id FROM public.campaigns_legacy
        UNION SELECT user_id FROM public.payments_legacy
    ) AS all_users;

    RAISE NOTICE '════════════════════════════════════════════';
    RAISE NOTICE 'PRÉ-MIGRAÇÃO — CONTAGENS:';
    RAISE NOTICE '  profiles legados:            %', cnt_profiles;
    RAISE NOTICE '  instances_legacy:            %', cnt_inst;
    RAISE NOTICE '  contacts_legacy:             %', cnt_cont;
    RAISE NOTICE '  campaigns_legacy:            %', cnt_camp;
    RAISE NOTICE '  campaign_results_legacy:     %', cnt_results;
    RAISE NOTICE '  payments_legacy:             %', cnt_payments;
    RAISE NOTICE '  usuários únicos (workspaces necessários): %', cnt_users_wsp;
    RAISE NOTICE 'Pré-condições OK. Prosseguindo com a migração...';
    RAISE NOTICE '════════════════════════════════════════════';
END $$;


-- ============================================================
-- PASSO 1: TABELAS DE MAPEAMENTO TEMPORÁRIAS
-- ============================================================
-- Persistem durante toda a sessão. Destruídas ao fechar o Editor.
-- DROP IF EXISTS garante re-execução limpa.

DROP TABLE IF EXISTS _migration_user_workspace;
DROP TABLE IF EXISTS _migration_instance_id_map;
DROP TABLE IF EXISTS _migration_campaign_id_map;

CREATE TEMP TABLE _migration_user_workspace (
    user_id      UUID NOT NULL,
    workspace_id UUID NOT NULL,
    PRIMARY KEY (user_id)
);

CREATE TEMP TABLE _migration_instance_id_map (
    old_id       UUID NOT NULL,
    new_id       UUID NOT NULL,
    workspace_id UUID NOT NULL,
    PRIMARY KEY (old_id)
);

CREATE TEMP TABLE _migration_campaign_id_map (
    old_id       UUID NOT NULL,
    new_id       UUID NOT NULL,
    workspace_id UUID NOT NULL,
    PRIMARY KEY (old_id)
);


-- ============================================================
-- INÍCIO DA TRANSAÇÃO (passos 2-9 são atômicos)
-- ============================================================
-- Se qualquer erro ocorrer em qualquer passo, o PostgreSQL reverte
-- TUDO automaticamente. Nenhum dado parcial fica persistido.
-- O COMMIT ao final do Passo 9 confirma a migração de uma vez.
BEGIN;

-- ============================================================
-- PASSO 2: CRIAR WORKSPACE POR USUÁRIO LEGADO
-- ============================================================
-- Regras:
--   • 1 workspace por usuário legado.
--   • Se o usuário já tem um workspace (owner_user_id = user_id),
--     reutiliza — sem duplicar.
--   • Nome: full_name do perfil → email (parte antes do @) → fallback UUID.
--   • Slug: versão kebab-case do nome + 8 chars do UUID (garante unicidade).
--   • Insere o usuário como 'owner' em workspace_members.
--   • Define como workspace padrão no users_profiles (se vazio).

DO $$
DECLARE
    r             RECORD;
    v_workspace_id UUID;
    v_raw_name    TEXT;
    v_name        TEXT;
    v_slug        TEXT;
    v_cnt_new     INTEGER := 0;
    v_cnt_exist   INTEGER := 0;
BEGIN
    FOR r IN
        SELECT DISTINCT
            u.id                          AS user_id,
            COALESCE(
                NULLIF(TRIM(p.full_name), ''),
                split_part(u.email, '@', 1),
                'Workspace ' || LEFT(u.id::TEXT, 8)
            )                             AS display_name,
            u.email
        FROM auth.users u
        LEFT JOIN public.profiles p ON p.id = u.id
        WHERE u.id IN (
            SELECT user_id FROM public.instances_legacy
            UNION SELECT user_id FROM public.contacts_legacy
            UNION SELECT user_id FROM public.campaigns_legacy
            UNION SELECT user_id FROM public.payments_legacy
        )
    LOOP
        -- Verificar se já existe workspace para este usuário (idempotência)
        SELECT id INTO v_workspace_id
        FROM public.workspaces
        WHERE owner_user_id = r.user_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_workspace_id IS NULL THEN
            -- Criar novo workspace
            v_raw_name := r.display_name;
            v_name     := v_raw_name;
            v_slug     := regexp_replace(
                              lower(v_raw_name),
                              '[^a-z0-9]+', '-', 'g'
                          ) || '-' || LEFT(r.user_id::TEXT, 8);

            -- Remover hífens iniciais/finais do slug
            v_slug := trim(both '-' from v_slug);

            INSERT INTO public.workspaces (name, slug, owner_user_id, status)
            VALUES (v_name, v_slug, r.user_id, 'active')
            RETURNING id INTO v_workspace_id;

            -- Inserir como owner (bypass RLS: estamos no service_role)
            INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
            VALUES (v_workspace_id, r.user_id, 'owner', 'active')
            ON CONFLICT (workspace_id, user_id) DO NOTHING;

            v_cnt_new := v_cnt_new + 1;
        ELSE
            -- Garantir que é owner
            INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
            VALUES (v_workspace_id, r.user_id, 'owner', 'active')
            ON CONFLICT (workspace_id, user_id) DO NOTHING;

            v_cnt_exist := v_cnt_exist + 1;
        END IF;

        -- Registrar mapeamento
        INSERT INTO _migration_user_workspace (user_id, workspace_id)
        VALUES (r.user_id, v_workspace_id)
        ON CONFLICT (user_id) DO NOTHING;
    END LOOP;

    RAISE NOTICE 'PASSO 2: % workspaces criados, % já existiam.', v_cnt_new, v_cnt_exist;
END $$;


-- ============================================================
-- PASSO 3: MIGRAR profiles → users_profiles
-- ============================================================
-- ON CONFLICT DO UPDATE: atualiza somente campos que estão nulos
-- no destino — não sobrescreve dados já existentes no v2.

INSERT INTO public.users_profiles (
    id,
    full_name,
    email,
    is_active,
    default_workspace_id,
    created_at,
    updated_at
)
SELECT
    p.id,
    COALESCE(NULLIF(TRIM(p.full_name), ''), u.email, ''),
    u.email,
    COALESCE(p.is_active, TRUE),
    m.workspace_id,
    COALESCE(p.created_at, NOW()),
    COALESCE(p.updated_at, NOW())
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
LEFT JOIN _migration_user_workspace m ON m.user_id = p.id
ON CONFLICT (id) DO UPDATE
    SET full_name            = CASE
                                   WHEN TRIM(EXCLUDED.full_name) <> '' AND TRIM(users_profiles.full_name) = ''
                                   THEN EXCLUDED.full_name
                                   ELSE users_profiles.full_name
                               END,
        email                = COALESCE(users_profiles.email, EXCLUDED.email),
        is_active            = COALESCE(users_profiles.is_active, EXCLUDED.is_active),
        default_workspace_id = COALESCE(users_profiles.default_workspace_id, EXCLUDED.default_workspace_id),
        updated_at           = NOW();

DO $$
BEGIN
    RAISE NOTICE 'PASSO 3: profiles → users_profiles concluído. Total: %',
        (SELECT COUNT(*) FROM public.users_profiles);
END $$;


-- ============================================================
-- PASSO 4: MIGRAR instances_legacy → instances
-- ============================================================
-- Usa uma CTE + INSERT para capturar os IDs novos no mapeamento.

DO $$
DECLARE
    v_cnt BIGINT;
BEGIN
    WITH inserted AS (
        INSERT INTO public.instances (
            id,
            workspace_id,
            name,
            apikey,
            provider,
            status,
            last_check,
            total_sent,
            success_count,
            error_count,
            metadata,
            created_at,
            updated_at
        )
        SELECT
            gen_random_uuid()   AS id,
            m.workspace_id,
            il.name,
            il.apikey,
            'evolution'         AS provider,
            CASE
                WHEN il.status IN ('connected','disconnected','connecting','error','unknown')
                THEN il.status::public.instance_status
                ELSE 'unknown'::public.instance_status
            END                 AS status,
            il.last_check,
            COALESCE(il.total_sent, 0),
            COALESCE(il.success_count, 0),
            COALESCE(il.error_count, 0),
            jsonb_build_object(
                'migrated_from', 'instances_legacy',
                'legacy_id',     il.id::TEXT
            )                   AS metadata,
            COALESCE(il.created_at, NOW()),
            COALESCE(il.updated_at, NOW())
        FROM public.instances_legacy il
        JOIN _migration_user_workspace m ON m.user_id = il.user_id
        -- Evitar duplicatas: somente inserir se não existir instance com mesmo nome no workspace
        WHERE NOT EXISTS (
            SELECT 1 FROM public.instances ni
            WHERE ni.workspace_id = m.workspace_id
              AND ni.name = il.name
        )
        RETURNING id, (metadata->>'legacy_id')::UUID AS old_id, workspace_id
    )
    INSERT INTO _migration_instance_id_map (old_id, new_id, workspace_id)
    SELECT i.old_id, i.id, i.workspace_id
    FROM inserted i
    WHERE i.old_id IS NOT NULL
    ON CONFLICT (old_id) DO NOTHING;

    -- Também mapear instâncias já existentes (para re-execuções)
    INSERT INTO _migration_instance_id_map (old_id, new_id, workspace_id)
    SELECT
        (ni.metadata->>'legacy_id')::UUID AS old_id,
        ni.id,
        ni.workspace_id
    FROM public.instances ni
    WHERE ni.metadata->>'migrated_from' = 'instances_legacy'
      AND ni.metadata->>'legacy_id' IS NOT NULL
    ON CONFLICT (old_id) DO NOTHING;

    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    RAISE NOTICE 'PASSO 4: instances_legacy → instances concluído. Total v2: %',
        (SELECT COUNT(*) FROM public.instances);
END $$;


-- ============================================================
-- PASSO 5a: MIGRAR contacts_legacy → contacts
-- ============================================================

INSERT INTO public.contacts (
    workspace_id,
    name,
    phone,
    email,
    source,
    created_by,
    metadata,
    created_at,
    updated_at
)
SELECT
    m.workspace_id,
    COALESCE(NULLIF(TRIM(cl.name), ''), cl.phone),
    cl.phone,
    cl.email,
    'import'                AS source,
    cl.user_id              AS created_by,
    jsonb_build_object(
        'migrated_from', 'contacts_legacy',
        'legacy_id',     cl.id::TEXT
    )                       AS metadata,
    COALESCE(cl.created_at, NOW()),
    NOW()
FROM public.contacts_legacy cl
JOIN _migration_user_workspace m ON m.user_id = cl.user_id
ON CONFLICT (workspace_id, phone) DO NOTHING;

DO $$
BEGIN
    RAISE NOTICE 'PASSO 5a: contacts_legacy → contacts concluído. Total v2: %',
        (SELECT COUNT(*) FROM public.contacts);
END $$;


-- ============================================================
-- PASSO 5b: MIGRAR tags → contact_tags
-- ============================================================
-- unnest(tags) expande o array TEXT[] em linhas individuais.

INSERT INTO public.contact_tags (
    workspace_id,
    contact_id,
    tag,
    created_by,
    created_at,
    updated_at
)
SELECT
    c.workspace_id,
    c.id             AS contact_id,
    TRIM(t.tag)      AS tag,
    cl.user_id       AS created_by,
    COALESCE(cl.created_at, NOW()),
    NOW()
FROM public.contacts_legacy cl
JOIN _migration_user_workspace m ON m.user_id = cl.user_id
JOIN public.contacts c
    ON c.workspace_id = m.workspace_id
    AND c.phone       = cl.phone
CROSS JOIN LATERAL UNNEST(cl.tags) AS t(tag)
WHERE cl.tags IS NOT NULL
  AND array_length(cl.tags, 1) > 0
  AND TRIM(t.tag) <> ''
ON CONFLICT (workspace_id, contact_id, tag) DO NOTHING;

DO $$
BEGIN
    RAISE NOTICE 'PASSO 5b: tags → contact_tags concluído. Total v2: %',
        (SELECT COUNT(*) FROM public.contact_tags);
END $$;


-- ============================================================
-- PASSO 6: MIGRAR campaigns_legacy → campaigns
-- ============================================================

DO $$
DECLARE
    v_cnt BIGINT;
BEGIN
    WITH inserted AS (
        INSERT INTO public.campaigns (
            id,
            workspace_id,
            name,
            status,
            channel,
            priority,
            started_at,
            finished_at,
            total_contacts,
            sent_count,
            success_count,
            error_count,
            created_by,
            settings,
            created_at,
            updated_at
        )
        SELECT
            gen_random_uuid()       AS id,
            m.workspace_id,
            COALESCE(NULLIF(TRIM(camp.name), ''), 'Campanha ' || camp.id::TEXT),
            CASE
                WHEN camp.status IN (
                    'draft','scheduled','running','paused',
                    'completed','failed','canceled'
                )
                THEN camp.status::public.campaign_status
                ELSE 'completed'::public.campaign_status
            END                     AS status,
            'whatsapp'              AS channel,
            3                       AS priority,
            camp.started_at,
            camp.finished_at,
            COALESCE(camp.total_contacts, 0),
            COALESCE(camp.sent_count, 0),
            COALESCE(camp.success_count, 0),
            COALESCE(camp.error_count, 0),
            camp.user_id            AS created_by,
            jsonb_build_object(
                'message_preview', camp.message_preview,
                'has_media',       camp.has_media,
                'instance_name',   camp.instance_name,
                'migrated_from',   'campaigns_legacy',
                'legacy_id',       camp.id::TEXT
            )                       AS settings,
            COALESCE(camp.started_at, NOW()),
            NOW()
        FROM public.campaigns_legacy camp
        JOIN _migration_user_workspace m ON m.user_id = camp.user_id
        -- Idempotência: somente inserir se não existir campanha com mesmo legacy_id
        WHERE NOT EXISTS (
            SELECT 1 FROM public.campaigns nc
            WHERE nc.workspace_id = m.workspace_id
              AND nc.settings->>'legacy_id' = camp.id::TEXT
        )
        RETURNING id, (settings->>'legacy_id')::UUID AS old_id, workspace_id
    )
    INSERT INTO _migration_campaign_id_map (old_id, new_id, workspace_id)
    SELECT i.old_id, i.id, i.workspace_id
    FROM inserted i
    WHERE i.old_id IS NOT NULL
    ON CONFLICT (old_id) DO NOTHING;

    -- Mapear campanhas já existentes em re-execuções
    INSERT INTO _migration_campaign_id_map (old_id, new_id, workspace_id)
    SELECT
        (nc.settings->>'legacy_id')::UUID AS old_id,
        nc.id,
        nc.workspace_id
    FROM public.campaigns nc
    WHERE nc.settings->>'migrated_from' = 'campaigns_legacy'
      AND nc.settings->>'legacy_id' IS NOT NULL
    ON CONFLICT (old_id) DO NOTHING;

    RAISE NOTICE 'PASSO 6: campaigns_legacy → campaigns concluído. Total v2: %',
        (SELECT COUNT(*) FROM public.campaigns);
END $$;


-- ============================================================
-- PASSO 7a: MIGRAR campaign_results_legacy → campaign_dispatch_logs
-- ============================================================
-- Mapeamento de status:
--   'success'          → success
--   'error' / 'failed' → error
--   'skipped'          → skipped
--   demais             → pending

INSERT INTO public.campaign_dispatch_logs (
    workspace_id,
    campaign_id,
    contact_id,
    instance_id,
    status,
    error_msg,
    sent_at,
    message_snapshot,
    created_at,
    updated_at
)
SELECT
    cm.workspace_id,
    cm.new_id                                AS campaign_id,
    c.id                                     AS contact_id,     -- NULL se contato não migrado
    im.new_id                                AS instance_id,    -- NULL se instância não mapeada
    CASE
        WHEN r.status = 'success'              THEN 'success'::public.dispatch_log_status
        WHEN r.status IN ('error', 'failed')   THEN 'error'::public.dispatch_log_status
        WHEN r.status = 'skipped'              THEN 'skipped'::public.dispatch_log_status
        ELSE                                        'pending'::public.dispatch_log_status
    END                                      AS status,
    r.error_msg,
    r.sent_at,
    jsonb_build_object(
        'contact_name',   r.contact_name,
        'phone',          r.phone,
        'legacy_id',      r.id::TEXT,
        'migrated_from',  'campaign_results_legacy'
    )                                        AS message_snapshot,
    COALESCE(r.sent_at, NOW()),
    NOW()
FROM public.campaign_results_legacy r
JOIN _migration_campaign_id_map cm ON cm.old_id = r.campaign_id
-- Lookup do contato pelo telefone dentro do workspace
LEFT JOIN public.contacts c
    ON c.workspace_id = cm.workspace_id
    AND c.phone       = r.phone
-- Lookup da instância via campanha legada
LEFT JOIN public.campaigns_legacy cl_camp ON cl_camp.id = r.campaign_id
LEFT JOIN _migration_instance_id_map im
    ON im.old_id = cl_camp.instance_id
-- Idempotência: não reinserir logs já migrados
WHERE NOT EXISTS (
    SELECT 1 FROM public.campaign_dispatch_logs dl
    WHERE dl.message_snapshot->>'legacy_id' = r.id::TEXT
);

DO $$
BEGIN
    RAISE NOTICE 'PASSO 7a: campaign_results_legacy → campaign_dispatch_logs concluído. Total v2: %',
        (SELECT COUNT(*) FROM public.campaign_dispatch_logs);
END $$;


-- ============================================================
-- PASSO 7b: POPULAR campaign_contacts A PARTIR DOS LOGS
-- ============================================================
-- Cria um registro por (campaign_id, contact_id) com status consolidado.
-- Apenas para contatos que foram de fato resolvidos (contact_id NOT NULL).

INSERT INTO public.campaign_contacts (
    workspace_id,
    campaign_id,
    contact_id,
    status,
    attempt_count,
    last_attempt_at,
    created_at,
    updated_at
)
SELECT
    dl.workspace_id,
    dl.campaign_id,
    dl.contact_id,
    -- Status consolidado: se houver qualquer 'success' → success; algum 'error' → error; senão pending
    CASE
        WHEN bool_or(dl.status = 'success') THEN 'success'::public.dispatch_log_status
        WHEN bool_or(dl.status = 'error')   THEN 'error'::public.dispatch_log_status
        ELSE                                     'pending'::public.dispatch_log_status
    END                     AS status,
    COUNT(dl.id)::INTEGER   AS attempt_count,
    MAX(dl.sent_at)         AS last_attempt_at,
    MIN(dl.created_at)      AS created_at,
    NOW()                   AS updated_at
FROM public.campaign_dispatch_logs dl
WHERE dl.contact_id IS NOT NULL
  AND dl.message_snapshot->>'migrated_from' = 'campaign_results_legacy'
GROUP BY dl.workspace_id, dl.campaign_id, dl.contact_id
ON CONFLICT (campaign_id, contact_id) DO NOTHING;

DO $$
BEGIN
    RAISE NOTICE 'PASSO 7b: campaign_contacts populado. Total: %',
        (SELECT COUNT(*) FROM public.campaign_contacts);
END $$;


-- ============================================================
-- PASSO 8: MIGRAR payments_legacy → payments
-- ============================================================

INSERT INTO public.payments (
    workspace_id,
    status,
    amount,
    currency,
    due_date,
    paid_at,
    provider,
    provider_payment_id,
    payment_link,
    boleto_url,
    notes,
    metadata,
    created_at,
    updated_at
)
SELECT
    m.workspace_id,
    CASE
        WHEN pl.status IN ('pending','paid','overdue','canceled','refunded')
        THEN pl.status::public.payment_status
        ELSE 'pending'::public.payment_status
    END                                         AS status,
    COALESCE(pl.amount, 0),
    COALESCE(pl.currency, 'BRL'),
    pl.due_date,
    pl.paid_at,
    CASE WHEN pl.asaas_payment_id IS NOT NULL THEN 'asaas' ELSE NULL END AS provider,
    pl.asaas_payment_id                         AS provider_payment_id,
    pl.payment_link,
    pl.boleto_url,
    pl.notes,
    jsonb_build_object(
        'migrated_from',      'payments_legacy',
        'legacy_id',          pl.id::TEXT,
        'asaas_customer_id',  pl.asaas_customer_id,
        'plan',               pl.plan,
        'instance_count',     pl.instance_count
    )                                           AS metadata,
    COALESCE(pl.created_at, NOW()),
    COALESCE(pl.updated_at, NOW())
FROM public.payments_legacy pl
JOIN _migration_user_workspace m ON m.user_id = pl.user_id
WHERE NOT EXISTS (
    SELECT 1 FROM public.payments np
    WHERE np.metadata->>'legacy_id' = pl.id::TEXT
);

DO $$
BEGIN
    RAISE NOTICE 'PASSO 8: payments_legacy → payments concluído. Total v2: %',
        (SELECT COUNT(*) FROM public.payments);
END $$;


-- ============================================================
-- PASSO 9: VALIDAÇÃO PÓS-MIGRAÇÃO
-- ============================================================

DO $$
DECLARE
    -- Origens (legado)
    src_profiles  BIGINT; src_inst  BIGINT; src_cont  BIGINT;
    src_camp      BIGINT; src_res   BIGINT; src_pay   BIGINT;
    -- Destinos: apenas registros inseridos por este script (marcador migrated_from)
    -- Registros nativos do v2 já existentes não são contados → comparação precisa.
    dst_profiles  BIGINT; dst_inst  BIGINT; dst_cont  BIGINT;
    dst_camp      BIGINT; dst_res   BIGINT; dst_pay   BIGINT;
    -- Workspaces
    workspaces    BIGINT; members   BIGINT;
    -- Alertas: workspace_id ausente
    inst_no_wsp   BIGINT; cont_no_wsp BIGINT;
    camp_no_wsp   BIGINT; pay_no_wsp  BIGINT;
    logs_no_cont  BIGINT;
    wsp_no_owner  BIGINT;
    -- Alertas: legados não migrados (user_id órfão — removido do Auth)
    orphan_inst   BIGINT; orphan_cont BIGINT;
    orphan_camp   BIGINT; orphan_pay  BIGINT;
BEGIN
    -- ── Origens ──
    SELECT COUNT(*) INTO src_profiles FROM public.profiles;
    SELECT COUNT(*) INTO src_inst     FROM public.instances_legacy;
    SELECT COUNT(*) INTO src_cont     FROM public.contacts_legacy;
    SELECT COUNT(*) INTO src_camp     FROM public.campaigns_legacy;
    SELECT COUNT(*) INTO src_res      FROM public.campaign_results_legacy;
    SELECT COUNT(*) INTO src_pay      FROM public.payments_legacy;

    -- ── Destinos: filtrar somente registros originados desta migração ──
    SELECT COUNT(*) INTO dst_profiles FROM public.users_profiles
        WHERE id IN (SELECT id FROM public.profiles);
    SELECT COUNT(*) INTO dst_inst FROM public.instances
        WHERE metadata->>'migrated_from' = 'instances_legacy';
    -- contacts usa ON CONFLICT DO NOTHING → phone já existente não recebe migrated_from
    SELECT COUNT(*) INTO dst_cont FROM public.contacts
        WHERE metadata->>'migrated_from' = 'contacts_legacy';
    SELECT COUNT(*) INTO dst_camp FROM public.campaigns
        WHERE settings->>'migrated_from' = 'campaigns_legacy';
    SELECT COUNT(*) INTO dst_res FROM public.campaign_dispatch_logs
        WHERE message_snapshot->>'migrated_from' = 'campaign_results_legacy';
    SELECT COUNT(*) INTO dst_pay FROM public.payments
        WHERE metadata->>'migrated_from' = 'payments_legacy';

    SELECT COUNT(*) INTO workspaces FROM public.workspaces;
    SELECT COUNT(*) INTO members    FROM public.workspace_members WHERE role = 'owner';

    -- ── Integridade: workspace_id NULL ──
    SELECT COUNT(*) INTO inst_no_wsp  FROM public.instances  WHERE workspace_id IS NULL;
    SELECT COUNT(*) INTO cont_no_wsp  FROM public.contacts   WHERE workspace_id IS NULL;
    SELECT COUNT(*) INTO camp_no_wsp  FROM public.campaigns  WHERE workspace_id IS NULL;
    SELECT COUNT(*) INTO pay_no_wsp   FROM public.payments   WHERE workspace_id IS NULL;
    SELECT COUNT(*) INTO logs_no_cont
        FROM public.campaign_dispatch_logs
        WHERE contact_id IS NULL
          AND message_snapshot->>'migrated_from' = 'campaign_results_legacy';
    SELECT COUNT(*) INTO wsp_no_owner
        FROM public.workspaces w
        WHERE NOT EXISTS (
            SELECT 1 FROM public.workspace_members m
            WHERE m.workspace_id = w.id AND m.role = 'owner'
        );

    -- ── Completude: legados cujo user_id não existe mais em auth.users ──
    -- Esses registros NÃO foram migrados (usuário removido do Auth).
    SELECT COUNT(*) INTO orphan_inst FROM public.instances_legacy il
        WHERE NOT EXISTS (
            SELECT 1 FROM _migration_user_workspace mw WHERE mw.user_id = il.user_id
        );
    SELECT COUNT(*) INTO orphan_cont FROM public.contacts_legacy cl
        WHERE NOT EXISTS (
            SELECT 1 FROM _migration_user_workspace mw WHERE mw.user_id = cl.user_id
        );
    SELECT COUNT(*) INTO orphan_camp FROM public.campaigns_legacy camp
        WHERE NOT EXISTS (
            SELECT 1 FROM _migration_user_workspace mw WHERE mw.user_id = camp.user_id
        );
    SELECT COUNT(*) INTO orphan_pay FROM public.payments_legacy pl
        WHERE NOT EXISTS (
            SELECT 1 FROM _migration_user_workspace mw WHERE mw.user_id = pl.user_id
        );

    RAISE NOTICE '════════════════════════════════════════════';
    RAISE NOTICE 'PÓS-MIGRAÇÃO — COMPARATIVO (somente registros migrados):';
    RAISE NOTICE '  profiles:  % origem → % destino', src_profiles, dst_profiles;
    RAISE NOTICE '  instances: % origem → % destino', src_inst,     dst_inst;
    RAISE NOTICE '  contacts:  % origem → % destino (* phone duplicado = ignorado)', src_cont, dst_cont;
    RAISE NOTICE '  campaigns: % origem → % destino', src_camp,     dst_camp;
    RAISE NOTICE '  disp_logs: % origem → % destino', src_res,      dst_res;
    RAISE NOTICE '  payments:  % origem → % destino', src_pay,      dst_pay;
    RAISE NOTICE '  workspaces: %  |  owners: %', workspaces, members;
    RAISE NOTICE '════════════════════════════════════════════';
    RAISE NOTICE 'INTEGRIDADE (workspace_id NULL — esperado: 0):';
    RAISE NOTICE '  instances: %', inst_no_wsp;
    RAISE NOTICE '  contacts:  %', cont_no_wsp;
    RAISE NOTICE '  campaigns: %', camp_no_wsp;
    RAISE NOTICE '  payments:  %', pay_no_wsp;
    RAISE NOTICE '  disp_logs sem contact_id: % (normal se phone ausente em contacts_legacy)', logs_no_cont;
    RAISE NOTICE '  workspaces sem owner: %', wsp_no_owner;
    RAISE NOTICE 'COMPLETUDE (legados não migrados por user_id órfão):';
    RAISE NOTICE '  instances_legacy: %', orphan_inst;
    RAISE NOTICE '  contacts_legacy:  %', orphan_cont;
    RAISE NOTICE '  campaigns_legacy: %', orphan_camp;
    RAISE NOTICE '  payments_legacy:  %', orphan_pay;
    RAISE NOTICE '════════════════════════════════════════════';

    -- ── Alertas críticos ──
    IF inst_no_wsp > 0 OR cont_no_wsp > 0 OR camp_no_wsp > 0 OR pay_no_wsp > 0 THEN
        RAISE WARNING 'ATENÇÃO: registros sem workspace_id encontrados. Investigar antes de usar o sistema!';
    END IF;
    IF wsp_no_owner > 0 THEN
        RAISE WARNING 'ATENÇÃO: % workspace(s) sem owner em workspace_members!', wsp_no_owner;
    END IF;
    IF (orphan_inst + orphan_cont + orphan_camp + orphan_pay) > 0 THEN
        RAISE WARNING
            'ATENÇÃO: % instâncias, % contatos, % campanhas e % pagamentos legados'
            ' NÃO foram migrados (user_id removido do Auth).'
            ' Esses dados pertencem a usuários inexistentes.',
            orphan_inst, orphan_cont, orphan_camp, orphan_pay;
    END IF;
    IF logs_no_cont > 0 THEN
        RAISE NOTICE 'INFO: % logs de disparo sem contact_id. Normal se o telefone não constava em contacts_legacy.', logs_no_cont;
    END IF;

    RAISE NOTICE 'Validação concluída. Verifique os avisos acima antes de usar o sistema.';
    RAISE NOTICE '════════════════════════════════════════════';
END $$;


-- ============================================================
-- CONFIRMAR TRANSAÇÃO
-- ============================================================
-- Chegando aqui: passos 2-9 concluídos sem erros.
-- COMMIT persiste toda a migração atomicamente.
-- Se qualquer erro ocorreu acima, este COMMIT nunca é executado.
COMMIT;


-- ============================================================
-- PASSO 10: (OPCIONAL) BLOQUEAR TABELAS LEGADAS
-- ============================================================
-- Execute SOMENTE após 30 dias de operação estável e validação completa.
-- Descomente o bloco abaixo quando estiver pronto para bloquear.
--
-- DO $$
-- BEGIN
--     -- Habilitar RLS sem políticas = acesso bloqueado para authenticated
--     -- service_role ainda consegue acessar normalmente
--     ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
--     ALTER TABLE public.instances_legacy        ENABLE ROW LEVEL SECURITY;
--     ALTER TABLE public.contacts_legacy         ENABLE ROW LEVEL SECURITY;
--     ALTER TABLE public.campaigns_legacy        ENABLE ROW LEVEL SECURITY;
--     ALTER TABLE public.campaign_results_legacy ENABLE ROW LEVEL SECURITY;
--     ALTER TABLE public.payments_legacy         ENABLE ROW LEVEL SECURITY;
--
--     RAISE NOTICE 'Tabelas legadas bloqueadas para usuários autenticados.';
--     RAISE NOTICE 'Para remover permanentemente, execute o DROP TABLE do migration-plan-v2.md (T+30 dias).';
-- END $$;


-- ============================================================
-- FIM DA MIGRAÇÃO — DISPARO PRO v2.0
-- ============================================================
--
-- PRÓXIMOS PASSOS:
--   1. Verifique os RAISE NOTICE acima — todos os alertas devem ser 0.
--   2. Teste login e dashboard no frontend.
--   3. Execute os comandos de Realtime separadamente:
--        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
--        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;
--        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
--        ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_status;
--   4. Teste create_workspace_with_owner('Nome','slug') com um usuário real.
--   5. Após 30 dias: execute o PASSO 10 e depois os DROPs do migration-plan-v2.md.
-- ============================================================
