-- Migration 253: Suporte a idempotência por event_id em whatsapp_business_webhook_events
-- Adiciona a coluna event_id e índice de busca para descarte eficiente de duplicatas de webhooks YCloud/Meta.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'whatsapp_business_webhook_events' 
        AND column_name = 'event_id'
    ) THEN
        ALTER TABLE public.whatsapp_business_webhook_events 
        ADD COLUMN event_id VARCHAR(255);
    END IF;
END $$;

-- Índice para verificação rápida de duplicidade de eventos
CREATE INDEX IF NOT EXISTS idx_waba_webhook_events_event_id
  ON public.whatsapp_business_webhook_events(event_id)
  WHERE event_id IS NOT NULL;
