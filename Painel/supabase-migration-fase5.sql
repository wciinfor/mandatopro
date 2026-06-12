-- ══════════════════════════════════════════════════════════════
-- MIGRAÇÃO FASE 5 — IA Assistiva do Inbox Multiatendente
-- Rodar no Supabase SQL Editor (uma vez, idempotente)
-- ══════════════════════════════════════════════════════════════

-- ── 1. TIPOS ENUMERADOS ──────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE conversation_category AS ENUM (
    'vendas', 'suporte', 'financeiro', 'cancelamento', 'reclamacao', 'spam', 'outros'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ai_priority AS ENUM ('baixa', 'media', 'alta', 'urgente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ai_sentiment AS ENUM ('positivo', 'neutro', 'negativo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ai_analysis_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. TABELA conversation_ai_analysis ──────────────────────

CREATE TABLE IF NOT EXISTS conversation_ai_analysis (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id     UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  -- Status do processamento assíncrono
  status              ai_analysis_status NOT NULL DEFAULT 'pending',
  error_message       TEXT,

  -- Classificação
  category            conversation_category,
  category_confidence NUMERIC(4,3),  -- 0.000 a 1.000

  -- Prioridade
  priority            ai_priority,
  priority_reason     TEXT,

  -- Resumo
  summary             TEXT,          -- resumo curto
  key_points          TEXT[],        -- últimos pontos importantes
  next_action         TEXT,          -- próxima ação sugerida

  -- Intenção e sentimento
  main_intent         TEXT,
  sentiment           ai_sentiment,
  sentiment_score     NUMERIC(4,3),  -- -1.000 a 1.000

  -- Lead Score
  lead_score          SMALLINT CHECK (lead_score >= 0 AND lead_score <= 100),
  lead_score_reason   TEXT,

  -- Sugestões de resposta (até 3)
  suggestions         TEXT[],        -- array com até 3 sugestões

  -- Metadados de processamento
  model_used          TEXT,          -- ex: "gpt-4o-mini"
  messages_analyzed   INT,           -- quantas mensagens foram usadas
  analyzed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Só um registro ativo por conversa (upsert via conversation_id)
  CONSTRAINT uq_conv_ai_analysis UNIQUE (workspace_id, conversation_id)
);

-- ── 3. ÍNDICES ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ai_analysis_workspace
  ON conversation_ai_analysis (workspace_id);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_conversation
  ON conversation_ai_analysis (conversation_id);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_status
  ON conversation_ai_analysis (status)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_ai_analysis_category
  ON conversation_ai_analysis (workspace_id, category)
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_analysis_priority
  ON conversation_ai_analysis (workspace_id, priority)
  WHERE priority IS NOT NULL;

-- ── 4. TRIGGER updated_at ────────────────────────────────────

CREATE OR REPLACE FUNCTION update_ai_analysis_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_analysis_updated_at ON conversation_ai_analysis;
CREATE TRIGGER trg_ai_analysis_updated_at
  BEFORE UPDATE ON conversation_ai_analysis
  FOR EACH ROW EXECUTE FUNCTION update_ai_analysis_updated_at();

-- ── 5. RLS ───────────────────────────────────────────────────

ALTER TABLE conversation_ai_analysis ENABLE ROW LEVEL SECURITY;

-- Backend usa service_role (ignora RLS).
-- Policies para acesso authenticated direto (segurança extra):

DROP POLICY IF EXISTS "ai_analysis_workspace_isolation" ON conversation_ai_analysis;
CREATE POLICY "ai_analysis_workspace_isolation"
  ON conversation_ai_analysis
  FOR ALL
  USING (
    workspace_id IN (
      SELECT aw.workspace_id
      FROM agent_workspaces aw
      WHERE aw.user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT aw.workspace_id
      FROM agent_workspaces aw
      WHERE aw.user_id = auth.uid()
    )
  );

-- ── 6. REALTIME ──────────────────────────────────────────────

ALTER TABLE conversation_ai_analysis REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'conversation_ai_analysis'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversation_ai_analysis;
  END IF;
END $$;

-- ── 7. COLUNA ai_analysis_id em conversations (referência rápida) ──

DO $$ BEGIN
  ALTER TABLE conversations
    ADD COLUMN ai_category  conversation_category,
    ADD COLUMN ai_priority  ai_priority,
    ADD COLUMN ai_sentiment ai_sentiment,
    ADD COLUMN lead_score   SMALLINT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ── FIM ──────────────────────────────────────────────────────
