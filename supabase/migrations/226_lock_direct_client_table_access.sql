-- ============================================================
-- MIGRATION: bloquear acesso direto do cliente a tabelas publicas
-- Data: 2026-05-22
--
-- Contexto:
-- - O app agora acessa dados de negocio por API Routes autenticadas.
-- - O cliente Supabase no navegador deve ser usado para Auth/session, nao
--   para consultar/gravar tabelas publicas diretamente.
-- - Service role continua bypassando RLS nas APIs server-side.
--
-- ATENCAO: revisar/aplicar somente depois de reconciliar o historico de
-- migrations no Supabase remoto.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS app_private.security_policy_backup_226 (
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

REVOKE ALL ON app_private.security_policy_backup_226 FROM anon, authenticated;

DO $$
DECLARE
  v_table_name text;
  policy_record record;
  tables_to_lock text[] := ARRAY[
    'agenda_eventos',
    'aniversariantes',
    'atendimentos',
    'atendimentos_historico',
    'atendimentos_servicos',
    'campanhas',
    'campanhas_liderancas',
    'campanhas_servicos',
    'categorias_servicos',
    'comunicacao_contatos',
    'comunicacao_conversas',
    'comunicacao_disparos',
    'comunicacao_mensagens',
    'configuracoes_sistema',
    'documentos',
    'eleitores',
    'emendas',
    'financeiro_caixa',
    'financeiro_despesas',
    'financeiro_doadores',
    'financeiro_faturas',
    'financeiro_lancamentos',
    'financeiro_parceiros',
    'funcionarios',
    'geolocalizacao',
    'liderancas',
    'logs_acessos',
    'logs_auditoria',
    'notificacoes',
    'orgaos',
    'repasses',
    'responsaveis_emendas',
    'solicitacoes',
    'usuarios'
  ];
BEGIN
  INSERT INTO app_private.security_policy_backup_226 (
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
  WHERE schemaname = 'public'
    AND tablename = ANY (tables_to_lock);

  FOREACH v_table_name IN ARRAY tables_to_lock LOOP
    IF to_regclass(format('public.%I', v_table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table_name);

      FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = v_table_name
      LOOP
        EXECUTE format(
          'DROP POLICY IF EXISTS %I ON public.%I',
          policy_record.policyname,
          v_table_name
        );
      END LOOP;
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.financeiro_movimentacoes') IS NOT NULL THEN
    ALTER VIEW public.financeiro_movimentacoes SET (security_invoker = true);
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_object THEN
    NULL;
END $$;
