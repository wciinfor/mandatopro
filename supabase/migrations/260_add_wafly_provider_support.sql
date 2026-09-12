-- Migration 260: Suporte ao provedor WAFLY em whatsapp_business_accounts
-- Atualiza a CHECK constraint da coluna provider para permitir ('META', 'WABLAST', 'YCLOUD', 'WAFLY')
-- Preserva integralmente os provedores existentes, colunas e dados já cadastrados.

DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    -- 1. Localiza dinamicamente a CHECK constraint existente sobre a coluna provider
    SELECT con.conname INTO v_constraint_name
    FROM pg_constraint con
    INNER JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE con.conrelid = 'public.whatsapp_business_accounts'::regclass
      AND con.contype = 'c'
      AND att.attname = 'provider'
      AND pg_get_constraintdef(con.oid) ILIKE '%provider%IN%META%'
    LIMIT 1;

    -- 2. Se localizada, remove a constraint antiga
    IF v_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.whatsapp_business_accounts DROP CONSTRAINT ' || quote_ident(v_constraint_name);
    END IF;

    -- 3. Remove também pelo nome padrão explícito caso ainda exista
    ALTER TABLE public.whatsapp_business_accounts
      DROP CONSTRAINT IF EXISTS whatsapp_business_accounts_provider_check;

    -- 4. Adiciona a nova constraint permitindo os 4 provedores: META, WABLAST, YCLOUD e WAFLY
    ALTER TABLE public.whatsapp_business_accounts
      ADD CONSTRAINT whatsapp_business_accounts_provider_check
      CHECK (provider IN ('META', 'WABLAST', 'YCLOUD', 'WAFLY'));
END $$;
