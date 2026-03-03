-- ============================================================
-- MIGRAÇÃO: Adicionar Row Level Security (RLS) à tabela RESPONSAVEIS_EMENDAS
-- DATA: 2026-03-03
-- ============================================================

-- Habilitar RLS na tabela responsaveis_emendas
ALTER TABLE responsaveis_emendas ENABLE ROW LEVEL SECURITY;

-- Política: Permitir SELECT para todos os usuários autenticados
CREATE POLICY "responsaveis_emendas_select_authenticated" ON responsaveis_emendas
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Política: Permitir INSERT para usuários autenticados
CREATE POLICY "responsaveis_emendas_insert_authenticated" ON responsaveis_emendas
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Política: Permitir UPDATE para usuários autenticados
CREATE POLICY "responsaveis_emendas_update_authenticated" ON responsaveis_emendas
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Política: Permitir DELETE para usuários autenticados
CREATE POLICY "responsaveis_emendas_delete_authenticated" ON responsaveis_emendas
  FOR DELETE
  USING (auth.role() = 'authenticated');
