-- Adicionar coluna id_municipio na tabela eleitores
-- Armazena o código IBGE do município

ALTER TABLE eleitores
ADD COLUMN IF NOT EXISTS id_municipio BIGINT;

-- Criar índice para melhor performance nas buscas
CREATE INDEX IF NOT EXISTS idx_eleitores_id_municipio ON eleitores(id_municipio);

-- Adicionar comentário à coluna
COMMENT ON COLUMN eleitores.id_municipio IS 'Código IBGE do município - preenchido automaticamente ao selecionar o município';
