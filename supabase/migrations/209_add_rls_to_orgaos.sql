-- ============================================================
-- MIGRAÇÃO: Adicionar Row Level Security (RLS) à tabela ORGAOS
-- DATA: 2026-03-03
-- ============================================================

-- Habilitar RLS na tabela orgaos
ALTER TABLE orgaos ENABLE ROW LEVEL SECURITY;

-- Política: Permitir SELECT para todos os usuários autenticados
CREATE POLICY "orgaos_select_authenticated" ON orgaos
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Política: Permitir INSERT para usuários autenticados
CREATE POLICY "orgaos_insert_authenticated" ON orgaos
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Política: Permitir UPDATE para usuários autenticados
CREATE POLICY "orgaos_update_authenticated" ON orgaos
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Política: Permitir DELETE para usuários autenticados
CREATE POLICY "orgaos_delete_authenticated" ON orgaos
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Opcional: Se desejar mais restritivo, use policies baseadas em roles específicas
-- Descomentar e usar conforme necessário:

-- CREATE POLICY "orgaos_select_all" ON orgaos
--   FOR SELECT
--   TO authenticated
--   USING (true);

-- CREATE POLICY "orgaos_insert_admin" ON orgaos
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM usuarios
--       WHERE usuarios.auth_user_id = auth.uid()
--       AND usuarios.role = 'ADMIN'
--     )
--   );
