-- Add municipio column to agenda_eventos
ALTER TABLE agenda_eventos
ADD COLUMN IF NOT EXISTS municipio VARCHAR(100);
