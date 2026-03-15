-- ============================================================
-- MIGRAÇÃO 205: MÓDULO DOCUMENTOS + SUPABASE STORAGE
-- ============================================================
-- Execute este script no SQL Editor do Supabase.
-- Ele cria a tabela documentos, índices, trigger de updated_at,
-- RLS policies e o bucket de Storage com suas políticas.
-- ============================================================

-- ============================================================
-- 1. TABELA DE DOCUMENTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS documentos (
  id              BIGSERIAL PRIMARY KEY,
  titulo          VARCHAR(255) NOT NULL,
  descricao       TEXT,
  tipo            VARCHAR(100) NOT NULL
                    CHECK (tipo IN (
                      'ARTE_CAMPANHA',
                      'TREINAMENTO',
                      'MODELO_GRUPO',
                      'CONTRATO',
                      'PARECER'
                    )),
  caminho_arquivo VARCHAR(500),          -- path dentro do bucket Storage
  url_arquivo     VARCHAR(1000),         -- URL pública / assinada (cache)
  tamanho_bytes   BIGINT,
  mime_type       VARCHAR(100),
  criado_por_id   BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  data_upload     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_expiracao  DATE,
  publico         BOOLEAN DEFAULT false,
  downloads       INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_documentos_tipo
  ON documentos(tipo);

CREATE INDEX IF NOT EXISTS idx_documentos_criado_por
  ON documentos(criado_por_id);

CREATE INDEX IF NOT EXISTS idx_documentos_data_upload
  ON documentos(data_upload DESC);

CREATE INDEX IF NOT EXISTS idx_documentos_publico
  ON documentos(publico);

CREATE INDEX IF NOT EXISTS idx_documentos_titulo
  ON documentos USING gin(to_tsvector('portuguese', titulo));

-- ============================================================
-- 3. TRIGGER: atualiza updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION fn_documentos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documentos_updated_at ON documentos;
CREATE TRIGGER trg_documentos_updated_at
  BEFORE UPDATE ON documentos
  FOR EACH ROW EXECUTE FUNCTION fn_documentos_updated_at();

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

-- Leitura: todos podem ver (autenticados via service_role ou público)
CREATE POLICY "documentos_select_all" ON documentos
  FOR SELECT USING (true);

-- Inserção: requer usuário autenticado
CREATE POLICY "documentos_insert_authenticated" ON documentos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Atualização: requer usuário autenticado
CREATE POLICY "documentos_update_authenticated" ON documentos
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Exclusão: requer usuário autenticado
CREATE POLICY "documentos_delete_authenticated" ON documentos
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 5. SUPABASE STORAGE — BUCKET "documentos"
-- ============================================================
-- O bucket é PRIVADO (public = false).
-- Os arquivos são acessados via URL assinada gerada pela API.
-- Limite: 50 MB por arquivo.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos',
  'documentos',
  false,
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'application/zip',
    'application/x-rar-compressed',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit  = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- 6. POLÍTICAS DO STORAGE
-- ============================================================

-- Upload: qualquer usuário autenticado pode fazer upload
CREATE POLICY "documentos_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documentos');

-- Leitura: qualquer usuário autenticado pode ler (para signed URL funcionar)
CREATE POLICY "documentos_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documentos');

-- Exclusão: qualquer usuário autenticado pode deletar
CREATE POLICY "documentos_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documentos');

-- Atualização (upsert): qualquer usuário autenticado pode sobrepor arquivo
CREATE POLICY "documentos_storage_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documentos')
  WITH CHECK (bucket_id = 'documentos');

-- ============================================================
-- 7. FUNÇÃO: incrementar contador de downloads
-- ============================================================
CREATE OR REPLACE FUNCTION fn_incrementar_download(p_documento_id BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE documentos
  SET downloads = downloads + 1
  WHERE id = p_documento_id;
END;
$$;

-- ============================================================
-- FIM DA MIGRAÇÃO 205
-- ============================================================
