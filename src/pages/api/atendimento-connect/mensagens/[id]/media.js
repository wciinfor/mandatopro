import { Readable } from 'stream';
import { createServerClient } from '../../../../../lib/supabase-server.js';
import { obterUsuarioAutenticado, exigirUsuario } from '../../../../../lib/api-auth.js';
import { exigirAcessoAtendimentoConnect } from '../../../../../lib/atendimento-connect.js';
import { obterTenantId } from '../../../../../lib/tenant.js';
import { resolverContaWhatsappDaConversa } from '../../../../../lib/whatsapp-business-accounts.js';

export const runtime = 'nodejs';

/**
 * Funcao utilitaria para fazer streaming eficiente com suporte a Range requests (HTTP 206)
 */
async function streamRemoteMedia({ sourceUrl, authHeader, req, res, fallbackMimeType, knownFileSize }) {
  const fetchHeaders = {};
  if (authHeader) {
    fetchHeaders.Authorization = authHeader;
  }

  // Propaga o header Range do navegador para o servidor remoto se presente
  const clientRange = req?.headers?.range;
  if (clientRange) {
    fetchHeaders.Range = clientRange;
  }

  const upstreamRes = await fetch(sourceUrl, {
    headers: fetchHeaders
  });

  if (upstreamRes.status === 404 || upstreamRes.status === 410) {
    return res.status(410).json({ success: false, error: 'Arquivo de midia expirado ou removido pelo provedor' });
  }

  if (!upstreamRes.ok && upstreamRes.status !== 206) {
    console.error('[MEDIA STREAM PIPE] Erro ao baixar midia do servidor upstream:', upstreamRes.status);
    return res.status(502).json({ success: false, error: 'Falha ao recuperar binario de midia do provedor' });
  }

  const contentType = upstreamRes.headers.get('content-type') || fallbackMimeType || 'application/octet-stream';
  const contentLength = upstreamRes.headers.get('content-length') || (knownFileSize ? String(knownFileSize) : null);
  const contentRange = upstreamRes.headers.get('content-range');
  const acceptRanges = upstreamRes.headers.get('accept-ranges') || 'bytes';

  // Headers de resposta de streaming seguros
  res.setHeader('Content-Type', contentType);
  res.setHeader('Accept-Ranges', acceptRanges);
  res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache privado de 1h no browser do atendente

  if (contentLength) {
    res.setHeader('Content-Length', contentLength);
  }

  if (upstreamRes.status === 206 && contentRange) {
    res.status(206);
    res.setHeader('Content-Range', contentRange);
  } else {
    res.status(200);
  }

  // Se for apenas requisicao HEAD
  if (req.method === 'HEAD') {
    return res.end();
  }

  // Streaming nativo via Readable stream do Node.js
  if (upstreamRes.body && typeof Readable.fromWeb === 'function' && typeof res.write === 'function' && typeof res.on === 'function') {
    return new Promise((resolve) => {
      const nodeStream = Readable.fromWeb(upstreamRes.body);
      nodeStream.pipe(res);

      nodeStream.on('error', (streamErr) => {
        console.error('[MEDIA STREAM PIPE] Erro no pipe de streaming:', streamErr.message);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Erro durante transmissao do fluxo de midia' });
        }
        resolve();
      });

      res.on('finish', resolve);
      res.on('close', resolve);
    });
  } else {
    const arrayBuf = await upstreamRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuf));
  }
}

