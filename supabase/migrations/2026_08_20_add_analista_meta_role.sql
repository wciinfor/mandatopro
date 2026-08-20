-- Migration para incluir ANALISTA_META na check constraint da tabela usuarios

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'usuarios'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%nivel%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE usuarios DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_nivel_check
  CHECK (nivel IN ('ADMINISTRADOR', 'LIDERANCA', 'OPERADOR', 'ATENDENTE_CONNECT', 'SUPERVISOR_CONNECT', 'ANALISTA_META'));
