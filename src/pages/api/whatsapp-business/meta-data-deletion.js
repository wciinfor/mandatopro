import crypto from 'crypto';
import { createServerClient } from '@/lib/supabase-server';
import { parseAndVerifyMetaSignedRequest } from '@/lib/meta-signed-request';

export const runtime = 'nodejs';

/**
 * Meta Data Deletion Request Callback URL
 * POST /api/whatsapp-business/meta-data-deletion
 *
 * Recebe a solicitação de exclusão de dados enviada pela Meta quando um usuário
 * solicita a remoção de seus dados através do Facebook/Instagram/WhatsApp.
 *
 * Resposta oficial exigida pela Meta:
 * {
 *   "url": "https://<dominio>/exclusao-de-dados?code=<confirmation_code>",
 *   "confirmation_code": "<code_unico>"
 * }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.warn('[META DATA DELETION] META_APP_SECRET nao configurado no servidor');
    return res.status(500).json({ error: 'Configuracao de segredo ausente' });
  }

  const signedRequest = req.body?.signed_request;
  if (!signedRequest) {
    return res.status(400).json({ error: 'signed_request obrigatorio' });
  }

  const payload = parseAndVerifyMetaSignedRequest(signedRequest, appSecret);
  if (!payload) {
    return res.status(400).json({ error: 'signed_request invalido ou assinatura incorreta' });
  }

  const metaUserId = payload.user_id || payload.user?.id || 'anonymous';
  const confirmationCode = `DEL-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://mandatopro.vercel.app';
  const statusUrl = `${siteUrl.replace(/\/+$/, '')}/exclusao-de-dados?code=${confirmationCode}`;

  try {
    const supabase = createServerClient();

    // Registra evento de auditoria com rastreabilidade na tabela oficial logs_auditoria
    await supabase.from('logs_auditoria').insert({
      acao: 'META_DATA_DELETION_REQUEST',
      modulo: 'WHATSAPP_BUSINESS',
      descricao: `Solicitação de exclusão de dados via Meta registrada. Protocolo: ${confirmationCode}`,
      status: 'SUCESSO',
      dados_novos: {
        meta_user_id: metaUserId,
        confirmation_code: confirmationCode,
        status_url: statusUrl,
        issued_at: payload.issued_at ? new Date(payload.issued_at * 1000).toISOString() : new Date().toISOString(),
        app_id: payload.app_id || null
      }
    }).catch((err) => {
      console.warn('[META DATA DELETION] Aviso ao persistir log:', err?.message);
    });

    // Formato exato e oficial esperado pela Meta
    return res.status(200).json({
      url: statusUrl,
      confirmation_code: confirmationCode
    });
  } catch (error) {
    console.error('[META DATA DELETION] Erro ao processar:', error);
    return res.status(500).json({ error: 'Erro interno ao processar solicitacao de exclusao' });
  }
}

