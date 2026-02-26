-- Adicionar coluna para marcar se eleitor é liderança
-- Uma liderança é apenas um rótulo dado a um eleitor

ALTER TABLE eleitores
  ADD COLUMN IF NOT EXISTS e_lideranca BOOLEAN DEFAULT FALSE;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_eleitores_e_lideranca ON eleitores(e_lideranca);

-- Atualizar registro: marcar eleitores que têm lideranca_id (são lideranças)
UPDATE eleitores
SET e_lideranca = TRUE
WHERE lideranca_id IS NOT NULL;

SELECT 'Coluna e_lideranca adicionada com sucesso' AS mensagem;
