-- Adiciona data_conclusao aos atendimentos
ALTER TABLE atendimentos
  ADD COLUMN IF NOT EXISTS data_conclusao TIMESTAMP;
