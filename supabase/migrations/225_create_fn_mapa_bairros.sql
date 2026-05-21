-- =============================================================
-- Função RPC: agrega eleitores por bairro (Belém + Ananindeua)
--
-- Problema resolvido: a API buscava todos os ~255k registros de
-- Belém/Ananindeua para agrupar por bairro em Node.js.
-- Esta função faz o GROUP BY no Postgres, pré-calcula as somas
-- de latitude/longitude e devolve ~200 linhas.
--
-- Execute no Supabase SQL Editor.
-- =============================================================

CREATE OR REPLACE FUNCTION fn_eleitores_agrupados_bairros_belem()
RETURNS TABLE(
  _id_municipio  bigint,
  _cidade        text,
  _bairro        text,
  _total         bigint,
  _lat_soma      float8,
  _lng_soma      float8,
  _total_coord   bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id_municipio                                                            AS _id_municipio,
    cidade::text                                                            AS _cidade,
    bairro::text                                                            AS _bairro,
    COUNT(*)::bigint                                                        AS _total,
    COALESCE(SUM(latitude::float8)
      FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL), 0)    AS _lat_soma,
    COALESCE(SUM(longitude::float8)
      FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL), 0)    AS _lng_soma,
    COUNT(*) FILTER (
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    )::bigint                                                               AS _total_coord
  FROM eleitores
  WHERE
    id_municipio IN (1501402, 1500800)
    OR (id_municipio IS NULL AND (
         cidade ILIKE '%belem%'
      OR cidade ILIKE '%belém%'
      OR cidade ILIKE '%ananindeua%'
    ))
  GROUP BY id_municipio, cidade, bairro
  ORDER BY COUNT(*) DESC;
$$;

GRANT EXECUTE ON FUNCTION fn_eleitores_agrupados_bairros_belem()
  TO anon, authenticated, service_role;
