-- Seed data para MandatoPro

-- Inserir usuário admin
INSERT INTO usuarios (email, nome, nivel, status, ativo, data_cadastro)
VALUES ('admin@mandatopro.com', 'Admin Sistema', 'ADMINISTRADOR', 'ATIVO', true, NOW())
ON CONFLICT (email) DO NOTHING;

-- Inserir algumas lideranças de exemplo
INSERT INTO liderancas (nome, email, telefone, influencia, area_atuacao, status)
VALUES 
  ('João Silva', 'joao@example.com', '(91) 99999-9999', 'ALTA', 'Centro', 'ATIVO'),
  ('Maria Santos', 'maria@example.com', '(91) 88888-8888', 'MÉDIA', 'Norte', 'ATIVO')
ON CONFLICT (email) DO NOTHING;

-- Confirmar
SELECT COUNT(*) as total_usuarios FROM usuarios;
