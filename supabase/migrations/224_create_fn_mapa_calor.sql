-- =============================================================
-- Função RPC: agrega eleitores por município para o mapa de calor
--
-- Problema resolvido: a API buscava todos os 300k+ registros em
-- páginas de 1000, somando ~315 round-trips ao Supabase.
-- Esta função faz o GROUP BY no Postgres e devolve ~200 linhas.
--
-- Execute no Supabase SQL Editor.
-- =============================================================

CREATE OR REPLACE FUNCTION fn_eleitores_agrupados_municipio()
RETURNS TABLE(
  _id_municipio  bigint,
  _cidade        text,
  _estado        text,
  _total         bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id_municipio          AS _id_municipio,
    cidade::text          AS _cidade,
    estado::text          AS _estado,
    COUNT(*)::bigint      AS _total
  FROM eleitores
  GROUP BY id_municipio, cidade, estado
  ORDER BY COUNT(*) DESC;
$$;

GRANT EXECUTE ON FUNCTION fn_eleitores_agrupados_municipio()
  TO anon, authenticated, service_role;
