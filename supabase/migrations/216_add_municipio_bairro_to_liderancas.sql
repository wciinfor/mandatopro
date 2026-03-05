-- MIGRACAO: adicionar municipio e bairro em liderancas

ALTER TABLE liderancas
ADD COLUMN IF NOT EXISTS municipio VARCHAR(150);

ALTER TABLE liderancas
ADD COLUMN IF NOT EXISTS bairro VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_liderancas_municipio ON liderancas(municipio);
CREATE INDEX IF NOT EXISTS idx_liderancas_bairro ON liderancas(bairro);
