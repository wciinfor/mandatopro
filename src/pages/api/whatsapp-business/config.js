import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import { obterTenantId } from '@/lib/tenant';
import {
  buscarContaWhatsappPrincipal,
  normalizarWhatsappAccount,
  salvarContaWhatsappPrincipal,
  alterarProvedorWhatsappAtivo
} from '@/lib/whatsapp-business-accounts';

/**
 * API para consultar e alternar a configuracao do provedor WhatsApp (META ou YCLOUD) por tenant.
 */
export default async function handler(req, res) {
  let supabase;
  let usuario;

  try {
    supabase = createServerClient();
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
          ycloud_api_key,
          whatsapp_business_numbers (phone_number_id, display_phone_number, verified_name, status)
        `)
        .eq('tenant_id', tenantId || contaNormalizada.tenantId || 1)
        .eq('status', 'ATIVO');

      const contaWablastRaw = (todasContas || []).find(c => c.provider === 'WABLAST');
      const numWablast = contaWablastRaw?.whatsapp_business_numbers?.find(n => n.status !== 'INATIVO' && n.phone_number_id) || contaWablastRaw?.whatsapp_business_numbers?.[0];
      const isWablastConnected = Boolean(contaWablastRaw?.wablast_account_id && numWablast?.phone_number_id);

      const isMetaConnected = (todasContas || []).some(c => c.provider === 'META' && Boolean(c.access_token));
      const isYCloudConnected = (todasContas || []).some(c => c.provider === 'YCLOUD' && Boolean(c.ycloud_api_key));

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
          WABLAST: isWablastConnected
        },
        wablastDetails: {
          connected: isWablastConnected,
          accountId: contaWablastRaw?.wablast_account_id || null,
          wabaId: contaWablastRaw?.wablast_waba_id || contaWablastRaw?.waba_id || null,
          phoneNumber: numWablast?.display_phone_number || numWablast?.phone_number_id || null,
          verifiedName: numWablast?.verified_name || null
        }
      });
    } catch (error) {
      console.error('[CONFIG API] Erro ao obter status:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { provider } = req.body;

      // Se for apenas alternar o provedor ativo (META / YCLOUD / WABLAST)
      if (provider) {
        const targetProvider = String(provider).toUpperCase();
        if (!['META', 'YCLOUD', 'WABLAST'].includes(targetProvider)) {
          return res.status(400).json({
            success: false,
            error: 'Provedor invalido. Escolha META, YCLOUD ou WABLAST'
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

      // Se for salvar credenciais manuais WaBlast
      if (req.body.wablastAccountId || req.body.wablast_account_id) {
        const { salvarContaWhatsappWaBlast } = await import('@/lib/whatsapp-business-accounts');
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

      // Se for salvar credenciais manuais YCloud
      if (req.body.ycloudApiKey || req.body.ycloud_api_key) {
        const { salvarContaWhatsappYCloud } = await import('@/lib/whatsapp-business-accounts');
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

      // Fluxo legadostandard para salvar credenciais da Meta Cloud API
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

      const { default: WhatsAppBusinessService } = await import('@/services/whatsapp-business');
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
