-- ==============================================================================
-- Migration 259: Ajustar FK de atendimento_connect_conversas.campanha_id
-- Redireciona a FK de disparo_campanhas(id) para communication_campaigns(id)
-- ==============================================================================

DO $$
DECLARE
  constraint_rec RECORD;
BEGIN
  -- 1. Remove qualquer constraint de foreign key existente na coluna campanha_id da tabela atendimento_connect_conversas
  FOR constraint_rec IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.atendimento_connect_conversas'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.atendimento_connect_conversas'::regclass AND attname = 'campanha_id')
      ]
  ) LOOP
    EXECUTE format('ALTER TABLE public.atendimento_connect_conversas DROP CONSTRAINT IF EXISTS %I', constraint_rec.conname);
  END LOOP;
END $$;

-- 2. Adiciona a nova Foreign Key apontando para communication_campaigns(id) ON DELETE SET NULL
ALTER TABLE public.atendimento_connect_conversas
  ADD CONSTRAINT atendimento_connect_conversas_campanha_id_fkey
  FOREIGN KEY (campanha_id)
  REFERENCES public.communication_campaigns(id)
  ON DELETE SET NULL;

-- 3. Cria índice na coluna campanha_id para otimizar filtros e JOINs
CREATE INDEX IF NOT EXISTS idx_atendimento_connect_conversas_campanha_id
  ON public.atendimento_connect_conversas(campanha_id);
