-- ══════════════════════════════════════════════════════════════
-- INBOX MULTIATENDENTE — MIGRAÇÃO FASE 4: MÍDIA E CONTEÚDO RICO
--
-- Pré-requisito: supabase-migration-fase3.sql aplicado
-- Autor: Disparo Pro
-- ══════════════════════════════════════════════════════════════

-- ── 1. TABELA media_attachments ────────────────────────────────
-- Persiste metadados de cada arquivo enviado/recebido.
-- Os arquivos em si ficam no Supabase Storage (bucket inbox-media).

CREATE TABLE IF NOT EXISTS media_attachments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id  UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id       UUID        REFERENCES conversation_messages(id) ON DELETE SET NULL,
  media_type       TEXT        NOT NULL CHECK (media_type IN ('image','video','audio','document')),
  filename         TEXT        NOT NULL,
  mime_type        TEXT        NOT NULL,
  size_bytes       BIGINT      NOT NULL CHECK (size_bytes > 0),
  storage_path     TEXT        NOT NULL,   -- caminho relativo dentro do bucket
  duration_seconds INTEGER     NULL,       -- áudio/vídeo
  width            INTEGER     NULL,       -- imagem/vídeo
  height           INTEGER     NULL,       -- imagem/vídeo
  created_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. COLUNAS EM conversation_messages ───────────────────────
-- media_attachment_id: FK opcional para media_attachments
-- (media_type e media_url já existem na tabela desde o schema inicial,
--  mas garantimos aqui caso não existam)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversation_messages'
      AND column_name = 'media_attachment_id'
  ) THEN
    ALTER TABLE conversation_messages
      ADD COLUMN media_attachment_id UUID REFERENCES media_attachments(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversation_messages'
      AND column_name = 'media_type'
  ) THEN
    ALTER TABLE conversation_messages
      ADD COLUMN media_type TEXT CHECK (media_type IN ('image','video','audio','document'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversation_messages'
      AND column_name = 'media_url'
  ) THEN
    ALTER TABLE conversation_messages
      ADD COLUMN media_url TEXT;
  END IF;
END $$;

-- ── 3. ÍNDICES ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_media_attachments_workspace
  ON media_attachments (workspace_id);

CREATE INDEX IF NOT EXISTS idx_media_attachments_conversation
  ON media_attachments (conversation_id);

CREATE INDEX IF NOT EXISTS idx_media_attachments_message
  ON media_attachments (message_id)
  WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_messages_media_attachment
  ON conversation_messages (media_attachment_id)
  WHERE media_attachment_id IS NOT NULL;

-- ── 4. RLS — TABELA media_attachments ─────────────────────────

ALTER TABLE media_attachments ENABLE ROW LEVEL SECURITY;

-- Service-role (backend) ignora RLS → as policies abaixo são para
-- clientes Supabase autenticados (frontend direto via anon key,
-- caso necessário no futuro). A API sempre usa supabaseAdmin.

CREATE POLICY "workspace_isolation_media_attachments"
  ON media_attachments
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

-- ── 5. SUPABASE STORAGE — bucket inbox-media ──────────────────
-- Criado como privado (public = false).
-- Acesso sempre via URL assinada gerada pelo backend (signed URL).
-- NÃO habilitar acesso público — arquivos sensíveis.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inbox-media',
  'inbox-media',
  false,
  52428800, -- 50 MB (maior entre os tipos; validação fina feita no backend)
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/webm','video/ogg',
    'audio/mpeg','audio/ogg','audio/wav','audio/mp4','audio/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 6. STORAGE POLICIES — inbox-media ─────────────────────────
-- O backend usa service_role (ignora RLS).
-- Policies abaixo protegem acesso anon/authenticated caso seja necessário.

-- Nenhum acesso público ao bucket (objetos privados por padrão).
-- A policy explícita abaixo impede SELECT sem autenticação:

CREATE POLICY "deny_public_select_inbox_media"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'inbox-media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT aw.workspace_id::TEXT
      FROM agent_workspaces aw
      WHERE aw.user_id = auth.uid()
    )
  );

CREATE POLICY "allow_authenticated_insert_inbox_media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'inbox-media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT aw.workspace_id::TEXT
      FROM agent_workspaces aw
      WHERE aw.user_id = auth.uid()
    )
  );

CREATE POLICY "allow_authenticated_delete_inbox_media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'inbox-media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT aw.workspace_id::TEXT
      FROM agent_workspaces aw
      WHERE aw.user_id = auth.uid()
    )
  );

-- ── 7. REPLICA IDENTITY para Realtime ─────────────────────────

ALTER TABLE media_attachments REPLICA IDENTITY FULL;

-- ── 8. PUBLICAÇÃO no canal Realtime ───────────────────────────
-- Adiciona media_attachments ao publication do Supabase Realtime
-- somente se ainda não estiver publicada.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'media_attachments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE media_attachments;
  END IF;
END $$;
