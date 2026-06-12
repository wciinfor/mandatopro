-- ═══════════════════════════════════════════════════════════════
-- MIGRAÇÃO FASE 6 — SLA, AUTOMAÇÕES E DASHBOARD OPERACIONAL
-- Execute no Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. SLA POLICIES — Políticas de SLA configuráveis por workspace
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sla_policies (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name                   text        NOT NULL,
  is_default             boolean     NOT NULL DEFAULT false,
  first_response_minutes integer     NOT NULL DEFAULT 60,   -- 1h padrão
  resolution_minutes     integer     NOT NULL DEFAULT 480,  -- 8h padrão
  -- Overrides por prioridade numérica: {"4": {"first_response": 15, "resolution": 60}}
  priority_overrides     jsonb       NOT NULL DEFAULT '{}',
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Garantir apenas uma política padrão por workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_sla_policies_one_default
  ON sla_policies (workspace_id)
  WHERE is_default = true;

ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY sla_policies_workspace ON sla_policies
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ─────────────────────────────────────────────────────────────
-- 2. COLUNAS SLA em conversations
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='conversations' AND column_name='first_response_at') THEN
    ALTER TABLE conversations ADD COLUMN first_response_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='conversations' AND column_name='sla_policy_id') THEN
    ALTER TABLE conversations ADD COLUMN sla_policy_id uuid REFERENCES sla_policies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='conversations' AND column_name='sla_first_response_deadline') THEN
    ALTER TABLE conversations ADD COLUMN sla_first_response_deadline timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='conversations' AND column_name='sla_resolution_deadline') THEN
    ALTER TABLE conversations ADD COLUMN sla_resolution_deadline timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='conversations' AND column_name='sla_first_response_breached') THEN
    ALTER TABLE conversations
      ADD COLUMN sla_first_response_breached boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='conversations' AND column_name='sla_resolution_breached') THEN
    ALTER TABLE conversations
      ADD COLUMN sla_resolution_breached boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 3. AUTOMATION RULES — Regras automáticas de atendimento
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_rules (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  is_active    boolean     NOT NULL DEFAULT true,
  -- Tipos de gatilho disponíveis
  trigger_type text        NOT NULL CHECK (trigger_type IN (
    'conversation_created',
    'conversation_reopened',
    'status_changed',
    'no_response_timeout',
    'sla_breach',
    'first_message',
    'label_added'
  )),
  -- [{field, operator, value}] — todas as condições são AND
  conditions   jsonb       NOT NULL DEFAULT '[]',
  -- [{type, agent_id?, department_id?, label_id?, priority?, status?, message?}]
  actions      jsonb       NOT NULL DEFAULT '[]',
  run_order    integer     NOT NULL DEFAULT 0,
  created_by   uuid        REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY automation_rules_workspace ON automation_rules
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ─────────────────────────────────────────────────────────────
-- 4. AUTOMATION EXECUTIONS — Log de execuções de automações
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_executions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid        NOT NULL,
  rule_id         uuid        NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  conversation_id uuid        NOT NULL,
  triggered_at    timestamptz NOT NULL DEFAULT now(),
  actions_run     jsonb       NOT NULL DEFAULT '[]',
  success         boolean     NOT NULL DEFAULT true,
  error_message   text
);

-- Índice para consulta por conversa (para auditoria)
CREATE INDEX IF NOT EXISTS idx_automation_executions_conv
  ON automation_executions (workspace_id, conversation_id, triggered_at DESC);

ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY automation_executions_workspace ON automation_executions
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ─────────────────────────────────────────────────────────────
-- 5. INBOX ALERTS — Alertas operacionais do inbox
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inbox_alerts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  -- Tipo do alerta
  alert_type      text        NOT NULL CHECK (alert_type IN (
    'sla_first_response_breach',
    'sla_resolution_breach',
    'agent_overloaded',
    'queue_growing',
    'webhook_failing',
    'instance_disconnected'
  )),
  severity        text        NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  title           text        NOT NULL,
  message         text        NOT NULL,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  -- Referências opcionais
  conversation_id uuid,
  agent_id        uuid,
  instance_id     uuid,
  -- Resolução
  resolved        boolean     NOT NULL DEFAULT false,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inbox_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY inbox_alerts_workspace ON inbox_alerts
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ─────────────────────────────────────────────────────────────
-- 6. ÍNDICES DE PERFORMANCE
-- ─────────────────────────────────────────────────────────────

-- SLA: encontrar conversas com deadline próximo (worker check a cada 2min)
CREATE INDEX IF NOT EXISTS idx_conv_sla_fr_deadline
  ON conversations (workspace_id, sla_first_response_deadline)
  WHERE sla_first_response_deadline IS NOT NULL
    AND sla_first_response_breached = false
    AND status NOT IN ('closed','archived');

CREATE INDEX IF NOT EXISTS idx_conv_sla_res_deadline
  ON conversations (workspace_id, sla_resolution_deadline)
  WHERE sla_resolution_deadline IS NOT NULL
    AND sla_resolution_breached = false
    AND status NOT IN ('closed','archived');

-- First response: calcular métricas de tempo
CREATE INDEX IF NOT EXISTS idx_conv_first_response
  ON conversations (workspace_id, first_response_at)
  WHERE first_response_at IS NOT NULL;

-- Auto-atribuição: agentes online com carga de trabalho
CREATE INDEX IF NOT EXISTS idx_conv_assigned_open
  ON conversations (workspace_id, assigned_agent_id, status)
  WHERE status IN ('open','pending','waiting');

-- Automações ativas por trigger
CREATE INDEX IF NOT EXISTS idx_automation_rules_active
  ON automation_rules (workspace_id, trigger_type)
  WHERE is_active = true;

-- Alertas não resolvidos (badge de notificação)
CREATE INDEX IF NOT EXISTS idx_inbox_alerts_unresolved
  ON inbox_alerts (workspace_id, created_at DESC)
  WHERE resolved = false;

-- ─────────────────────────────────────────────────────────────
-- 7. TRIGGERS updated_at
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sla_policies_updated_at') THEN
    CREATE TRIGGER sla_policies_updated_at
      BEFORE UPDATE ON sla_policies
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'automation_rules_updated_at') THEN
    CREATE TRIGGER automation_rules_updated_at
      BEFORE UPDATE ON automation_rules
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 8. REALTIME — Alertas em tempo real para o dashboard
-- ─────────────────────────────────────────────────────────────
ALTER TABLE inbox_alerts    REPLICA IDENTITY FULL;
ALTER TABLE automation_rules REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'inbox_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE inbox_alerts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'automation_rules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE automation_rules;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 9. POLÍTICA SLA PADRÃO para workspaces existentes
-- (Executar após a migração — opcional, não bloqueia a Fase 6)
-- ─────────────────────────────────────────────────────────────
-- INSERT INTO sla_policies (workspace_id, name, is_default, first_response_minutes, resolution_minutes)
-- SELECT id, 'Padrão', true, 60, 480
-- FROM workspaces w
-- WHERE NOT EXISTS (
--   SELECT 1 FROM sla_policies sp WHERE sp.workspace_id = w.id AND sp.is_default = true
-- );
