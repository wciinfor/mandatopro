-- =============================================================
-- Migration: Associação N:N de Campanhas a Mandatos
-- Sprint: P2.7
--
-- Tabelas criadas:
-- 1. campanhas_mandatos (Associação N:N entre campanhas e mandatos)
--
-- Classificação inicial:
-- Todas as 10 campanhas existentes são vinculadas ao Deputado Estadual (Mandato ID 1).
--
-- Regras de Segurança: Idempotente, totalmente reversível e não-destrutiva.
-- =============================================================

-- 1. Criar tabela de junção `campanhas_mandatos`
CREATE TABLE IF NOT EXISTS public.campanhas_mandatos (
  id BIGSERIAL PRIMARY KEY,
  campanha_id UUID NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
  mandato_id BIGINT NOT NULL REFERENCES public.mandatos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_campanha_mandato UNIQUE (campanha_id, mandato_id)
);

-- 2. Criar Índices de Performance
CREATE INDEX IF NOT EXISTS idx_campanhas_mandatos_campanha_id ON public.campanhas_mandatos(campanha_id);
CREATE INDEX IF NOT EXISTS idx_campanhas_mandatos_mandato_id ON public.campanhas_mandatos(mandato_id);

-- 3. Vincular todas as 10 campanhas existentes ao Deputado Estadual (Mandato ID 1)
INSERT INTO public.campanhas_mandatos (campanha_id, mandato_id)
SELECT id, 1
FROM public.campanhas
ON CONFLICT (campanha_id, mandato_id) DO NOTHING;
