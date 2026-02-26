-- Adicionar colunas de geolocalização à tabela liderancas
-- Necessário para sincronizar lideranças no mapa

ALTER TABLE liderancas
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8),
  ADD COLUMN IF NOT EXISTS logradouro VARCHAR(500),
  ADD COLUMN IF NOT EXISTS numero VARCHAR(20),
  ADD COLUMN IF NOT EXISTS complemento VARCHAR(200),
  ADD COLUMN IF NOT EXISTS bairro VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cidade VARCHAR(100),
  ADD COLUMN IF NOT EXISTS uf VARCHAR(2),
  ADD COLUMN IF NOT EXISTS cep VARCHAR(8);

-- Confirmação
SELECT 'Colunas de geolocalização adicionadas com sucesso à tabela liderancas' AS mensagem;
