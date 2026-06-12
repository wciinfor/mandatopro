-- ============================================================
-- DISPARO PRO — MIGRATION FASE 3 INBOX
-- Data: 2026-05-08
-- Executar no Supabase Dashboard → SQL Editor
-- Seguro para re-execução (IF NOT EXISTS / OR REPLACE)
-- ============================================================


-- ============================================================
-- 1. EXTENSÕES NECESSÁRIAS (full-text search + trigram)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- busca por similaridade/parcial
CREATE EXTENSION IF NOT EXISTS "unaccent";       -- busca sem acentos


-- ============================================================
-- 2. COLUNAS NOVAS EM conversation_messages
-- ============================================================

-- Fase 1/2 — podem já existir em ambiente de desenvolvimento
ALTER TABLE public.conversation_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID
      REFERENCES public.conversation_messages(id) ON DELETE SET NULL;

ALTER TABLE public.conversation_messages
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.conversation_messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Coluna de busca full-text (tsvector gerado automaticamente)
ALTER TABLE public.conversation_messages
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
      GENERATED ALWAYS AS (
          to_tsvector('portuguese', coalesce(message, ''))
      ) STORED;


-- ============================================================
-- 3. COLUNAS NOVAS EM conversations
-- ============================================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS unread_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS waiting_at TIMESTAMPTZ;

-- Coluna de busca full-text sobre nome do contato (join precisa de trigger)
-- Por simplicidade usamos índice trigram em contacts.name em vez de tsvector


-- ============================================================
-- 4. TABELA: labels (catálogo de etiquetas do workspace)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.labels (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name         TEXT        NOT NULL,
    color        TEXT        NOT NULL DEFAULT '#6366f1',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, name)
);

-- ============================================================
-- 5. TABELA: conversation_label_map (relação N:N conversa ↔ label)
-- ============================================================
-- Substitui a coluna "label TEXT" da tabela conversation_labels existente
-- para suportar múltiplas labels por conversa via FK tipada.
-- A tabela conversation_labels existente é mantida para compatibilidade.
CREATE TABLE IF NOT EXISTS public.conversation_label_map (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    conversation_id UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    label_id        UUID        NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
    created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (conversation_id, label_id)
);

-- ============================================================
-- 6. TABELA: quick_replies (respostas rápidas do workspace)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quick_replies (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    shortcut     TEXT        NOT NULL,         -- ex: /saudacao
    title        TEXT        NOT NULL,         -- ex: Saudação inicial
    body         TEXT        NOT NULL,         -- corpo da mensagem
    category     TEXT,                         -- agrupamento opcional
    is_active    BOOLEAN     NOT NULL DEFAULT true,
    created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, shortcut)
);


-- ============================================================
-- 7. CONSTRAINT ÚNICA DE IDEMPOTÊNCIA (inbox webhook)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_msg_provider
    ON public.conversation_messages(workspace_id, provider_message_id)
    WHERE provider_message_id IS NOT NULL;


-- ============================================================
-- 8. ÍNDICES DE DESEMPENHO
-- ============================================================

-- Full-text search em mensagens
CREATE INDEX IF NOT EXISTS idx_conv_msg_search
    ON public.conversation_messages USING GIN(search_vector);

-- Busca trigram em contacts.name e contacts.phone
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm
    ON public.contacts USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm
    ON public.contacts USING GIN(phone gin_trgm_ops);

-- Labels
CREATE INDEX IF NOT EXISTS idx_label_map_conversation
    ON public.conversation_label_map(conversation_id);
CREATE INDEX IF NOT EXISTS idx_label_map_workspace
    ON public.conversation_label_map(workspace_id);
CREATE INDEX IF NOT EXISTS idx_label_map_label
    ON public.conversation_label_map(label_id);

-- Quick replies
CREATE INDEX IF NOT EXISTS idx_quick_replies_workspace
    ON public.quick_replies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_quick_replies_shortcut
    ON public.quick_replies(workspace_id, shortcut);

-- Conversas: filtros frequentes
CREATE INDEX IF NOT EXISTS idx_conversations_instance
    ON public.conversations(workspace_id, instance_id);
CREATE INDEX IF NOT EXISTS idx_conversations_unread
    ON public.conversations(workspace_id, unread_count)
    WHERE unread_count > 0;
-- Fase 3 review: departmentId sem índice → full-scan sem este
CREATE INDEX IF NOT EXISTS idx_conversations_department
    ON public.conversations(workspace_id, department_id)
    WHERE department_id IS NOT NULL;

-- reply_to
CREATE INDEX IF NOT EXISTS idx_conv_msg_reply_to
    ON public.conversation_messages(reply_to_message_id)
    WHERE reply_to_message_id IS NOT NULL;


-- ============================================================
-- 9. RPC: increment_unread_count
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_unread_count(
    p_conversation_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.conversations
    SET unread_count   = unread_count + 1,
        last_message_at = NOW()
    WHERE id = p_conversation_id;
END;
$$;


-- ============================================================
-- 10. RLS — Habilitar nas novas tabelas
-- ============================================================
ALTER TABLE public.labels                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_label_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_replies          ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 11. POLÍTICAS RLS
-- ============================================================

-- labels: membros do workspace leem; agentes+ criam; admins+ deletam
CREATE POLICY labels_select ON public.labels
    FOR SELECT TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND is_active = true
    ));

CREATE POLICY labels_insert ON public.labels
    FOR INSERT TO authenticated
    WITH CHECK (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND is_active = true
          AND role IN ('owner','admin','agent')
    ));

CREATE POLICY labels_update ON public.labels
    FOR UPDATE TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND is_active = true
          AND role IN ('owner','admin')
    ));

CREATE POLICY labels_delete ON public.labels
    FOR DELETE TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND is_active = true
          AND role IN ('owner','admin')
    ));

-- conversation_label_map: agentes+ do workspace podem associar/desassociar
CREATE POLICY clm_select ON public.conversation_label_map
    FOR SELECT TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND is_active = true
    ));

CREATE POLICY clm_insert ON public.conversation_label_map
    FOR INSERT TO authenticated
    WITH CHECK (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND is_active = true
          AND role IN ('owner','admin','agent')
    ));

CREATE POLICY clm_delete ON public.conversation_label_map
    FOR DELETE TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND is_active = true
          AND role IN ('owner','admin','agent')
    ));

-- quick_replies: membros leem; agentes+ criam/editam; admins deletam
CREATE POLICY qr_select ON public.quick_replies
    FOR SELECT TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND is_active = true
    ));

CREATE POLICY qr_insert ON public.quick_replies
    FOR INSERT TO authenticated
    WITH CHECK (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND is_active = true
          AND role IN ('owner','admin','agent')
    ));

CREATE POLICY qr_update ON public.quick_replies
    FOR UPDATE TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND is_active = true
          AND role IN ('owner','admin','agent')
    ));

CREATE POLICY qr_delete ON public.quick_replies
    FOR DELETE TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND is_active = true
          AND role IN ('owner','admin')
    ));


-- ============================================================
-- 12. REALTIME — publicar novas tabelas
-- ============================================================
ALTER TABLE public.labels                 REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_label_map REPLICA IDENTITY FULL;
ALTER TABLE public.quick_replies          REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime
    ADD TABLE public.conversations,
              public.conversation_messages,
              public.labels,
              public.conversation_label_map,
              public.quick_replies;
