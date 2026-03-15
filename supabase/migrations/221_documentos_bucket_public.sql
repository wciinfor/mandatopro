-- Torna o bucket "documentos" público para que arquivos sejam
-- acessíveis via URL direta sem autenticação.
-- Necessário para exibir miniaturas de imagens no card e para
-- que links de download funcionem sem signed URL.

UPDATE storage.buckets
SET public = true
WHERE id = 'documentos';

-- Remove a policy de SELECT no storage (não é necessária para bucket público)
DROP POLICY IF EXISTS "documentos_storage_select" ON storage.objects;

-- Recria politica permissiva de leitura pública
CREATE POLICY "documentos_storage_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'documentos');
