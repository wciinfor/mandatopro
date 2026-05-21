-- ============================================================
-- PERFORMANCE: Índices para base com 220k+ registros de eleitores
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- 1. Índice na coluna status (usada em TODOS os filtros da listagem)
CREATE INDEX IF NOT EXISTS idx_eleitores_status
  ON eleitores(status);

-- 2. Índice na coluna statusCadastro (segunda coluna de status pós-migração)
CREATE INDEX IF NOT EXISTS idx_eleitores_status_cadastro
  ON eleitores("statusCadastro");

-- 3. Índice composto para o filtro combinado status + statusCadastro null
CREATE INDEX IF NOT EXISTS idx_eleitores_status_null
  ON eleitores(status, "statusCadastro")
  WHERE status IS NULL AND "statusCadastro" IS NULL;

-- 4. Índice na coluna nome (ORDER BY e buscas textuais)
CREATE INDEX IF NOT EXISTS idx_eleitores_nome
  ON eleitores(nome);

-- 5. Índice GIN trigram para busca textual rápida por nome (ilike %termo%)
--    Requer extensão pg_trgm (já habilitada no Supabase por padrão)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_eleitores_nome_trgm
  ON eleitores USING gin (nome gin_trgm_ops);

-- 6. Índice trigram para CPF (buscas com %cpf%)
CREATE INDEX IF NOT EXISTS idx_eleitores_cpf_trgm
  ON eleitores USING gin (cpf gin_trgm_ops);

-- 7. Índice nas colunas de cidade/municipio (filtro de cidade + deduplicação)
CREATE INDEX IF NOT EXISTS idx_eleitores_cidade
  ON eleitores(cidade);
CREATE INDEX IF NOT EXISTS idx_eleitores_municipio
  ON eleitores(municipio);

-- 8. Índice em lideranca_id (filtro por liderança)
CREATE INDEX IF NOT EXISTS idx_eleitores_lideranca_id
  ON eleitores(lideranca_id);

-- ============================================================
-- NORMALIZAÇÃO: Atualizar registros do CSV com status null
-- para 'ATIVO' (consistência com o padrão do sistema)
-- ATENÇÃO: Execute apenas se quiser normalizar os dados
-- ============================================================

-- Verifica quantos registros têm status null antes de corrigir:
-- SELECT COUNT(*) FROM eleitores WHERE status IS NULL AND "statusCadastro" IS NULL;

-- Para normalizar (descomente se necessário):
-- UPDATE eleitores
--   SET status = 'ATIVO', "statusCadastro" = 'ATIVO'
--   WHERE status IS NULL AND "statusCadastro" IS NULL;
