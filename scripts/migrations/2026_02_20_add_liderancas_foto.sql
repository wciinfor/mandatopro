-- Adicionar coluna de foto na tabela liderancas

ALTER TABLE liderancas
  ADD COLUMN IF NOT EXISTS foto TEXT;

SELECT 'Coluna foto adicionada em liderancas' AS mensagem;
