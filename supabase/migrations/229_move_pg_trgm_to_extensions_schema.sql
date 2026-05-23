-- ============================================================
-- MIGRATION: mover extensao pg_trgm para schema de extensoes
-- Data: 2026-05-22
--
-- Resolve o advisor "Extension in Public" sem recriar indices.
-- Os indices que usam gin_trgm_ops permanecem vinculados aos objetos
-- da extensao por OID.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS extensions;

ALTER EXTENSION pg_trgm SET SCHEMA extensions;
