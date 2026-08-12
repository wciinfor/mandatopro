-- =============================================================
-- Índice de Performance: acelerar busca por intervalo de datas de criacao
--
-- Tabela: eleitores (320.000+ linhas)
-- Coluna: created_at
--
-- Evita a falha 57014 (statement timeout) no agrupamento diário da RPC.
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_eleitores_created_at ON eleitores(created_at);
