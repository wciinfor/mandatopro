-- Tabela: atendimentos_servicos
-- Descrição: Relacionamento entre atendimentos e serviços oferecidos

CREATE TABLE IF NOT EXISTS atendimentos_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id UUID NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
  categoria_servico_id UUID NOT NULL REFERENCES categorias_servicos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(atendimento_id, categoria_servico_id)
);

-- Índices para melhor performance
CREATE INDEX idx_atendimentos_servicos_atendimento ON atendimentos_servicos(atendimento_id);
CREATE INDEX idx_atendimentos_servicos_servico ON atendimentos_servicos(categoria_servico_id);

-- Row Level Security (RLS)
ALTER TABLE atendimentos_servicos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "atendimentos_servicos_select_all" ON atendimentos_servicos
  FOR SELECT USING (true);

CREATE POLICY "atendimentos_servicos_insert_authenticated" ON atendimentos_servicos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "atendimentos_servicos_delete_authenticated" ON atendimentos_servicos
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Comentários
COMMENT ON TABLE atendimentos_servicos IS 'Serviços oferecidos em cada atendimento (quando vinculado a uma campanha)';
