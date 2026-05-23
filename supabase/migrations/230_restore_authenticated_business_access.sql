-- ============================================================
-- MIGRATION: restaurar acesso autenticado aos dados de negocio
-- Data: 2026-05-23
--
-- Contexto:
-- - A migration 226 removeu politicas RLS das tabelas publicas.
-- - Parte do frontend de producao ainda le dados diretamente pelo cliente
--   Supabase autenticado.
-- - Esta migration nao libera acesso anonimo: apenas usuarios autenticados.
-- ============================================================

DO $$
DECLARE
  v_table_name text;
  tables_to_restore text[] := ARRAY[
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
  FOREACH v_table_name IN ARRAY tables_to_restore LOOP
    IF to_regclass(format('public.%I', v_table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table_name);

      EXECUTE format('DROP POLICY IF EXISTS authenticated_select_230 ON public.%I', v_table_name);
      EXECUTE format(
        'CREATE POLICY authenticated_select_230 ON public.%I FOR SELECT TO authenticated USING (true)',
        v_table_name
      );

      EXECUTE format('DROP POLICY IF EXISTS authenticated_insert_230 ON public.%I', v_table_name);
      EXECUTE format(
        'CREATE POLICY authenticated_insert_230 ON public.%I FOR INSERT TO authenticated WITH CHECK (true)',
        v_table_name
      );

      EXECUTE format('DROP POLICY IF EXISTS authenticated_update_230 ON public.%I', v_table_name);
      EXECUTE format(
        'CREATE POLICY authenticated_update_230 ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
        v_table_name
      );

      EXECUTE format('DROP POLICY IF EXISTS authenticated_delete_230 ON public.%I', v_table_name);
      EXECUTE format(
        'CREATE POLICY authenticated_delete_230 ON public.%I FOR DELETE TO authenticated USING (true)',
        v_table_name
      );
    END IF;
  END LOOP;
END $$;
