/**
 * API para enviar mensagens via WhatsApp Business
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { phoneNumber, message, type = 'text' } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ 
        error: 'Número de telefone e mensagem são obrigatórios' 
      });
    }

    const { getWhatsAppBusinessService } = await import('@/services/whatsapp-business');
    const whatsapp = getWhatsAppBusinessService();
    
    // Verifica se está configurado
    if (!whatsapp.isConfigured) {
      return res.status(400).json({ 
        error: 'WhatsApp Business API não configurado. Configure primeiro no painel.' 
      });
    }

    // Envia mensagem
    const result = await whatsapp.sendTextMessage(phoneNumber, message);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
