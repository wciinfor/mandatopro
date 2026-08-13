-- Migration 250: Adicionar coluna mandato_id às tabelas do módulo Financeiro (Sprint P2.24)
-- Permite o isolamento operacional de receitas, despesas e parceiros por gabinete (Estadual = 1, Federal = 2)

-- 1. financeiro_parceiros
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'financeiro_parceiros' 
        AND column_name = 'mandato_id'
    ) THEN
        ALTER TABLE financeiro_parceiros ADD COLUMN mandato_id BIGINT REFERENCES mandatos(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fin_parceiros_mandato ON financeiro_parceiros(mandato_id);

-- 2. financeiro_lancamentos
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'financeiro_lancamentos' 
        AND column_name = 'mandato_id'
    ) THEN
        ALTER TABLE financeiro_lancamentos ADD COLUMN mandato_id BIGINT REFERENCES mandatos(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fin_lancamentos_mandato ON financeiro_lancamentos(mandato_id);

-- 3. financeiro_despesas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'financeiro_despesas' 
        AND column_name = 'mandato_id'
    ) THEN
        ALTER TABLE financeiro_despesas ADD COLUMN mandato_id BIGINT REFERENCES mandatos(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fin_despesas_mandato ON financeiro_despesas(mandato_id);
