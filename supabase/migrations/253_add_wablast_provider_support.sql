-- Migration 253: Suporte a provedor WABLAST em whatsapp_business_accounts
-- Atualiza a constraint de provider para permitir 'WABLAST' e adiciona identificadores dedicados.

-- 1. Atualizar constraint de valores permitidos da coluna provider ('META', 'WABLAST', 'YCLOUD')
DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    -- Localiza especificamente a CHECK constraint que valida os valores ('META', 'YCLOUD') ou ('META')
    SELECT con.conname INTO v_constraint_name
    FROM pg_constraint con
    INNER JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE con.conrelid = 'public.whatsapp_business_accounts'::regclass
      AND con.contype = 'c'
      AND att.attname = 'provider'
      AND pg_get_constraintdef(con.oid) ILIKE '%provider%IN%META%'
    LIMIT 1;

    -- Se localizada, remove a constraint antiga de enumeração
    IF v_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.whatsapp_business_accounts DROP CONSTRAINT ' || quote_ident(v_constraint_name);
    END IF;

    -- Remove pelo nome explícito padrão caso já exista
    ALTER TABLE public.whatsapp_business_accounts
      DROP CONSTRAINT IF EXISTS whatsapp_business_accounts_provider_check;

    -- Adiciona a nova constraint garantindo 'META', 'WABLAST' e 'YCLOUD'
    ALTER TABLE public.whatsapp_business_accounts
      ADD CONSTRAINT whatsapp_business_accounts_provider_check
      CHECK (provider IN ('META', 'WABLAST', 'YCLOUD'));
END $$;

-- 2. Adicionar colunas específicas do WaBlast verificando individualmente cada uma
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'whatsapp_business_accounts' 
        AND column_name = 'wablast_account_id'
    ) THEN
        ALTER TABLE public.whatsapp_business_accounts 
        ADD COLUMN wablast_account_id VARCHAR(120);
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'whatsapp_business_accounts' 
        AND column_name = 'wablast_external_ref'
    ) THEN
        ALTER TABLE public.whatsapp_business_accounts 
        ADD COLUMN wablast_external_ref VARCHAR(120);
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'whatsapp_business_accounts' 
        AND column_name = 'wablast_waba_id'
    ) THEN
        ALTER TABLE public.whatsapp_business_accounts 
        ADD COLUMN wablast_waba_id VARCHAR(120);
    END IF;
END $$;

-- 3. Criar índices parciais para buscas rápidas por external_ref e account_id
CREATE INDEX IF NOT EXISTS idx_waba_wablast_external_ref
  ON public.whatsapp_business_accounts(wablast_external_ref)
  WHERE wablast_external_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_waba_wablast_account
  ON public.whatsapp_business_accounts(wablast_account_id)
  WHERE wablast_account_id IS NOT NULL;
