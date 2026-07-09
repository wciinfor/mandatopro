ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS ausente_acao_campanha BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_atendimentos_ausente_acao_campanha
  ON public.atendimentos(ausente_acao_campanha);
