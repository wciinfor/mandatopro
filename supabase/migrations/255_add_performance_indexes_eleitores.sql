-- =============================================================
-- Migration: Índices de Performance para Tabela Eleitores (300k+ registros)
-- Objetivo: Acelerar filtros de mandato, buscas textuais por nome com ILIKE e ordenação alfabética
-- =============================================================

-- 1. Garantir que a extensão pg_trgm esteja disponível
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Índice B-Tree para pertencimento (segregação e filtros por mandato)
CREATE INDEX IF NOT EXISTS idx_eleitores_pertencimento ON public.eleitores (pertencimento);

-- 3. Índice Trigram GIN para buscas textuais por nome via ILIKE '%termo%'
CREATE INDEX IF NOT EXISTS idx_eleitores_nome_trgm ON public.eleitores USING gin (nome gin_trgm_ops);

-- 4. Índice B-Tree para ordenação alfabética rápida (A-Z / Z-A)
CREATE INDEX IF NOT EXISTS idx_eleitores_nome_btree ON public.eleitores (nome);
