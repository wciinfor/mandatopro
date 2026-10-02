import { createServerClient } from '../../../lib/supabase-server.js';
import { obterUsuarioAutenticado, exigirAdministrador } from '../../../lib/api-auth.js';
import { obterTenantId } from '../../../lib/tenant.js';
import { createWaflyApiService } from '../../../services/wafly-api.js';

export const runtime = 'nodejs';

/**
 * GET /api/whatsapp-business/wafly-status
 * 
 * Consulta o status da conexão da instância WAFLY do tenant em tempo real.
 * Atualiza os registros do banco de dados quando detecta conexão bem-sucedida.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
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
      .eq('provider', 'WAFLY')
      .maybeSingle();

    if (errConta) throw errConta;

    if (!contaWafly) {
      return res.status(404).json({
        success: false,
        configured: false,
        connected: false,
        error: 'Nenhuma conta WAFLY cadastrada para este gabinete.'
      });
    }

    const metadata = typeof contaWafly.access_token_metadata === 'object' && contaWafly.access_token_metadata
      ? contaWafly.access_token_metadata
      : {};

    const clientToken = metadata.wafly_client_token || metadata.client_token || null;
    const instance = metadata.wafly_instance || metadata.instance || null;
    const token = contaWafly.access_token || metadata.wafly_token || metadata.token || null;

    if (!clientToken || !instance || !token) {
      return res.status(200).json({
        success: true,
        configured: false,
        connected: false,
        status: 'NAO_CONFIGURADO'
      });
    }

    const waflyApi = createWaflyApiService({
      clientToken,
      instance,
      token
    });

    const statusResult = await waflyApi.getStatus();
    const isConnected = Boolean(statusResult.connected);

    // Telefone conectado identificado pela API ou salvo na metadata
    const phoneRaw = statusResult.phone || metadata.connected_phone || metadata.phone || null;
    const cleanPhone = phoneRaw ? String(phoneRaw).replace(/\D+/g, '') : null;

    // Se estiver conectado, sincroniza e atualiza os registros do tenant no Supabase
    if (isConnected) {
      await supabase
        .from('whatsapp_business_accounts')
        .update({
          status: 'ATIVO',
          token_validated: true,
          phone_validated: true,
          production_ready: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', contaWafly.id)
        .eq('tenant_id', tenantId);

      if (cleanPhone) {
        const numerosAtuais = Array.isArray(contaWafly.whatsapp_business_numbers)
          ? contaWafly.whatsapp_business_numbers
          : [];
        const numeroExistente = numerosAtuais.find(n => n.status !== 'INATIVO') || numerosAtuais[0] || null;

        const numPayload = {
          tenant_id: tenantId,
          account_id: contaWafly.id,
          phone_number_id: cleanPhone,
          display_phone_number: cleanPhone,
          display_name: 'Wafly WhatsApp',
          status: 'ATIVO',
          principal: true,
          updated_at: new Date().toISOString()
        };

        if (numeroExistente?.id) {
          await supabase
            .from('whatsapp_business_numbers')
            .update(numPayload)
            .eq('id', numeroExistente.id)
            .eq('tenant_id', tenantId);
        } else {
          await supabase
            .from('whatsapp_business_numbers')
            .insert(numPayload);
        }
      }
    }

    return res.status(200).json({
      success: true,
      configured: true,
      connected: isConnected,
      phone: cleanPhone,
      status: isConnected ? 'ATIVO' : 'DESCONECTADO',
      instance
    });
  } catch (error) {
    console.error('[WAFLY STATUS API] Erro ao consultar status:', error?.error || error?.message || error);
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      connected: false,
      error: error?.error || error?.message || 'Falha ao consultar status da WAFLY.'
    });
  }
}
