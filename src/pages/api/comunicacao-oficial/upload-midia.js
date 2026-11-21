import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import { obterTenantId } from '@/lib/tenant';

export const runtime = 'nodejs';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '30mb', // 30MB para suportar imagens e vídeos otimizados
    },
  },
};

const BUCKET_NAME = 'midias_campanha';

const FORMATOS_PERMITIDOS = {
  // Imagens (aceita extensões e variações comuns)
  'image/jpeg': { ext: 'jpg', tipo: 'imagem', maxBytes: 15 * 1024 * 1024 },
  'image/jpg': { ext: 'jpg', tipo: 'imagem', maxBytes: 15 * 1024 * 1024 },
  'image/pjpeg': { ext: 'jpg', tipo: 'imagem', maxBytes: 15 * 1024 * 1024 },
  'image/png': { ext: 'png', tipo: 'imagem', maxBytes: 15 * 1024 * 1024 },
  'image/x-png': { ext: 'png', tipo: 'imagem', maxBytes: 15 * 1024 * 1024 },
  'image/webp': { ext: 'webp', tipo: 'imagem', maxBytes: 15 * 1024 * 1024 },
  // Vídeos
  'video/mp4': { ext: 'mp4', tipo: 'video', maxBytes: 25 * 1024 * 1024 },
  'video/quicktime': { ext: 'mov', tipo: 'video', maxBytes: 25 * 1024 * 1024 },
  'video/webm': { ext: 'webm', tipo: 'video', maxBytes: 25 * 1024 * 1024 },
};

/**
 * Normaliza o tipo de mídia para forma canônica ('imagem' ou 'video')
 * Aceita sinônimos em inglês ('image' -> 'imagem') e português ('vídeo' -> 'video')
 */
function normalizarTipoMidia(tipo) {
  if (!tipo) return null;
  const t = String(tipo).trim().toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // remove acentos ('vídeo' -> 'video')

  if (t === 'image' || t === 'imagem' || t === 'img') return 'imagem';
  if (t === 'video' || t === 'vid') return 'video';
  return t;
}

/**
 * POST /api/comunicacao-oficial/upload-midia
 * 
 * Upload seguro de mídia para disparos (imagens e vídeos).
 * - Armazenamento em bucket privado com acesso assinado controlado (signed URL).
 * - Isolamento estrito por tenant: {tenant_id}/campanhas/{uuid}.{ext}
 * - Validação rigorosa de MIME type e limite de tamanho.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  let supabase;
  let usuario;

  try {
    supabase = createServerClient();
    const auth = await obterUsuarioAutenticado(req, supabase);
    usuario = auth.usuario;
    exigirAdministrador(usuario);
  } catch (error) {
    const status = error?.statusCode || 401;
    return res.status(status).json({ success: false, error: error.message || 'Não autorizado' });
  }

  try {
    const tenantId = obterTenantId(usuario);
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'Tenant não associado ao usuário.' });
    }

    const { arquivo_base64, arquivo_nome, mime_type, tipo_solicitado } = req.body || {};

    if (!arquivo_base64 || !arquivo_nome || !mime_type) {
      return res.status(400).json({
        success: false,
        error: 'Arquivo base64, nome e mime_type são obrigatórios.'
      });
    }

    const formatoConfig = FORMATOS_PERMITIDOS[mime_type.toLowerCase()];
    if (!formatoConfig) {
      return res.status(400).json({
        success: false,
        error: `Formato de arquivo "${mime_type}" não permitido. Formatos aceitos: JPEG, PNG, WEBP e MP4.`
      });
    }

    const tipoSolicitadoNorm = normalizarTipoMidia(tipo_solicitado);
    const tipoArquivoNorm = normalizarTipoMidia(formatoConfig.tipo);

    if (tipoSolicitadoNorm && tipoSolicitadoNorm !== tipoArquivoNorm) {
      const rotuloArquivo = tipoArquivoNorm === 'imagem' ? 'Imagem' : 'Vídeo';
      const rotuloSolicitado = tipoSolicitadoNorm === 'imagem' ? 'Imagem' : 'Vídeo';
      return res.status(400).json({
        success: false,
        error: `O arquivo enviado (${rotuloArquivo}) não corresponde ao tipo selecionado (${rotuloSolicitado}).`
      });
    }

    const buffer = Buffer.from(arquivo_base64, 'base64');

    if (buffer.length > formatoConfig.maxBytes) {
      const maxMb = Math.round(formatoConfig.maxBytes / (1024 * 1024));
      return res.status(400).json({
        success: false,
        error: `Arquivo excede o limite máximo permitido de ${maxMb}MB para ${formatoConfig.tipo}.`
      });
    }

    // Garante que o bucket privado existe
    const { data: buckets } = await supabase.storage.listBuckets();
    const existeBucket = (buckets || []).some(b => b.name === BUCKET_NAME || b.id === BUCKET_NAME);
    if (!existeBucket) {
      await supabase.storage.createBucket(BUCKET_NAME, { public: false });
    }

    // Caminho isolado por tenant
    const idArquivo = crypto.randomUUID();
    const storagePath = `tenant_${tenantId}/campanhas/${idArquivo}.${formatoConfig.ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: mime_type,
        upsert: false
      });

    if (uploadError) {
      console.error('[UPLOAD MIDIA] Erro storage:', uploadError);
      throw uploadError;
    }

    // Gera URL assinada com validade de 7 dias (604800 segundos) para download pelas APIs parceiras
    const { data: signedData, error: signError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 604800);

    if (signError || !signedData?.signedUrl) {
      await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
      throw signError || new Error('Não foi possível gerar URL assinada para a mídia.');
    }

    const tamanhoFormatado = buffer.length >= 1024 * 1024
      ? `${(buffer.length / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.ceil(buffer.length / 1024)} KB`;

    return res.status(201).json({
      success: true,
      data: {
        storage_path: storagePath,
        bucket: BUCKET_NAME,
        url_assinada: signedData.signedUrl,
        tipo: formatoConfig.tipo,
        mime_type,
        nome_original: arquivo_nome,
        tamanho: tamanhoFormatado,
        bytes: buffer.length
      }
    });
  } catch (error) {
    console.error('[UPLOAD MIDIA] Erro no processamento:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Falha ao processar upload de mídia'
    });
  }
}
