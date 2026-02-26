-- Remove unused columns from campanhas table
-- Removes: latitude, longitude, criado_por (these columns were receiving NULL values)

ALTER TABLE campanhas
DROP COLUMN latitude,
DROP COLUMN longitude,
DROP COLUMN criado_por;

COMMENT ON TABLE campanhas IS 'Campanhas de atendimento à população com serviços variados (sem geolocalização)';
