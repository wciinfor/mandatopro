-- =============================================================
-- Função RPC: Agrupa contagem de eleitores cadastrados por dia
--
-- Problema resolvido: A API trazia milhares de linhas criadas
-- e era truncada no limite de 1.000 registros do PostgREST.
-- Esta função realiza o COUNT(*) GROUP BY diretamente no Postgres
-- no fuso horário 'America/Belem' (UTC-3), retornando apenas ~15 linhas.
-- =============================================================

CREATE OR REPLACE FUNCTION fn_eleitores_cadastrados_por_dia(
  p_inicio timestamptz,
  p_fim timestamptz
)
RETURNS TABLE(
  _data text,
  _total bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    to_char(created_at AT TIME ZONE 'America/Belem', 'YYYY-MM-DD') AS _data,
    COUNT(*)::bigint AS _total
  FROM eleitores
  WHERE created_at >= p_inicio AND created_at <= p_fim
  GROUP BY to_char(created_at AT TIME ZONE 'America/Belem', 'YYYY-MM-DD')
  ORDER BY _data ASC;
$$;

GRANT EXECUTE ON FUNCTION fn_eleitores_cadastrados_por_dia(timestamptz, timestamptz)
  TO anon, authenticated, service_role;
