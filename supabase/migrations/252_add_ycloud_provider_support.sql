-- Migration 252: Suporte a provedor YCloud em whatsapp_business_accounts e whatsapp_business_numbers (Sprint YCloud Phase 1)
-- Adiciona a coluna provider e as credenciais específicas da YCloud sem impactar a Meta Cloud API.

-- 1. Adicionar coluna provider à tabela whatsapp_business_accounts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'whatsapp_business_accounts' 
        AND column_name = 'provider'
    ) THEN
        ALTER TABLE public.whatsapp_business_accounts 
        ADD COLUMN provider VARCHAR(30) NOT NULL DEFAULT 'META'
        CHECK (provider IN ('META', 'YCLOUD'));
    END IF;
END $$;

-- 2. Adicionar credenciais específicas do YCloud em whatsapp_business_accounts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'whatsapp_business_accounts' 
        AND column_name = 'ycloud_api_key'
    ) THEN
        ALTER TABLE public.whatsapp_business_accounts 
        ADD COLUMN ycloud_api_key TEXT,
        ADD COLUMN ycloud_webhook_endpoint_id VARCHAR(120),
        ADD COLUMN ycloud_webhook_secret TEXT;
    END IF;
END $$;

-- 3. Adicionar colunas de suporte ao YCloud em whatsapp_business_numbers (BSUID)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'whatsapp_business_numbers' 
        AND column_name = 'bsuid'
    ) THEN
        ALTER TABLE public.whatsapp_business_numbers 
        ADD COLUMN bsuid VARCHAR(255);
    END IF;
END $$;

-- 4. Criar índice por provider e tenant
CREATE INDEX IF NOT EXISTS idx_waba_provider_tenant
  ON public.whatsapp_business_accounts(tenant_id, provider, status);

CREATE INDEX IF NOT EXISTS idx_waba_ycloud_endpoint
  ON public.whatsapp_business_accounts(ycloud_webhook_endpoint_id)
  WHERE ycloud_webhook_endpoint_id IS NOT NULL;
