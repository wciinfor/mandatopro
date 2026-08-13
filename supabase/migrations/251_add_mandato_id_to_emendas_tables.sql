-- Migration 251: Adicionar coluna mandato_id às tabelas do módulo de Emendas (Sprint P2.26)
-- Permite o isolamento operacional de emendas, repasses, órgãos e responsáveis por gabinete (Estadual = 1, Federal = 2)

-- 1. emendas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'emendas' 
        AND column_name = 'mandato_id'
    ) THEN
        ALTER TABLE emendas ADD COLUMN mandato_id BIGINT REFERENCES mandatos(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_emendas_mandato_id ON emendas(mandato_id);

-- 2. repasses
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'repasses' 
        AND column_name = 'mandato_id'
    ) THEN
        ALTER TABLE repasses ADD COLUMN mandato_id BIGINT REFERENCES mandatos(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_repasses_mandato_id ON repasses(mandato_id);

-- 3. orgaos
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orgaos' 
        AND column_name = 'mandato_id'
    ) THEN
        ALTER TABLE orgaos ADD COLUMN mandato_id BIGINT REFERENCES mandatos(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orgaos_mandato_id ON orgaos(mandato_id);

-- 4. responsaveis_emendas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'responsaveis_emendas' 
        AND column_name = 'mandato_id'
    ) THEN
        ALTER TABLE responsaveis_emendas ADD COLUMN mandato_id BIGINT REFERENCES mandatos(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_responsaveis_emendas_mandato_id ON responsaveis_emendas(mandato_id);
