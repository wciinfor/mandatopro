import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';

/**
 * API para configurar WhatsApp Business
 */

export default async function handler(req, res) {
  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAdministrador(usuario);
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ error: error.message || 'Erro de autenticacao' });
  }

  if (req.method === 'GET') {
    // Retorna status da configuração
    try {
      const { getWhatsAppBusinessService } = await import('@/services/whatsapp-business');
      const whatsapp = getWhatsAppBusinessService();
      const status = whatsapp.getStatus();
      
      return res.status(200).json(status);
    } catch (error) {
      console.error('Erro ao obter status:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    // Atualiza configuração
    try {
      const { phoneNumberId, accessToken } = req.body;
      
      if (!phoneNumberId || !accessToken) {
        return res.status(400).json({ 
          error: 'Phone Number ID e Access Token são obrigatórios' 
        });
      }

      const { getWhatsAppBusinessService } = await import('@/services/whatsapp-business');
      const whatsapp = getWhatsAppBusinessService();
      
      const configured = whatsapp.updateConfig(phoneNumberId, accessToken);
      
      if (configured) {
        // Testa a configuração
        try {
          const info = await whatsapp.getPhoneInfo();
          return res.status(200).json({ 
            success: true, 
            configured: true,
            phoneInfo: info
          });
        } catch (testError) {
          return res.status(400).json({ 
            success: false, 
            error: 'Configuração salva mas falhou no teste: ' + testError.message 
          });
        }
      }
      
      return res.status(400).json({ 
        success: false, 
        error: 'Configuração inválida' 
      });
    } catch (error) {
      console.error('Erro ao configurar:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
