-- Migration 248: Adicionar coluna mandato_id à tabela agenda_eventos (Sprint P2.22)
-- Permite o isolamento operacional de eventos da agenda por gabinete (Estadual = 1, Federal = 2)

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'agenda_eventos' 
        AND column_name = 'mandato_id'
    ) THEN
        ALTER TABLE agenda_eventos ADD COLUMN mandato_id BIGINT REFERENCES mandatos(id);
    END IF;
END $$;

-- Índice para performance de listagem e isolamento por mandato
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_mandato_id ON agenda_eventos(mandato_id);
