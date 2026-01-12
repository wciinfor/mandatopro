/**
 * Webhook para receber mensagens do WhatsApp Business
 */

export default async function handler(req, res) {
  // Verificação do webhook (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const { getWhatsAppBusinessService } = await import('@/services/whatsapp-business');
    const whatsapp = getWhatsAppBusinessService();
    
    const validationResult = whatsapp.validateWebhook(mode, token, challenge);
    
    if (validationResult) {
      console.log('✅ Webhook verificado com sucesso');
      return res.status(200).send(validationResult);
    } else {
      console.error('❌ Falha na verificação do webhook');
      return res.status(403).send('Forbidden');
    }
  }

  // Recebimento de mensagens (POST)
  if (req.method === 'POST') {
    try {
      const { getWhatsAppBusinessService } = await import('@/services/whatsapp-business');
      const whatsapp = getWhatsAppBusinessService();
      
      const messageData = whatsapp.processWebhook(req.body);
      
      if (messageData) {
        // Aqui você pode:
        // 1. Salvar a mensagem no banco de dados
        // 2. Processar comandos automáticos
        // 3. Notificar usuários do sistema
        // 4. Marcar mensagem como lida
        
        if (messageData.id && messageData.type !== 'status') {
          // Marca como lida automaticamente
          await whatsapp.markAsRead(messageData.id);
        }
        
        console.log('📨 Mensagem processada:', messageData);
      }
      
      // Sempre retorna 200 para o WhatsApp
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('❌ Erro ao processar webhook:', error);
      // Mesmo com erro, retorna 200 para não ficar retentando
      return res.status(200).json({ success: false });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
