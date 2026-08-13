-- =============================================================
-- Migration: Snapshot Histórico de Liderança e Mandato nos Atendimentos
-- Sprint: P2.11
--
-- Alterações:
-- 1. Adicionar colunas `lideranca_id` (BIGINT NULL) e `mandato_id` (BIGINT NULL) na tabela `atendimentos`.
-- 2. Chaves Estrangeiras para `liderancas(id)` e `mandatos(id)`.
-- 3. Índices de performance `idx_atendimentos_lideranca_id` e `idx_atendimentos_mandato_id`.
--
-- Regras de Segurança:
-- - Colunas criadas como NULLABLE para preservar 100% dos 2.665 registros legados.
-- - NENHUM UPDATE massivo de backfill é executado nesta migration.
-- =============================================================

-- 1. Adicionar coluna lideranca_id e mandato_id em atendimentos
ALTER TABLE public.atendimentos
ADD COLUMN IF NOT EXISTS lideranca_id BIGINT NULL REFERENCES public.liderancas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS mandato_id BIGINT NULL REFERENCES public.mandatos(id) ON DELETE SET NULL;

-- 2. Criar índices de performance
CREATE INDEX IF NOT EXISTS idx_atendimentos_lideranca_id ON public.atendimentos(lideranca_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_mandato_id ON public.atendimentos(mandato_id);
