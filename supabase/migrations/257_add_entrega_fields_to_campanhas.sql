-- Migration 257: Adicionar campos de data_entrega e local_entrega na tabela campanhas
-- Permite armazenar e editar informações de entrega específicas de benefícios para campanhas e disparos

ALTER TABLE public.campanhas
ADD COLUMN IF NOT EXISTS data_entrega TEXT NULL,
ADD COLUMN IF NOT EXISTS local_entrega TEXT NULL;

COMMENT ON COLUMN public.campanhas.data_entrega IS 'Data e/ou horário previsto para entrega dos benefícios (ex: 15/09/2026 às 14h)';
COMMENT ON COLUMN public.campanhas.local_entrega IS 'Local específico para entrega dos benefícios quando diferente do local da ação';
