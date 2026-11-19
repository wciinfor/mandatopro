import { createServerClient } from '../../../lib/supabase-server.js';
import { obterUsuarioAutenticado, exigirAdministrador } from '../../../lib/api-auth.js';
import { obterTenantId } from '../../../lib/tenant.js';
import { createVibeWhatsApiService } from '../../../services/vibewhats-api.js';
import { decryptCredential } from '../../../lib/credential-crypto.js';

export const runtime = 'nodejs';

/**
 * GET /api/whatsapp-business/vibewhats-status
 * 
 * Consulta o status da conexão da instância VIBEWHATS do tenant em tempo real.
 * Atualiza o banco de dados quando detecta conexão bem-sucedida.
 * Estritamente isolado por tenant e seguro contra vazamento de credenciais.
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

    // Busca a conta VIBEWHATS do tenant atual
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
        error: 'Nenhuma conta VibeWhats configurada para este gabinete.',
        connected: false
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
        error: 'Instância VibeWhats sem ID ou Token configurados.',
        connected: false
      });
    }

    const vibewhats = createVibeWhatsApiService({
      instance,
      token,
      clientToken,
      baseUrl: metadata.vibewhats_base_url || 'https://api.vibewhats.site'
    });

    const statusResult = await vibewhats.getStatus();
    const isConnected = statusResult.connected;
    const phone = statusResult.phone;

    // Se estiver conectado e tiver telefone, atualiza o banco se necessário
    if (isConnected && phone) {
      const cleanPhone = String(phone).replace(/\D+/g, '');
      const numerosAtuais = Array.isArray(contaVibe.whatsapp_business_numbers)
        ? contaVibe.whatsapp_business_numbers
        : [];
      const numExistente = numerosAtuais.find(n => n.status !== 'INATIVO') || numerosAtuais[0];

      if (!numExistente || numExistente.display_phone_number !== cleanPhone) {
        const payloadNum = {
          tenant_id: tenantId,
          account_id: contaVibe.id,
          phone_number_id: instance,
          display_phone_number: cleanPhone,
          display_name: 'VibeWhats WhatsApp',
          status: 'ATIVO',
          principal: true,
          updated_at: new Date().toISOString()
        };

        if (numExistente?.id) {
          await supabase
            .from('whatsapp_business_numbers')
            .update(payloadNum)
            .eq('id', numExistente.id)
            .eq('tenant_id', tenantId);
        } else {
          await supabase
            .from('whatsapp_business_numbers')
            .insert(payloadNum);
        }

        // Atualiza metadata na conta
        await supabase
          .from('whatsapp_business_accounts')
          .update({
            access_token_metadata: {
              ...metadata,
              connected_phone: cleanPhone,
              last_status_check: new Date().toISOString()
            },
            status: 'ATIVO',
            updated_at: new Date().toISOString()
          })
          .eq('id', contaVibe.id)
          .eq('tenant_id', tenantId);
      }
    }

    return res.status(200).json({
      success: true,
      connected: isConnected,
      status: statusResult.status,
      phone: phone || metadata.connected_phone || null,
      instance: instance,
      provider: 'VIBEWHATS'
    });
  } catch (error) {
    console.error('[VIBEWHATS STATUS API] Erro ao consultar status:', error?.message || error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: error?.error || error?.message || 'Falha ao consultar status na VibeWhats',
      connected: false,
      provider: 'VIBEWHATS'
    });
  }
}
