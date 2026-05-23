-- ============================================================
-- MIGRATION: endurecer advisors restantes pos-RLS
-- Data: 2026-05-22
--
-- Contexto:
-- - O app chama RPCs e storage por API Routes server-side.
-- - O navegador nao deve chamar RPCs SECURITY DEFINER nem manipular
--   storage.objects diretamente.
-- - O bucket documentos e publico; URLs publicas continuam funcionando
--   sem policy ampla de SELECT em storage.objects.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS app_private.security_function_backup_227 (
  id bigserial PRIMARY KEY,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  schema_name name NOT NULL,
  function_name name NOT NULL,
  identity_arguments text NOT NULL,
  security_definer boolean NOT NULL,
  acl aclitem[],
  definition text NOT NULL
);

CREATE TABLE IF NOT EXISTS app_private.storage_policy_backup_227 (
  id bigserial PRIMARY KEY,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  schemaname name NOT NULL,
  tablename name NOT NULL,
  policyname name NOT NULL,
  permissive text,
  roles name[],
  cmd text,
  qual text,
  with_check text
);

REVOKE ALL ON app_private.security_function_backup_227 FROM anon, authenticated;
REVOKE ALL ON app_private.storage_policy_backup_227 FROM anon, authenticated;

INSERT INTO app_private.security_function_backup_227 (
  schema_name,
  function_name,
  identity_arguments,
  security_definer,
  acl,
  definition
)
SELECT
  n.nspname,
  p.proname,
  pg_get_function_identity_arguments(p.oid),
  p.prosecdef,
  p.proacl,
  pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'fn_eleitores_agrupados_bairros_belem',
    'fn_eleitores_agrupados_municipio',
    'fn_incrementar_download',
    'is_admin_user',
    'fn_documentos_updated_at'
  );

INSERT INTO app_private.storage_policy_backup_227 (
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname IN (
    'documentos_storage_delete',
    'documentos_storage_insert',
    'documentos_storage_public_read',
    'documentos_storage_select',
    'documentos_storage_update'
  );

DO $$
BEGIN
  IF to_regprocedure('public.fn_documentos_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.fn_documentos_updated_at() SET search_path = public;
  END IF;

  IF to_regprocedure('public.fn_incrementar_download(bigint)') IS NOT NULL THEN
    ALTER FUNCTION public.fn_incrementar_download(bigint) SET search_path = public;
  END IF;

  IF to_regprocedure('public.fn_eleitores_agrupados_bairros_belem()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.fn_eleitores_agrupados_bairros_belem() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.fn_eleitores_agrupados_bairros_belem() TO service_role;
  END IF;

  IF to_regprocedure('public.fn_eleitores_agrupados_municipio()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.fn_eleitores_agrupados_municipio() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.fn_eleitores_agrupados_municipio() TO service_role;
  END IF;

  IF to_regprocedure('public.fn_incrementar_download(bigint)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.fn_incrementar_download(bigint) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.fn_incrementar_download(bigint) TO service_role;
  END IF;

  IF to_regprocedure('public.is_admin_user()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.is_admin_user() TO service_role;
  END IF;
END $$;

DROP POLICY IF EXISTS "documentos_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "documentos_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "documentos_storage_public_read" ON storage.objects;
DROP POLICY IF EXISTS "documentos_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "documentos_storage_update" ON storage.objects;
