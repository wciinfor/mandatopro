-- Migration 261: Atualizacao da CHECK constraint de provider em whatsapp_business_accounts para incluir 'WAFLY'
-- Preserva integralmente os provedores existentes ('META', 'WABLAST', 'YCLOUD') e adiciona 'WAFLY'.
-- Idempotente e segura para execucao direta ou via migrador.

DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    -- 1. Localiza dinamicamente qualquer CHECK constraint existente sobre a coluna provider
    FOR v_constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        INNER JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
        WHERE con.conrelid = 'public.whatsapp_business_accounts'::regclass
          AND con.contype = 'c'
          AND att.attname = 'provider'
          AND pg_get_constraintdef(con.oid) ILIKE '%provider%IN%META%'
    LOOP
        EXECUTE 'ALTER TABLE public.whatsapp_business_accounts DROP CONSTRAINT ' || quote_ident(v_constraint_name);
    END LOOP;

    -- 2. Remove pelo nome canonico padrao caso ainda persista
    ALTER TABLE public.whatsapp_business_accounts
      DROP CONSTRAINT IF EXISTS whatsapp_business_accounts_provider_check;

    -- 3. Adiciona a constraint atualizada permitindo META, WABLAST, YCLOUD e WAFLY
    ALTER TABLE public.whatsapp_business_accounts
      ADD CONSTRAINT whatsapp_business_accounts_provider_check
      CHECK (provider IN ('META', 'WABLAST', 'YCLOUD', 'WAFLY'));
END $$;
