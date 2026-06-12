-- ============================================================
-- MIGRAÇÃO SUPABASE — FASE 7: Hardening, Performance, Observabilidade
-- ============================================================
--
-- Executar no SQL Editor do Supabase ou via psql antes do deploy.
-- Todos os comandos são idempotentes (IF NOT EXISTS / IF EXISTS).
--
-- Seções:
--   1. Tabela dlq_events        — Dead-Letter Queue persistida
--   2. Índices de performance   — Consultas críticas do inbox
--   3. RLS em dlq_events        — Acesso apenas service_role
--
-- Estimativa de tempo: ~30s em banco vazio, ~5min em banco grande
-- (os índices CONCURRENTLY não bloqueiam leituras/escritas)
-- ============================================================

-- ── 1. TABELA: dlq_events ─────────────────────────────────────
-- Persiste jobs BullMQ que esgotaram todas as tentativas.
-- Permite análise post-mortem e reprocessamento manual.

CREATE TABLE IF NOT EXISTS dlq_events (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  original_queue    text          NOT NULL,
  original_job_id   text,
  original_job_name text          NOT NULL,
  job_data          jsonb,
  failed_reason     text,
  attempts_made     integer,
  failed_at         timestamptz,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  resolved          boolean       NOT NULL DEFAULT false,
  resolved_at       timestamptz,
  resolved_by       uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  notes             text
);

COMMENT ON TABLE dlq_events IS
  'Jobs BullMQ que esgotaram todas as tentativas de reprocessamento (Dead-Letter Queue).';

-- Índice principal para busca por fila e status
CREATE INDEX IF NOT EXISTS idx_dlq_events_queue_resolved
  ON dlq_events (original_queue, resolved, created_at DESC);

-- Índice para monitoramento temporal
CREATE INDEX IF NOT EXISTS idx_dlq_events_created_at
  ON dlq_events (created_at DESC);

-- ── 2. RLS em dlq_events ──────────────────────────────────────
-- Apenas service_role pode ler/escrever (workers + admin interno)

ALTER TABLE dlq_events ENABLE ROW LEVEL SECURITY;

-- Nenhuma política pública: acesso via service_role (bypass RLS)
-- A API usa supabaseAdmin (service_role) para acessar esta tabela.

-- ── 3. ÍNDICES DE PERFORMANCE ────────────────────────────────
-- CONCURRENTLY: não bloqueia escritas durante criação.
-- Pode ser executado em produção sem downtime.

-- Mensagens: consulta principal do inbox (carregar conversa)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conv_created
  ON conversation_messages (conversation_id, created_at DESC);

-- Conversações: listagem por workspace + status (view principal)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_workspace_status
  ON conversations (workspace_id, status);

-- Conversações: filtro por atendente (fila pessoal)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_workspace_assignee
  ON conversations (workspace_id, assigned_agent_id)
  WHERE assigned_agent_id IS NOT NULL;

-- Conversações: SLA check (job recorrente de SLA)
-- Apenas conversas com deadline ativo e não violado
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_sla_deadline
  ON conversations (sla_first_response_deadline)
  WHERE sla_first_response_breached = false
    AND sla_first_response_deadline IS NOT NULL;

-- Conversações: cursor-based pagination (updated_at DESC, id DESC)
-- Usado em listConversations com parâmetro cursor
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_cursor_pagination
  ON conversations (workspace_id, updated_at DESC, id DESC);

-- Alertas inbox: listagem por workspace e status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbox_alerts_workspace_resolved
  ON inbox_alerts (workspace_id, resolved, created_at DESC);

-- Execuções de automação: histórico por conversa
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_executions_conv
  ON automation_executions (conversation_id, triggered_at DESC);

-- Webhook events: auditoria por data e provider
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_events_received
  ON webhook_events (received_at DESC, provider);

-- Webhook events: busca por provider (flood protection audit)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_events_instance
  ON webhook_events (provider, received_at DESC);

-- Contatos: busca por telefone (resolução de contato no webhook)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_phone_workspace
  ON contacts (phone, workspace_id)
  WHERE phone IS NOT NULL;

-- ── 4. VACUUM ANALYZE ─────────────────────────────────────────
-- Atualiza estatísticas do planner após criar índices.
-- Executar após a migração em ambiente com dados reais.

-- ANALYZE messages;
-- ANALYZE conversations;
-- ANALYZE inbox_alerts;
-- ANALYZE webhook_events;
-- ANALYZE contacts;
