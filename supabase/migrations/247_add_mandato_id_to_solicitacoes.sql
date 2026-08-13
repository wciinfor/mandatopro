-- Migration 247: Adicionar mandato_id à tabela solicitacoes (Sprint P2.20)
-- Permite o isolamento operacional por gabinete (Estadual = 1, Federal = 2)

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'solicitacoes' 
        AND column_name = 'mandato_id'
    ) THEN
        ALTER TABLE solicitacoes ADD COLUMN mandato_id BIGINT REFERENCES mandatos(id);
    END IF;
END $$;

-- Índice para performance de listagem e isolamento por mandato
CREATE INDEX IF NOT EXISTS idx_solicitacoes_mandato_id ON solicitacoes(mandato_id);
