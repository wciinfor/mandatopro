-- Remover colunas de endereço da tabela liderancas
-- Essas colunas não são mais necessárias pois as lideranças são criadas a partir de eleitores que já possuem endereço

ALTER TABLE liderancas
  DROP COLUMN IF EXISTS cep,
  DROP COLUMN IF EXISTS logradouro,
  DROP COLUMN IF EXISTS numero,
  DROP COLUMN IF EXISTS complemento,
  DROP COLUMN IF EXISTS bairro,
  DROP COLUMN IF EXISTS cidade,
  DROP COLUMN IF EXISTS uf,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude;

-- Confirmação
SELECT 'Colunas de endereço removidas com sucesso da tabela liderancas' AS mensagem;
