-- Corrige tipo do atendimento_id (de UUID para BIGINT) para alinhar com atendimentos.id

DROP TABLE IF EXISTS atendimentos_servicos;

CREATE TABLE atendimentos_servicos (
  id BIGSERIAL PRIMARY KEY,
  atendimento_id BIGINT NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
  categoria_servico_id UUID NOT NULL REFERENCES categorias_servicos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(atendimento_id, categoria_servico_id)
);

CREATE INDEX idx_atendimentos_servicos_atendimento ON atendimentos_servicos(atendimento_id);
CREATE INDEX idx_atendimentos_servicos_servico ON atendimentos_servicos(categoria_servico_id);

ALTER TABLE atendimentos_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "atendimentos_servicos_select_all" ON atendimentos_servicos
  FOR SELECT USING (true);

CREATE POLICY "atendimentos_servicos_insert_authenticated" ON atendimentos_servicos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "atendimentos_servicos_delete_authenticated" ON atendimentos_servicos
  FOR DELETE USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE atendimentos_servicos IS 'Servicos oferecidos em cada atendimento (quando vinculado a uma campanha)';