/**
 * Endpoint seguro para streaming de midia (audio, imagem, video, documentos) do Atendimento Connect.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ success: false, error: 'Metodo nao permitido' });
  }

  let supabase;
  try {
    supabase = req.supabaseClient || createServerClient();
  } catch (clientErr) {
    console.error('[MEDIA STREAM] Erro ao instanciar cliente Supabase:', clientErr.message);
    return res.status(500).json({ success: false, error: 'Erro de configuracao do servidor' });
  }

  let usuario;
  try {
    const auth = await obterUsuarioAutenticado(req, supabase);
    usuario = auth?.usuario;
    exigirUsuario(usuario);
    exigirAcessoAtendimentoConnect(usuario);
  } catch (authError) {
    const status = authError?.statusCode || 401;
    return res.status(status).json({ success: false, error: authError.message || 'Erro de autenticacao' });
  }

  try {
    const userTenantId = obterTenantId(usuario);
    if (!userTenantId) {
      return res.status(403).json({ success: false, error: 'Tenant do usuario nao identificado' });
    }

    const mensagemId = Number(req.query?.id);
    if (!Number.isFinite(mensagemId) || mensagemId <= 0) {
      return res.status(400).json({ success: false, error: 'ID de mensagem invalido' });
    }

    // 2. Busca da Mensagem e Conversa associada
    const { data: mensagem, error: errMsg } = await supabase
      .from('atendimento_connect_mensagens')
      .select('*, conversa:atendimento_connect_conversas (*)')
      .eq('id', mensagemId)
      .maybeSingle();

    if (errMsg) {
      console.error('[MEDIA STREAM] Erro ao consultar mensagem:', errMsg.message);
      return res.status(500).json({ success: false, error: 'Erro interno ao consultar mensagem' });
    }

    if (!mensagem) {
      return res.status(404).json({ success: false, error: 'Mensagem nao encontrada' });
    }

    const conversa = mensagem.conversa;
    if (!conversa) {
      return res.status(404).json({ success: false, error: 'Conversa da mensagem nao encontrada' });
    }

    // 3. Validacao de Isolamento Multi-tenant
    const conversaTenantId = Number(conversa.tenant_id || conversa.metadata?.tenant_id || 0);
    if (conversaTenantId > 0 && conversaTenantId !== userTenantId) {
      console.warn(`[MEDIA STREAM] Tentativa de acesso cross-tenant bloqueada: User tenant=${userTenantId}, Conv tenant=${conversaTenantId}`);
      return res.status(403).json({ success: false, error: 'Acesso negado: mensagem pertence a outro gabinete' });
    }

    // 4. Deteccao flexivel do Tipo de Midia e Identificadores (compativel com mensagens historicas)
    const rawPayload = typeof mensagem.raw_payload === 'object' && mensagem.raw_payload ? mensagem.raw_payload : {};
    
    // Extracao do media_id (prioritariamente do raw_payload para META)
    const mediaId = mensagem.media_id 
      || rawPayload.media_id 
      || rawPayload.audio?.id 
      || rawPayload.image?.id 
      || rawPayload.video?.id 
      || rawPayload.document?.id 
      || null;

    // Extracao da URL direta (caso WAFLY ou similar)
    const directMediaUrl = mensagem.media_url 
      || rawPayload.media_url 
      || rawPayload.audio_url 
      || rawPayload.audio?.audioUrl 
      || rawPayload.image_url 
      || rawPayload.image?.imageUrl 
      || rawPayload.video_url 
      || rawPayload.video?.videoUrl 
      || rawPayload.document_url 
      || rawPayload.document?.documentUrl 
      || null;

    // Deteccao do tipo de midia (audio, image, video, document)
    let mediaTipo = mensagem.media_tipo 
      || rawPayload.mensagem_tipo 
      || (rawPayload.audio ? 'audio' : null)
      || (rawPayload.image ? 'image' : null)
      || (rawPayload.video ? 'video' : null)
      || (rawPayload.document ? 'document' : null);

    // Fallback textual para mensagens historicas antigas
    if (!mediaTipo && typeof mensagem.mensagem === 'string') {
      if (mensagem.mensagem.startsWith('[Audio') || mensagem.mensagem.startsWith('[Áudio')) mediaTipo = 'audio';
      else if (mensagem.mensagem.startsWith('[Imagem')) mediaTipo = 'image';
      else if (mensagem.mensagem.startsWith('[Video') || mensagem.mensagem.startsWith('[Vídeo')) mediaTipo = 'video';
      else if (mensagem.mensagem.startsWith('[Documento')) mediaTipo = 'document';
    }

    if (!mediaId && !directMediaUrl) {
      return res.status(404).json({ success: false, error: 'Nenhuma midia ou identificador encontrado nesta mensagem' });
    }

    // MIME type preferencial
    const mimePreferencial = rawPayload.mime_type 
      || rawPayload.audio?.mime_type 
      || rawPayload.image?.mime_type 
      || (mediaTipo === 'audio' ? 'audio/ogg' : null);

    // ─── 5. PROVIDER WAFLY (Se houver directMediaUrl) ───────────────────────────
    if (directMediaUrl) {
      return await streamRemoteMedia({
        sourceUrl: directMediaUrl,
        authHeader: null,
        req,
        res,
        fallbackMimeType: mimePreferencial || 'application/octet-stream'
      });
    }

    // ─── 6. PROVIDER META (WhatsApp Cloud API via media_id) ──────────────────────
    if (mediaId) {
      // 6.1 Resolve a conta WhatsApp correta usando a funcao canonica do projeto
      const { conta: contaResolvida } = await resolverContaWhatsappDaConversa(supabase, conversa, usuario);
      const accessToken = contaResolvida?.access_token || null;

      if (!accessToken) {
        console.error('[MEDIA STREAM] Conta WhatsApp da conversa nao possui access_token valido');
        return res.status(503).json({ success: false, error: 'Provedor WhatsApp nao configurado para este gabinete' });
      }

      // Validacao adicional de tenant da conta resolvida
      if (contaResolvida.tenant_id && Number(contaResolvida.tenant_id) !== userTenantId) {
        return res.status(403).json({ success: false, error: 'Acesso negado: conta pertence a outro gabinete' });
      }

      // 6.2 Consulta os metadados da midia na Meta Graph API
      const graphVersion = process.env.META_GRAPH_VERSION || 'v21.0';
      const metaGraphUrl = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(mediaId)}`;

      let metaMetadata = null;
      try {
        const metaRes = await fetch(metaGraphUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json'
          }
        });

        if (metaRes.status === 404 || metaRes.status === 410) {
          return res.status(410).json({ success: false, error: 'Midia nao esta mais disponivel ou expirou nos servidores do WhatsApp' });
        }

        if (!metaRes.ok) {
          const errBody = await metaRes.json().catch(() => ({}));
          console.error('[MEDIA STREAM] Erro ao consultar midia na Meta Graph API:', metaRes.status, errBody);
          return res.status(502).json({ success: false, error: 'Falha na comunicacao com o provedor WhatsApp' });
        }

        metaMetadata = await metaRes.json();
      } catch (errGraph) {
        console.error('[MEDIA STREAM] Falha de rede ao consultar Meta Graph API:', errGraph.message);
        return res.status(502).json({ success: false, error: 'Falha de conexao com os servidores do WhatsApp' });
      }

      const downloadUrl = metaMetadata?.url;
      if (!downloadUrl) {
        return res.status(404).json({ success: false, error: 'URL da midia nao retornada pelo provedor' });
      }

      const mimeTypeFinal = metaMetadata.mime_type || mimePreferencial || 'application/octet-stream';

      // 6.3 Fazer streaming do binario diretamente da Meta (lookaside) para o navegador
      return await streamRemoteMedia({
        sourceUrl: downloadUrl,
        authHeader: `Bearer ${accessToken}`,
        req,
        res,
        fallbackMimeType: mimeTypeFinal,
        knownFileSize: metaMetadata.file_size ? Number(metaMetadata.file_size) : null
      });
    }

    return res.status(404).json({ success: false, error: 'Formato de midia nao suportado' });

  } catch (err) {
    console.error('[MEDIA STREAM] Erro inesperado:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, error: err.message || 'Erro interno no processamento de midia' });
  }
}
