-- =============================================================
-- Migration: Adicionar Pertencimento por Mandato na Tabela Eleitores
-- Sprint: P2.8
--
-- Alterações:
-- 1. Adicionar coluna `pertencimento` (VARCHAR(20) NOT NULL DEFAULT 'NAO_CLASSIFICADO')
-- 2. Restrição CHECK (pertencimento IN ('ESTADUAL', 'FEDERAL', 'AMBOS', 'NAO_CLASSIFICADO'))
-- 3. Índice B-Tree `idx_eleitores_pertencimento` para performance de consultas por mandato
--
-- Desempenho em Produção:
-- No PostgreSQL 11+, a adição de coluna com DEFAULT é uma operação de metadados de tempo constante (0ms),
-- garantindo que os 320.608 registros existentes assumam 'NAO_CLASSIFICADO' SEM REESCREVER a tabela em disco.
-- =============================================================

-- 1. Adicionar coluna pertencimento com default 'NAO_CLASSIFICADO' e CHECK constraint
ALTER TABLE public.eleitores
ADD COLUMN IF NOT EXISTS pertencimento VARCHAR(20) NOT NULL DEFAULT 'NAO_CLASSIFICADO'
CONSTRAINT check_eleitores_pertencimento CHECK (pertencimento IN ('ESTADUAL', 'FEDERAL', 'AMBOS', 'NAO_CLASSIFICADO'));

-- 2. Criar índice de performance para consultas por pertencimento
CREATE INDEX IF NOT EXISTS idx_eleitores_pertencimento ON public.eleitores(pertencimento);
