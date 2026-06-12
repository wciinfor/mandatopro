import { supabaseAdmin }   from '../../config/supabase';
import { logger }           from '../../utils/logger';
import { ValidationException } from '../../utils/errors';
import { MediaType }        from './inbox.types';

// ──────────────────────────────────────────────────────────────
// INBOX STORAGE
//
// Wrapper para o Supabase Storage (bucket inbox-media).
// Toda operação de arquivo passa por aqui — nunca acesse o bucket
// diretamente de outros módulos.
//
// Estrutura de paths no bucket:
//   {workspaceId}/{conversationId}/{uuid}.{ext}
//
// Segurança:
//   • Filename sanitizado (slugify) para evitar path traversal
//   • Mime validado pelo content-type + magic bytes dos primeiros 12B
//   • Tamanho limitado por tipo ANTES do upload
//   • Signed URLs com TTL curto (nunca URL pública permanente)
// ──────────────────────────────────────────────────────────────

export const BUCKET_NAME = 'inbox-media';

export const ALLOWED_MIME_TYPES: Record<MediaType, string[]> = {
  image:    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video:    ['video/mp4', 'video/webm', 'video/ogg'],
  audio:    ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/webm'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
};

export const MAX_BYTES: Record<MediaType, number> = {
  image:    10 * 1024 * 1024,  // 10 MB
  video:    50 * 1024 * 1024,  // 50 MB
  audio:    16 * 1024 * 1024,  // 16 MB
  document: 20 * 1024 * 1024,  // 20 MB
};

/** TTL para URL inline (renderização) */
export const SIGNED_URL_TTL_RENDER   = 60;   // segundos
/** TTL para URL de download de documento */
export const SIGNED_URL_TTL_DOWNLOAD = 300;  // segundos

// ── Mapa de magic bytes para detecção de tipo real ────────────
// Verifica os primeiros bytes do buffer para detectar o tipo real,
// impedindo bypass via extensão/content-type falso.

interface MagicEntry {
  bytes:  number[];
  offset: number;
}

const MAGIC_MAP: Record<string, MagicEntry> = {
  'image/jpeg': { bytes: [0xFF, 0xD8, 0xFF], offset: 0 },
  'image/png':  { bytes: [0x89, 0x50, 0x4E, 0x47], offset: 0 },
  'image/gif':  { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0 },
  'image/webp': { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
  'video/mp4':  { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  'application/pdf': { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0 },
  // Para tipos sem magic bytes confiáveis (audio/*, video/webm, docx, xlsx),
  // a validação se baseia no mime-type declarado + allowlist rígida abaixo.
};

// ── Tipos permitidos sem magic bytes (confiamos no content-type da
//    requisição multpart, que o @fastify/multipart lê do cabeçalho
//    do campo file). A allowlist já é bastante restritiva.
const MIME_NO_MAGIC_CHECK = new Set([
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/webm',
  'video/webm', 'video/ogg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

// ── Extensões seguras por mime type ──────────────────────────

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg':   'jpg',
  'image/png':    'png',
  'image/webp':   'webp',
  'image/gif':    'gif',
  'video/mp4':    'mp4',
  'video/webm':   'webm',
  'video/ogg':    'ogv',
  'audio/mpeg':   'mp3',
  'audio/ogg':    'ogg',
  'audio/wav':    'wav',
  'audio/mp4':    'm4a',
  'audio/webm':   'weba',
  'application/pdf':    'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

// ── Helpers ───────────────────────────────────────────────────

/** Remove caracteres perigosos do nome do arquivo. */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^\w\s.\-]/g, '')     // remove chars não-word exceto . e -
    .replace(/\s+/g, '_')           // espaços → underscore
    .replace(/\.{2,}/g, '.')        // sequência de pontos → único ponto
    .replace(/^[.\-]+/, '')         // remove pontos/hífens no início
    .slice(0, 200)                   // limite de comprimento
    || 'file';
}

/** Resolve o MediaType a partir de um mime type declarado. */
export function resolveMediaType(mimeType: string): MediaType | null {
  for (const [type, mimes] of Object.entries(ALLOWED_MIME_TYPES) as [MediaType, string[]][]) {
    if (mimes.includes(mimeType)) return type;
  }
  return null;
}

/**
 * Valida buffer contra magic bytes para tipos com assinatura conhecida.
 * Retorna false se o conteúdo não bater com o mime informado.
 */
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const magic = MAGIC_MAP[mimeType];
  if (!magic) {
    // Sem magic bytes → depende do allowlist de MIME_NO_MAGIC_CHECK
    return MIME_NO_MAGIC_CHECK.has(mimeType);
  }
  const { bytes, offset } = magic;
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buffer[offset + i] === b);
}

