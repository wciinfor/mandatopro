import { createServerClient } from '../../../lib/supabase-server.js';
import { obterUsuarioAutenticado, exigirAdministrador } from '../../../lib/api-auth.js';
import { obterTenantId } from '../../../lib/tenant.js';
import {
  buscarContaWhatsappPrincipal,
  normalizarWhatsappAccount,
  salvarContaWhatsappPrincipal,
  salvarContaWhatsappWafly,
  salvarContaWhatsappWaBlast,
  salvarContaWhatsappYCloud,
  alterarProvedorWhatsappAtivo
} from '../../../lib/whatsapp-business-accounts.js';

/**
 * API para consultar e alternar a configuração dos provedores WhatsApp (META, YCLOUD, WABLAST, WAFLY) por tenant.
 */
export default async function handler(req, res) {
  let supabase;
  let usuario;

  try {
    supabase = req.supabaseClient || createServerClient();
    const auth = await obterUsuarioAutenticado(req, supabase);
    usuario = auth.usuario;
    exigirAdministrador(usuario);
  } catch (error) {
    const status = error?.statusCode || 401;
    return res.status(status).json({ error: error.message || 'Erro de autenticacao' });
  }

  if (req.method === 'GET') {
    try {
      const tenantId = obterTenantId(usuario);
      if (!tenantId) {
        return res.status(403).json({ success: false, error: 'Tenant não associado ao usuário autenticado.' });
      }

      const conta = await buscarContaWhatsappPrincipal(supabase, usuario);
      const contaNormalizada = normalizarWhatsappAccount(conta);

      const { data: todasContas } = await supabase
        .from('whatsapp_business_accounts')
        .select(`
          id,
          provider,
          wablast_account_id,
          wablast_waba_id,
          token_debug_metadata,
          access_token,
          access_token_metadata,
          phone_number_id,
          principal,
          status,
          ycloud_api_key,
          whatsapp_business_numbers (phone_number_id, display_phone_number, verified_name, status)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'ATIVO');

      const contaWablastRaw = (todasContas || []).find(c => c.provider === 'WABLAST');
      const numWablast = contaWablastRaw?.whatsapp_business_numbers?.find(n => n.status !== 'INATIVO' && n.phone_number_id) || contaWablastRaw?.whatsapp_business_numbers?.[0];
      const isWablastConnected = Boolean(contaWablastRaw?.wablast_account_id && numWablast?.phone_number_id);

      const isMetaConnected = (todasContas || []).some(c => c.provider === 'META' && Boolean(c.access_token));
      const isYCloudConnected = (todasContas || []).some(c => c.provider === 'YCLOUD' && Boolean(c.ycloud_api_key));

      // 1. Identificar se existe conta ativa/configurada com provider = 'WAFLY' para o tenant atual
      const contaWaflyRaw = (todasContas || []).find(c => c.provider === 'WAFLY');
      const waflyMeta = typeof contaWaflyRaw?.access_token_metadata === 'object' && contaWaflyRaw.access_token_metadata
        ? contaWaflyRaw.access_token_metadata
        : {};

      const waflyInstance = contaWaflyRaw?.phone_number_id || waflyMeta.wafly_instance || waflyMeta.instance || null;
      const waflyToken = contaWaflyRaw?.access_token || waflyMeta.wafly_token || waflyMeta.token || null;

      const numWafly = contaWaflyRaw?.whatsapp_business_numbers?.find(n => n.status !== 'INATIVO' && (n.display_phone_number || n.phone_number_id))
        || contaWaflyRaw?.whatsapp_business_numbers?.[0];
      const waflyPhone = numWafly?.display_phone_number || numWafly?.phone_number_id || waflyMeta.connected_phone || null;

      // 2. Calcular isWaflyConnected: instance válida + token válido + número WhatsApp vinculado/ativo
      const isWaflyConnected = Boolean(waflyInstance && waflyToken && waflyPhone);

      // Resposta estritamente segura sem expor tokens ou API Keys
      return res.status(200).json({
        success: true,
        provider: contaNormalizada.provider || 'META',
        status: contaNormalizada.status || 'INATIVO',
        displayPhoneNumber: contaNormalizada.displayPhoneNumber || '',
        displayName: contaNormalizada.displayName || '',
        phoneNumberId: contaNormalizada.phoneNumberId || '',
        isConfigured: contaNormalizada.isConfigured || false,
        productionReady: contaNormalizada.productionReady || false,
        isConnected: contaNormalizada.isConnected || false,
        availableProviders: {
          META: isMetaConnected,
          YCLOUD: isYCloudConnected,
          WABLAST: isWablastConnected,
          WAFLY: isWaflyConnected
        },
        wablastDetails: {
          connected: isWablastConnected,
          accountId: contaWablastRaw?.wablast_account_id || null,
          wabaId: contaWablastRaw?.wablast_waba_id || contaWablastRaw?.waba_id || null,
          phoneNumber: numWablast?.display_phone_number || numWablast?.phone_number_id || null,
          verifiedName: numWablast?.verified_name || null
        },
        waflyDetails: {
          configured: Boolean(waflyInstance && waflyToken),
          connected: isWaflyConnected,
          instance: waflyInstance,
          phoneNumber: waflyPhone,
          status: contaWaflyRaw?.status || (isWaflyConnected ? 'ATIVO' : 'INATIVO'),
          principal: Boolean(contaWaflyRaw?.principal)
        }
      });
    } catch (error) {
      console.error('[CONFIG API] Erro ao obter status:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      // 1. Se for salvar credenciais manuais WAFLY
      const hasWaflyPayload = Boolean(
        req.body.waflyClientToken ||
        req.body.clientToken ||
        req.body.client_token ||
        req.body.waflyInstance ||
        (String(req.body.provider || req.body.targetProvider || '').toUpperCase() === 'WAFLY' &&
          (req.body.token || req.body.instanceToken || req.body.instance_token || req.body.instance || req.body.instanceId || req.body.connectedPhone || req.body.displayPhoneNumber))
      );

      if (hasWaflyPayload) {
        const resWafly = await salvarContaWhatsappWafly(supabase, usuario, req.body);
        return res.status(200).json({
          success: true,
          message: 'Configuração WAFLY salva com sucesso',
          account: resWafly.account,
          number: resWafly.number
        });
      }

      // 2. Se for salvar credenciais manuais WaBlast
      if (req.body.wablastAccountId || req.body.wablast_account_id) {
        const conta = await salvarContaWhatsappWaBlast(supabase, usuario, req.body);
        const contaNormalizada = normalizarWhatsappAccount(conta);
        return res.status(200).json({
          success: true,
          message: 'Configuração WaBlast salva com sucesso',
          account: {
            provider: contaNormalizada.provider,
            displayPhoneNumber: contaNormalizada.displayPhoneNumber,
            phoneNumberId: contaNormalizada.phoneNumberId,
            wablastAccountId: contaNormalizada.wablastAccountId,
            wabaId: contaNormalizada.wabaId
          }
        });
      }

      // 3. Se for salvar credenciais manuais YCloud
      if (req.body.ycloudApiKey || req.body.ycloud_api_key) {
        const conta = await salvarContaWhatsappYCloud(supabase, usuario, req.body);
        const contaNormalizada = normalizarWhatsappAccount(conta);
        return res.status(200).json({
          success: true,
          message: 'Configuração YCloud salva com sucesso',
          account: {
            provider: contaNormalizada.provider,
            displayPhoneNumber: contaNormalizada.displayPhoneNumber,
            phoneNumberId: contaNormalizada.phoneNumberId
          }
        });
      }

      // 4. Se for apenas alternar o provedor ativo (META / YCLOUD / WABLAST / WAFLY)
      const providerParam = req.body.provider || req.body.targetProvider;
      if (providerParam) {
        const targetProvider = String(providerParam).toUpperCase();
        if (!['META', 'YCLOUD', 'WABLAST', 'WAFLY'].includes(targetProvider)) {
          return res.status(400).json({
            success: false,
            error: 'Provedor invalido. Escolha META, YCLOUD, WABLAST ou WAFLY'
          });
        }

        const contaAtualizada = await alterarProvedorWhatsappAtivo(supabase, usuario, targetProvider);
        const contaNormalizada = normalizarWhatsappAccount(contaAtualizada);

        return res.status(200).json({
          success: true,
          message: `Provedor alterado com sucesso para ${targetProvider}`,
          provider: contaNormalizada.provider,
          displayPhoneNumber: contaNormalizada.displayPhoneNumber,
          isConfigured: contaNormalizada.isConfigured,
          productionReady: contaNormalizada.productionReady
        });
      }

      // 5. Fluxo legado standard para salvar credenciais da Meta Cloud API
      const { phoneNumberId, accessToken } = req.body;
      const contaAtual = await buscarContaWhatsappPrincipal(supabase, usuario);
      const tokenDisponivel = String(accessToken || '').trim() || contaAtual?.access_token || '';

      if (!phoneNumberId || !tokenDisponivel) {
        return res.status(400).json({
          error: 'Phone Number ID e Access Token sao obrigatorios'
        });
      }

      const conta = await salvarContaWhatsappPrincipal(supabase, usuario, req.body);
      const contaNormalizada = normalizarWhatsappAccount(conta);

      const { default: WhatsAppBusinessService } = await import('../../../services/whatsapp-business.js');
      const whatsapp = new WhatsAppBusinessService();
      const configured = whatsapp.updateConfig(contaNormalizada.phoneNumberId, tokenDisponivel);

      if (configured) {
        try {
          const info = await whatsapp.getPhoneInfo();
          return res.status(200).json({
            success: true,
            configured: true,
            phoneInfo: info,
            account: {
              provider: contaNormalizada.provider,
              displayPhoneNumber: contaNormalizada.displayPhoneNumber,
              phoneNumberId: contaNormalizada.phoneNumberId
            }
          });
        } catch (testError) {
          return res.status(400).json({
            success: false,
            error: 'Configuracao salva mas falhou no teste: ' + testError.message
          });
        }
      }

      return res.status(400).json({
        success: false,
        error: 'Configuracao invalida'
      });
    } catch (error) {
      console.error('[CONFIG API] Erro ao alterar configuracao:', error);
      return res.status(error?.statusCode || 500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}
