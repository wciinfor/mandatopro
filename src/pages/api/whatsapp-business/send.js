import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import { buscarContaWhatsappPrincipal, normalizarWhatsappAccount } from '@/lib/whatsapp-business-accounts';
import { createWhatsAppProvider } from '@/services/whatsapp-provider-factory';

/**
 * API para enviar mensagens via WhatsApp Business (Multi-provider: Meta / YCloud)
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAdministrador(usuario);

    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ 
        error: 'Número de telefone e mensagem são obrigatórios' 
      });
    }

    const conta = await buscarContaWhatsappPrincipal(supabase, usuario);
    if (!conta) {
      return res.status(400).json({
        error: 'Nenhuma conta de WhatsApp Business configurada para este mandato.'
      });
    }

    const contaNormalizada = normalizarWhatsappAccount(conta);

    // Instancia o provider correto (META ou YCLOUD) via Factory
    const providerAccount = {
      ...conta,
      ...contaNormalizada,
      accessToken: conta.access_token || conta.ycloud_api_key,
      ycloudApiKey: conta.ycloud_api_key
    };

    const provider = createWhatsAppProvider(providerAccount);

    // Envia mensagem via Factory unificada
    const result = await provider.sendMessage({
      to: phoneNumber,
      message,
      text: message
    });
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error?.message || error);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Erro ao enviar mensagem' 
    });
  }
}
