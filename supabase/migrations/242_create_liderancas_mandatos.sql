-- =============================================================
-- Migration: Associação N:N de Lideranças a Mandatos
-- Sprint: P2.4
--
-- Tabelas criadas:
-- 1. liderancas_mandatos (Associação N:N entre lideranças e mandatos)
--
-- Classificação inicial:
-- Todas as lideranças existentes são vinculadas ao Deputado Estadual (Mandato ID 1).
--
-- Regras de Segurança: Idempotente, totalmente reversível e não-destrutiva.
-- =============================================================

-- 1. Criar tabela de junção `liderancas_mandatos`
CREATE TABLE IF NOT EXISTS public.liderancas_mandatos (
  id BIGSERIAL PRIMARY KEY,
  lideranca_id BIGINT NOT NULL REFERENCES public.liderancas(id) ON DELETE CASCADE,
  mandato_id BIGINT NOT NULL REFERENCES public.mandatos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_lideranca_mandato UNIQUE (lideranca_id, mandato_id)
);

-- 2. Criar Índices de Performance
CREATE INDEX IF NOT EXISTS idx_liderancas_mandatos_lideranca_id ON public.liderancas_mandatos(lideranca_id);
CREATE INDEX IF NOT EXISTS idx_liderancas_mandatos_mandato_id ON public.liderancas_mandatos(mandato_id);

-- 3. Vincular todas as lideranças existentes ao Deputado Estadual (Mandato ID 1)
INSERT INTO public.liderancas_mandatos (lideranca_id, mandato_id)
SELECT id, 1
FROM public.liderancas
ON CONFLICT (lideranca_id, mandato_id) DO NOTHING;
