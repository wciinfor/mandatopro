-- Add municipio column to campanhas
ALTER TABLE campanhas
ADD COLUMN IF NOT EXISTS municipio VARCHAR(100);
