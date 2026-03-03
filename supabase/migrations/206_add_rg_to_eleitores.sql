-- Adiciona coluna RG à tabela de eleitores
-- Esta coluna é necessária para exibir o RG na listagem de atendimentos

ALTER TABLE eleitores
ADD COLUMN IF NOT EXISTS rg VARCHAR(11);

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_eleitores_rg ON eleitores(rg);

-- Comentário para documentação
COMMENT ON COLUMN eleitores.rg IS 'Registro Geral do eleitor';
