-- Migration 264: Adiciona suporte ao provedor VIBEWHATS em whatsapp_business_accounts
-- Atualiza a CHECK constraint da coluna provider para permitir ('META', 'WABLAST', 'YCLOUD', 'WAFLY', 'VIBEWHATS')
-- Preserva integralmente os provedores existentes, colunas e dados já cadastrados.
-- ATENÇÃO: NÃO EXECUTADA AUTOMATICAMENTE (Requer aprovação do operador).

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

    -- 2. Remove pelo nome padrão explícito caso ainda exista
    ALTER TABLE public.whatsapp_business_accounts
      DROP CONSTRAINT IF EXISTS whatsapp_business_accounts_provider_check;

    -- 3. Adiciona a constraint atualizada permitindo META, WABLAST, YCLOUD, WAFLY e VIBEWHATS
    ALTER TABLE public.whatsapp_business_accounts
      ADD CONSTRAINT whatsapp_business_accounts_provider_check
      CHECK (provider IN ('META', 'WABLAST', 'YCLOUD', 'WAFLY', 'VIBEWHATS'));
END $$;
