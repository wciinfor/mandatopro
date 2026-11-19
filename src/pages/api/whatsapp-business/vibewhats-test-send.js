import { createServerClient } from '../../../lib/supabase-server.js';
import { obterUsuarioAutenticado, exigirAdministrador } from '../../../lib/api-auth.js';
import { obterTenantId } from '../../../lib/tenant.js';
import { createVibeWhatsApiService } from '../../../services/vibewhats-api.js';
import { decryptCredential } from '../../../lib/credential-crypto.js';

export const runtime = 'nodejs';

/**
 * POST /api/whatsapp-business/vibewhats-test-send
 * 
 * Envia uma mensagem de teste para verificar a conectividade e capacidade de envio da instância VibeWhats.
 * Estritamente restrito a administradores do tenant.
 * Não altera nem avança status de campanhas ou atendimentos.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  let supabase;
  let usuario;

  try {
    supabase = req.supabaseClient || createServerClient();
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
      return res.status(403).json({ success: false, error: 'Tenant não associado ao usuário autenticado.' });
    }

    const { phone, message } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D+/g, '');

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Informe um número de WhatsApp válido com DDD (ex: 5511999999999).'
      });
    }

    const textToSend = String(message || 'Mensagem de teste de conexão MandatoPRO - VibeWhats API.').trim();

    // Busca a conta VIBEWHATS do tenant
    const { data: contaVibe, error: errConta } = await supabase
      .from('whatsapp_business_accounts')
      .select('id, tenant_id, provider, access_token, access_token_metadata, status')
      .eq('tenant_id', tenantId)
      .eq('provider', 'VIBEWHATS')
      .maybeSingle();

    if (errConta) throw errConta;

    if (!contaVibe) {
      return res.status(404).json({
        success: false,
        error: 'Nenhuma conta VibeWhats configurada para este gabinete.'
      });
    }

    const metadata = typeof contaVibe.access_token_metadata === 'object' && contaVibe.access_token_metadata
      ? contaVibe.access_token_metadata
      : {};

    const instance = metadata.vibewhats_instance || metadata.instance || null;
    const rawToken = contaVibe.access_token || metadata.vibewhats_token || metadata.token || null;
    const token = decryptCredential(rawToken) || rawToken;
    const clientToken = decryptCredential(metadata.vibewhats_client_token) || metadata.vibewhats_client_token || '';

    if (!instance || !token) {
      return res.status(400).json({
        success: false,
        error: 'Instância VibeWhats sem ID ou Token configurados.'
      });
    }

    const vibewhats = createVibeWhatsApiService({
      instance,
      token,
      clientToken,
      baseUrl: metadata.vibewhats_base_url || 'https://api.vibewhats.site'
    });

    const sendResult = await vibewhats.sendText({
      phone: cleanPhone,
      message: textToSend
    });

    return res.status(200).json({
      success: true,
      message: 'Mensagem de teste aceita para envio pela VibeWhats.',
      messageId: sendResult.messageId,
      zaapId: sendResult.zaapId,
      status: 'ACEITA_API',
      nota: 'A confirmação de entrega ao destinatário depende do processamento assíncrono via webhook.'
    });
  } catch (error) {
    console.error('[VIBEWHATS TEST SEND API] Erro ao enviar teste:', error?.message || error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: error?.error || error?.message || 'Falha ao enviar mensagem de teste via VibeWhats',
      provider: 'VIBEWHATS'
    });
  }
}
