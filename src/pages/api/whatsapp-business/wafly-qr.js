import { createServerClient } from '../../../lib/supabase-server.js';
import { obterUsuarioAutenticado, exigirAdministrador } from '../../../lib/api-auth.js';
import { obterTenantId } from '../../../lib/tenant.js';
import { createWaflyApiService } from '../../../services/wafly-api.js';

export const runtime = 'nodejs';

/**
 * GET /api/whatsapp-business/wafly-qr
 * 
 * Obtém o QR Code atual para conexão do WhatsApp da instância WAFLY do tenant autenticado.
 * Estritamente seguro: credenciais nunca saem do backend.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
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

    // Busca a conta WAFLY do tenant atual
    const { data: contaWafly, error: errConta } = await supabase
      .from('whatsapp_business_accounts')
      .select('id, tenant_id, provider, access_token, access_token_metadata, status')
      .eq('tenant_id', tenantId)
      .eq('provider', 'WAFLY')
      .maybeSingle();

    if (errConta) throw errConta;

    if (!contaWafly) {
      return res.status(404).json({
        success: false,
        configured: false,
        error: 'Nenhuma conta WAFLY configurada para este gabinete. Preencha as credenciais da instância primeiro.'
      });
    }

    const metadata = typeof contaWafly.access_token_metadata === 'object' && contaWafly.access_token_metadata
      ? contaWafly.access_token_metadata
      : {};

    const clientToken = metadata.wafly_client_token || metadata.client_token || null;
    const instance = metadata.wafly_instance || metadata.instance || null;
    const token = contaWafly.access_token || metadata.wafly_token || metadata.token || null;

    if (!clientToken || !instance || !token) {
      return res.status(400).json({
        success: false,
        configured: false,
        error: 'Instância WAFLY incompleta. Configure o Client Token, ID da Instância e Token da Instância.'
      });
    }

    const waflyApi = createWaflyApiService({
      clientToken,
      instance,
      token
    });

    const qrResult = await waflyApi.getQrCode();

    return res.status(200).json({
      success: true,
      configured: true,
      qrCode: qrResult.qrCode,
      instance
    });
  } catch (error) {
    console.error('[WAFLY QR API] Erro ao obter QR Code:', error?.error || error?.message || error);
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: error?.error || error?.message || 'Falha ao obter QR Code da WAFLY. Tente novamente em instantes.'
    });
  }
}
