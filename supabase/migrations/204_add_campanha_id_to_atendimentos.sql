-- Adição de coluna campanha_id à tabela atendimentos
-- Esta coluna permite vincular um atendimento a uma campanha específica

-- Verificar se coluna já existe antes de adicionar
ALTER TABLE atendimentos
ADD COLUMN IF NOT EXISTS campanha_id UUID REFERENCES campanhas(id) ON DELETE SET NULL;

-- Comentário para documentação
COMMENT ON COLUMN atendimentos.campanha_id IS 'ID da campanha associada ao atendimento (NULL para atendimentos avulsos)';

-- Índice para melhor performance nas buscas por campanha
CREATE INDEX IF NOT EXISTS idx_atendimentos_campanha_id ON atendimentos(campanha_id);
