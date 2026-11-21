import { createServerClient } from '../../../lib/supabase-server.js';
import { obterUsuarioAutenticado, exigirAdministrador } from '../../../lib/api-auth.js';
import { obterTenantId } from '../../../lib/tenant.js';
import { createVibeWhatsApiService } from '../../../services/vibewhats-api.js';
import { decryptCredential } from '../../../lib/credential-crypto.js';

export const runtime = 'nodejs';

/**
 * POST /api/whatsapp-business/vibewhats-disconnect
 * 
 * Desconecta a sessão de WhatsApp da instância VIBEWHATS do tenant autenticado.
 * - Restrito exclusivamente ao administrador do tenant.
 * - Chama o endpoint oficial de desconexão da VibeWhats / Z-API (/disconnect).
 * - Atualiza o status no banco de dados para 'DESCONECTADO' sem excluir credenciais nem a integração.
 * - Remove telefone conectado para impedir novos envios até reconexão.
 * - Estritamente isolado por tenant e seguro contra vazamento de credenciais.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido. Utilize POST.' });
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

    // Busca a conta VIBEWHATS do tenant
    const { data: contaVibe, error: errConta } = await supabase
      .from('whatsapp_business_accounts')
      .select(`
        id,
        tenant_id,
        provider,
        access_token,
        access_token_metadata,
        status,
        principal,
        whatsapp_business_numbers (*)
      `)
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

    // Executa desconexão na API remota VibeWhats (Z-API)
    let disconnectResult;
    try {
      disconnectResult = await vibewhats.disconnect();
    } catch (apiErr) {
      console.warn('[VIBEWHATS DISCONNECT API] Erro ao chamar endpoint remoto de desconexão:', apiErr?.message || apiErr);
      // Se a sessão já estava desconectada ou erro 400/404, prossegue com a atualização local defensiva
      disconnectResult = { success: true, disconnected: true, note: 'sessão remota já desconectada ou inacessível' };
    }

    const agora = new Date().toISOString();

    // 1. Atualiza status dos números vinculados da conta VibeWhats para 'DESCONECTADO'
    await supabase
      .from('whatsapp_business_numbers')
      .update({
        status: 'DESCONECTADO',
        updated_at: agora
      })
      .eq('account_id', contaVibe.id)
      .eq('tenant_id', tenantId);

    // 2. Atualiza a conta de WhatsApp preservando estritamente credenciais e tokens, apenas marcando status
    await supabase
      .from('whatsapp_business_accounts')
      .update({
        status: 'DESCONECTADO',
        access_token_metadata: {
          ...metadata,
          connected_phone: null,
          disconnected_at: agora,
          last_status_check: agora
        },
        updated_at: agora
      })
      .eq('id', contaVibe.id)
      .eq('tenant_id', tenantId);

    return res.status(200).json({
      success: true,
      message: 'Instância VibeWhats desconectada com sucesso. O WhatsApp precisará ser reconectado via QR Code para novos envios.',
      provider: 'VIBEWHATS',
      status: 'DESCONECTADO',
      disconnected: true
    });
  } catch (error) {
    console.error('[VIBEWHATS DISCONNECT API] Erro ao processar desconexão:', error?.message || error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: error?.error || error?.message || 'Falha ao desconectar instância VibeWhats',
      provider: 'VIBEWHATS'
    });
  }
}
