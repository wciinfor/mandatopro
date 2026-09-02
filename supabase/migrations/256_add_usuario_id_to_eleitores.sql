-- =============================================================
-- Migration 256: Adicionar rastreabilidade de autoria em Eleitores
--
-- 1. Adicionar coluna usuario_id (BIGINT NULL REFERENCES public.usuarios(id))
-- 2. Criar índice B-Tree em usuario_id para consultas e rankings
-- =============================================================

ALTER TABLE public.eleitores
ADD COLUMN IF NOT EXISTS usuario_id BIGINT NULL REFERENCES public.usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_eleitores_usuario_id ON public.eleitores(usuario_id);

COMMENT ON COLUMN public.eleitores.usuario_id IS 'ID do usuário autenticado responsável pelo cadastro do eleitor';
