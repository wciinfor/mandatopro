-- ============================================================
-- 25. TABELA DE NOTIFICAÇÕES INTERNAS (UNIDIRECIONAIS)
-- ============================================================

CREATE TABLE IF NOT EXISTS notificacoes (
  id BIGSERIAL PRIMARY KEY,

  remetente_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  remetente_nome VARCHAR(255),
  remetente_nivel VARCHAR(50),

  destinatario_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,

  titulo VARCHAR(255),
  mensagem TEXT NOT NULL,

  lida BOOLEAN DEFAULT false,
  data_leitura TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_destinatario_created
  ON notificacoes(destinatario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificacoes_destinatario_lida
  ON notificacoes(destinatario_id, lida);
