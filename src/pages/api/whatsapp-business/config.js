import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
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
      const conta = await buscarContaWhatsappPrincipal(supabase, usuario);
      const contaNormalizada = normalizarWhatsappAccount(conta);

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
        isConnected: contaNormalizada.isConnected || false
      });
    } catch (error) {
      console.error('[CONFIG API] Erro ao obter status:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { provider } = req.body;

      // Se for apenas alternar o provedor ativo (META / YCLOUD)
      if (provider) {
        const targetProvider = String(provider).toUpperCase();
        if (!['META', 'YCLOUD'].includes(targetProvider)) {
          return res.status(400).json({
            success: false,
            error: 'Provedor invalido. Escolha META ou YCLOUD'
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
