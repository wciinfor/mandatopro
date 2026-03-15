-- Migration: Adicionar coluna de projeção de votos à tabela liderancas
-- Data: 15 de março de 2026
-- Descrição: Permite registrar a projeção de votos que cada liderança vai trazer ao candidato

ALTER TABLE liderancas ADD COLUMN IF NOT EXISTS projecao_votos INTEGER DEFAULT 0;

-- Criar índice para otimizar queries de projeção
CREATE INDEX IF NOT EXISTS idx_liderancas_projecao_votos ON liderancas(projecao_votos);

-- Adicionar comentário na coluna
COMMENT ON COLUMN liderancas.projecao_votos IS 'Projeção de votos que a liderança deve trazer ao candidato';
