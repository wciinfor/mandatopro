-- Corrige recursão infinita na policy usuarios_admin_all
-- O problema: a policy fazia subquery na tabela usuarios, que por sua vez
-- acionava a própria policy → recursão infinita.
-- Solução: criar função SECURITY DEFINER que bypassa RLS para checar admin.

-- 1. Criar função que verifica se o usuário autenticado é administrador
--    SECURITY DEFINER → executa como o owner (postgres), bypassa RLS  
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios
    WHERE auth_user_id = auth.uid()
      AND nivel = 'ADMINISTRADOR'
      AND ativo = true
  );
$$;

-- 2. Recriar a policy de admin usando a função (sem subquery direta na tabela)
DROP POLICY IF EXISTS usuarios_admin_all ON usuarios;

CREATE POLICY usuarios_admin_all ON usuarios
FOR ALL
TO authenticated
USING (is_admin_user())
WITH CHECK (is_admin_user());

-- 3. Garantir que a policy de SELECT do próprio usuário não cause recursão
--    (usa auth_user_id diretamente via auth.uid(), sem subquery — já está correto,
--     mas recriamos para garantir consistência)
DROP POLICY IF EXISTS usuarios_select_own ON usuarios;
CREATE POLICY usuarios_select_own ON usuarios
FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS usuarios_update_own ON usuarios;
CREATE POLICY usuarios_update_own ON usuarios
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- 4. Permitir INSERT do service role (para criação de usuários pelo sistema)
DROP POLICY IF EXISTS usuarios_service_insert ON usuarios;
CREATE POLICY usuarios_service_insert ON usuarios
FOR INSERT
TO authenticated
WITH CHECK (true);
