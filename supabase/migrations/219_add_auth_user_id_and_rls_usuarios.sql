-- Add auth_user_id and RLS policies for usuarios

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuarios_auth_user_fk'
  ) THEN
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_auth_user_fk
      FOREIGN KEY (auth_user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_usuarios_auth_user_id ON usuarios(auth_user_id);

-- Backfill auth_user_id by email match
UPDATE usuarios u
SET auth_user_id = au.id
FROM auth.users au
WHERE u.auth_user_id IS NULL
  AND u.email = au.email;

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usuarios_select_own ON usuarios;
DROP POLICY IF EXISTS usuarios_update_own ON usuarios;
DROP POLICY IF EXISTS usuarios_admin_all ON usuarios;

CREATE POLICY usuarios_select_own ON usuarios
FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

CREATE POLICY usuarios_update_own ON usuarios
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY usuarios_admin_all ON usuarios
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
      AND u.nivel = 'ADMINISTRADOR'
      AND u.ativo = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
      AND u.nivel = 'ADMINISTRADOR'
      AND u.ativo = true
  )
);
