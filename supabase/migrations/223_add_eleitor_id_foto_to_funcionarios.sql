-- Migration: add eleitor_id and foto columns to funcionarios
-- Date: 2026-06-10
-- Vincula cada funcionário ao respectivo eleitor e permite foto de crachá.

ALTER TABLE funcionarios
  ADD COLUMN IF NOT EXISTS eleitor_id BIGINT REFERENCES eleitores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS foto TEXT;

-- Índice para buscas por eleitor
CREATE INDEX IF NOT EXISTS idx_funcionarios_eleitor ON funcionarios(eleitor_id);
