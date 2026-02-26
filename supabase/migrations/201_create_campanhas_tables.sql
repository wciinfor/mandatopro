-- Tabela: categorias_servicos
-- Descrição: Categorias de serviços que podem ser oferecidos nas campanhas
CREATE TABLE IF NOT EXISTS categorias_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela: campanhas
-- Descrição: Campanhas de atendimento à população
CREATE TABLE IF NOT EXISTS campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  local VARCHAR(255) NOT NULL,
  data_campanha DATE NOT NULL,
  hora_inicio TIME,
  hora_fim TIME,
  status VARCHAR(20) DEFAULT 'PLANEJAMENTO' CHECK (status IN ('PLANEJAMENTO', 'EXECUCAO', 'CONCLUIDA', 'CANCELADA')),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela: campanhas_liderancas
-- Descrição: Associação entre campanhas e lideranças envolvidas
CREATE TABLE IF NOT EXISTS campanhas_liderancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  lideranca_id BIGINT NOT NULL REFERENCES liderancas(id) ON DELETE CASCADE,
  papel VARCHAR(50) DEFAULT 'APOIO' CHECK (papel IN ('APOIO', 'COORDENADOR', 'SUPERVISOR')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campanha_id, lideranca_id)
);

-- Tabela: campanhas_servicos
-- Descrição: Serviços oferecidos em cada campanha
CREATE TABLE IF NOT EXISTS campanhas_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  categoria_servico_id UUID NOT NULL REFERENCES categorias_servicos(id) ON DELETE CASCADE,
  quantidade INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campanha_id, categoria_servico_id)
);

-- Índices para melhor performance
CREATE INDEX idx_campanhas_data ON campanhas(data_campanha);
CREATE INDEX idx_campanhas_local ON campanhas(local);
CREATE INDEX idx_campanhas_status ON campanhas(status);
CREATE INDEX idx_campanhas_liderancas_lideranca ON campanhas_liderancas(lideranca_id);
CREATE INDEX idx_campanhas_servicos_servico ON campanhas_servicos(categoria_servico_id);

-- Row Level Security (RLS)
ALTER TABLE campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanhas_liderancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanhas_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_servicos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para campanhas
CREATE POLICY "campanhas_select_all" ON campanhas
  FOR SELECT USING (true);

CREATE POLICY "campanhas_insert_authenticated" ON campanhas
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "campanhas_update_authenticated" ON campanhas
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "campanhas_delete_authenticated" ON campanhas
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Políticas RLS para campanhas_liderancas
CREATE POLICY "campanhas_liderancas_select_all" ON campanhas_liderancas
  FOR SELECT USING (true);

CREATE POLICY "campanhas_liderancas_insert_authenticated" ON campanhas_liderancas
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "campanhas_liderancas_update_authenticated" ON campanhas_liderancas
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "campanhas_liderancas_delete_authenticated" ON campanhas_liderancas
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Políticas RLS para campanhas_servicos
CREATE POLICY "campanhas_servicos_select_all" ON campanhas_servicos
  FOR SELECT USING (true);

CREATE POLICY "campanhas_servicos_insert_authenticated" ON campanhas_servicos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "campanhas_servicos_update_authenticated" ON campanhas_servicos
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "campanhas_servicos_delete_authenticated" ON campanhas_servicos
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Políticas RLS para categorias_servicos
CREATE POLICY "categorias_servicos_select_all" ON categorias_servicos
  FOR SELECT USING (true);

CREATE POLICY "categorias_servicos_insert_authenticated" ON categorias_servicos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "categorias_servicos_update_authenticated" ON categorias_servicos
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Dados iniciais de categorias de serviços
INSERT INTO categorias_servicos (nome, descricao) VALUES
  ('Atendimento Médico', 'Atendimento médico e consultas'),
  ('Atendimento Odontológico', 'Serviços de saúde bucal'),
  ('Distribuição de Alimentos', 'Entrega de alimentos e cestas básicas'),
  ('Orientação Jurídica', 'Consultoria e orientação legal'),
  ('Encaminhamento Social', 'Encaminhamento a programas sociais'),
  ('Cadastro de Benefícios', 'Inscrição em programas governamentais'),
  ('Oficinas de Capacitação', 'Treinamentos e cursos'),
  ('Emissão de documentos', 'Auxílio na obtenção de documentos'),
  ('Orientação de Saúde', 'Palestras e orientações sobre saúde'),
  ('Oftalmologista', 'Atendimento oftalmológico e exames de visão'),
  ('Outros', 'Outros serviços não especificados')
ON CONFLICT (nome) DO NOTHING;

-- Comentários nas tabelas
COMMENT ON TABLE campanhas IS 'Campanhas de atendimento à população com serviços variados';
COMMENT ON TABLE campanhas_liderancas IS 'Lideranças envolvidas em cada campanha';
COMMENT ON TABLE campanhas_servicos IS 'Serviços oferecidos em cada campanha';
COMMENT ON TABLE categorias_servicos IS 'Categorias de serviços disponíveis';
