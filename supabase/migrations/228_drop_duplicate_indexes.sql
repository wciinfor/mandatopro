-- ============================================================
-- MIGRATION: remover indices duplicados apontados pelo advisors
-- Data: 2026-05-22
--
-- Mantem:
-- - public.idx_eleitores_lideranca em eleitores(lideranca_id)
-- - public.idx_funcionarios_eleitor em funcionarios(eleitor_id)
--
-- Remove os aliases duplicados apontados pelo Supabase advisors.
-- ============================================================

DROP INDEX IF EXISTS public.idx_eleitores_lideranca_id;
DROP INDEX IF EXISTS public.idx_funcionarios_eleitor_id;
