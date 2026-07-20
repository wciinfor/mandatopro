import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import {
  buscarContaWhatsappPrincipal,
  normalizarWhatsappAccount,
  salvarContaWhatsappPrincipal
} from '@/lib/whatsapp-business-accounts';

/**
 * API para configurar WhatsApp Business por tenant.
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
    const status = error?.statusCode || 500;
    return res.status(status).json({ error: error.message || 'Erro de autenticacao' });
  }

  if (req.method === 'GET') {
    try {
      const conta = await buscarContaWhatsappPrincipal(supabase, usuario);
      return res.status(200).json(normalizarWhatsappAccount(conta));
    } catch (error) {
      console.error('Erro ao obter status:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
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
            account: contaNormalizada
          });
        } catch (testError) {
          return res.status(400).json({
            success: false,
            error: 'Configuracao salva mas falhou no teste: ' + testError.message,
            account: contaNormalizada
          });
        }
      }

      return res.status(400).json({
        success: false,
        error: 'Configuracao invalida'
      });
    } catch (error) {
      console.error('Erro ao configurar:', error);
      return res.status(error?.statusCode || 500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}
