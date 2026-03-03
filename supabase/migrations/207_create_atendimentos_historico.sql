-- Tabela de historico de atendimentos
CREATE TABLE IF NOT EXISTS atendimentos_historico (
  id BIGSERIAL PRIMARY KEY,
  atendimento_id BIGINT REFERENCES atendimentos(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL CHECK (status IN ('AGENDADO', 'REALIZADO', 'CANCELADO')),
  observacao TEXT,
  usuario_nome VARCHAR(150),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_atendimentos_historico_atendimento_id
  ON atendimentos_historico (atendimento_id, created_at);

ALTER TABLE atendimentos_historico ENABLE ROW LEVEL SECURITY;
