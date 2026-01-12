-- SQL para inserir usuário de teste
-- Execute isto no Supabase Dashboard → SQL Editor

INSERT INTO usuarios (email, nome, nivel, status, ativo)
VALUES ('admin@mandatopro.com', 'Admin Sistema', 'ADMINISTRADOR', 'ATIVO', true);

-- Você também pode executar:
-- SELECT * FROM usuarios;
-- Para verificar se foi inserido