// ── Operações de storage ──────────────────────────────────────

export interface UploadResult {
  storagePath: string;
  publicUrl:   string | null;  // sempre null (bucket privado)
}

/**
 * Valida e faz upload de um arquivo para o bucket inbox-media.
 * @throws ValidationException se tipo ou tamanho inválidos.
 */
export async function uploadToStorage(
  workspaceId:    string,
  conversationId: string,
  buffer:         Buffer,
  originalName:   string,
  mimeType:       string,
): Promise<UploadResult & { mediaType: MediaType; safeFilename: string }> {
  // 1. Resolver tipo de mídia
  const mediaType = resolveMediaType(mimeType);
  if (!mediaType) {
    throw new ValidationException({ file: [`Tipo de arquivo não permitido: ${mimeType}`] });
  }

  // 2. Validar tamanho
  if (buffer.length > MAX_BYTES[mediaType]) {
    const limitMB = MAX_BYTES[mediaType] / (1024 * 1024);
    throw new ValidationException({ file: [`Arquivo excede o limite de ${limitMB} MB para ${mediaType}`] });
  }

  // 3. Validar magic bytes (anti-bypass de extensão)
  if (!validateMagicBytes(buffer, mimeType)) {
    throw new ValidationException({ file: ['Conteúdo do arquivo não corresponde ao tipo declarado'] });
  }

  // 4. Gerar path seguro no bucket
  const safeFilename  = sanitizeFilename(originalName);
  const ext           = MIME_TO_EXT[mimeType] ?? safeFilename.split('.').pop() ?? 'bin';
  const uniqueName    = `${crypto.randomUUID()}.${ext}`;
  const storagePath   = `${workspaceId}/${conversationId}/${uniqueName}`;

  // 5. Upload para Supabase Storage
  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType:  mimeType,
      upsert:       false,
      cacheControl: '3600',
    });

  if (error) {
    logger.error({ storagePath, error }, 'InboxStorage: falha ao fazer upload');
    throw new Error(`Falha ao salvar arquivo no storage: ${error.message}`);
  }

  logger.info(
    { storagePath, mimeType, sizeKB: Math.ceil(buffer.length / 1024) },
    'InboxStorage: upload concluído',
  );

  return { storagePath, publicUrl: null, mediaType, safeFilename };
}

/**
 * Gera URL assinada temporária para um objeto no bucket.
 * @param storagePath  Caminho relativo dentro do bucket (sem o nome do bucket).
 * @param ttlSeconds   Validade em segundos.
 */
export async function getSignedUrl(storagePath: string, ttlSeconds = SIGNED_URL_TTL_RENDER): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, ttlSeconds);

  if (error || !data?.signedUrl) {
    logger.error({ storagePath, error }, 'InboxStorage: falha ao gerar signed URL');
    throw new Error('Falha ao gerar URL de acesso ao arquivo');
  }

  return data.signedUrl;
}

/**
 * Remove um objeto do bucket.
 * Erros são apenas logados — não lança exceção (para não bloquear fluxo de exclusão).
 */
export async function deleteFromStorage(storagePath: string): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) {
    logger.warn({ storagePath, error }, 'InboxStorage: falha ao deletar objeto');
  }
}

// ── Download remoto (para mídia inbound do Evolution) ─────────

/**
 * Baixa conteúdo de uma URL remota e retorna como Buffer.
 * Limita o tamanho para MAX_BYTES.image (mais restritivo) × 5 como teto.
 * @throws Error se a URL retornar status diferente de 2xx ou o body for muito grande.
 */
export async function downloadRemoteMedia(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const MAX_REMOTE = 50 * 1024 * 1024; // 50 MB teto absoluto

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    throw new Error(`Falha ao baixar mídia remota: HTTP ${res.status}`);
  }

  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  const mimeType    = contentType.split(';')[0].trim();

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_REMOTE) {
    throw new Error(`Arquivo remoto excede o limite (${MAX_REMOTE / (1024 * 1024)} MB)`);
  }

  return { buffer: Buffer.from(arrayBuffer), mimeType };
}
