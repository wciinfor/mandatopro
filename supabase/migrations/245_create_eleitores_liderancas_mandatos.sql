-- =============================================================
-- Migration: Relação de Lideranças por Mandato para Eleitores
-- Sprint: P2.9
--
-- Tabelas Criadas:
-- 1. eleitores_liderancas_mandatos (Associação de Eleitor a Liderança por Mandato)
--
-- Regras de Segurança:
-- - FKs ON DELETE CASCADE para integridade referencial.
-- - Constraint UNIQUE (eleitor_id, mandato_id) para garantir no máximo 1 liderança por mandato por eleitor.
-- - Índices de performance para consultas por eleitor, liderança e mandato.
-- - Tabela inicializada com 0 registros (sem migração desnecessária dos dados legados).
-- =============================================================

CREATE TABLE IF NOT EXISTS public.eleitores_liderancas_mandatos (
  id BIGSERIAL PRIMARY KEY,
  eleitor_id BIGINT NOT NULL REFERENCES public.eleitores(id) ON DELETE CASCADE,
  lideranca_id BIGINT NOT NULL REFERENCES public.liderancas(id) ON DELETE CASCADE,
  mandato_id BIGINT NOT NULL REFERENCES public.mandatos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_eleitor_mandato UNIQUE (eleitor_id, mandato_id)
);

CREATE INDEX IF NOT EXISTS idx_elm_eleitor_id ON public.eleitores_liderancas_mandatos(eleitor_id);
CREATE INDEX IF NOT EXISTS idx_elm_lideranca_id ON public.eleitores_liderancas_mandatos(lideranca_id);
CREATE INDEX IF NOT EXISTS idx_elm_mandato_id ON public.eleitores_liderancas_mandatos(mandato_id);
