/**
 * WhatsApp Business Cloud API - Serviço Oficial
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api
 * 
 * REQUISITOS:
 * 1. Criar conta no Meta for Developers: https://developers.facebook.com
 * 2. Criar um App e configurar WhatsApp Business API
 * 3. Obter Phone Number ID e Access Token
 * 4. Configurar Webhook para receber mensagens
 */

import axios from 'axios';

function maskPhoneNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  return `${digits.slice(0, 4)}***${digits.slice(-2)}`;
}

class WhatsAppBusinessService {
  constructor() {
    // Configurações - serão carregadas do banco de dados ou variáveis de ambiente
    this.config = {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
      apiVersion: 'v21.0',
      baseUrl: 'https://graph.facebook.com'
    };
    
    this.isConfigured = false;
    this.checkConfiguration();
  }

  /**
   * Verifica se o serviço está configurado
   */
  checkConfiguration() {
    this.isConfigured = !!(this.config.phoneNumberId && this.config.accessToken);
    
    if (!this.isConfigured) {
      console.log('⚠️ WhatsApp Business API não configurado');
      console.log('📋 Defina as variáveis de ambiente:');
      console.log('   - WHATSAPP_PHONE_NUMBER_ID');
      console.log('   - WHATSAPP_ACCESS_TOKEN');
    } else {
      console.log('✅ WhatsApp Business API configurado');
    }
    
    return this.isConfigured;
  }

  /**
   * Atualiza as configurações
   */
  updateConfig(phoneNumberId, accessToken) {
    this.config.phoneNumberId = phoneNumberId;
    this.config.accessToken = accessToken;
    this.isConfigured = this.checkConfiguration();
    
    console.log('🔄 Configuração atualizada:', {
      phoneNumberId: phoneNumberId ? `${phoneNumberId.substring(0, 10)}...` : 'não definido',
      accessToken: accessToken ? `${accessToken.substring(0, 15)}...` : 'não definido',
      configured: this.isConfigured
    });
    
    return this.isConfigured;
  }

  /**
   * Obtém a URL base da API
   */
  getApiUrl() {
    return `${this.config.baseUrl}/${this.config.apiVersion}/${this.config.phoneNumberId}`;
  }

  /**
   * Obtém headers para requisições
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Formata número de telefone
   */
  formatPhoneNumber(phone) {
    // Remove todos caracteres não numéricos
    let cleaned = phone.replace(/\D/g, '');
    
    // Se não começa com 55 (Brasil), adiciona
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }
    
    console.log(`Numero formatado para WhatsApp: ${maskPhoneNumber(cleaned)}`);
    return cleaned;
  }

  /**
   * Envia mensagem de texto simples
   */
  async sendTextMessage(phoneNumber, message) {
    if (!this.isConfigured) {
      throw new Error('WhatsApp Business API não configurado. Configure Phone Number ID e Access Token.');
    }

    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedNumber,
      type: 'text',
      text: {
        preview_url: false,
        body: message
      }
    };

    try {
      console.log(`Enviando mensagem WhatsApp para ${maskPhoneNumber(formattedNumber)}...`);
      
      const response = await axios.post(
        `${this.getApiUrl()}/messages`,
        payload,
        { headers: this.getHeaders() }
      );

      console.log('✅ Mensagem enviada:', response.data);
      
      return {
        success: true,
        messageId: response.data.messages[0].id,
        recipient: formattedNumber,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error.response?.data || error.message);
      
      // Tratamento de erros específicos
      if (error.response?.status === 401) {
        throw new Error('Token de acesso inválido ou expirado. Verifique suas credenciais.');
      }
      
      if (error.response?.status === 403) {
        throw new Error('Sem permissão para enviar mensagens. Verifique as permissões do App.');
      }
      
      if (error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      
      throw new Error(`Erro ao enviar mensagem: ${error.message}`);
    }
  }

  /**
   * Envia mensagem com template (mensagens pré-aprovadas)
   */
  async sendTemplateMessage(phoneNumber, templateName, languageCode = 'pt_BR', components = []) {
    if (!this.isConfigured) {
      throw new Error('WhatsApp Business API não configurado');
    }

    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    
    const payload = {
      messaging_product: 'whatsapp',
      to: formattedNumber,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode
        },
        components: components
      }
    };

    try {
      console.log(`Enviando template WhatsApp "${templateName}" para ${maskPhoneNumber(formattedNumber)}...`);
      
      const response = await axios.post(
        `${this.getApiUrl()}/messages`,
        payload,
        { headers: this.getHeaders() }
      );

      console.log('✅ Template enviado:', response.data);
      
      return {
        success: true,
        messageId: response.data.messages[0].id,
        recipient: formattedNumber,
        template: templateName
      };
    } catch (error) {
      console.error('❌ Erro ao enviar template:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || error.message);
    }
  }

  /**
   * Envia mensagem para múltiplos números
   */
  async sendBulkMessages(phoneNumbers, message) {
    if (!this.isConfigured) {
      throw new Error('WhatsApp Business API não configurado');
    }

    const results = [];
    
    for (const phone of phoneNumbers) {
      try {
        const result = await this.sendTextMessage(phone, message);
        results.push({ phone, success: true, messageId: result.messageId });
        
        // Delay de 1 segundo entre mensagens (limite da API)
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({ phone, success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Marca mensagem como lida
   */
  async markAsRead(messageId) {
    if (!this.isConfigured) {
      throw new Error('WhatsApp Business API não configurado');
    }

    try {
      const response = await axios.post(
        `${this.getApiUrl()}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        },
        { headers: this.getHeaders() }
      );

      return { success: true };
    } catch (error) {
      console.error('❌ Erro ao marcar como lida:', error.response?.data || error.message);
      throw new Error(error.message);
    }
  }

  /**
   * Obtém informações do número de telefone
   */
  async getPhoneInfo() {
    if (!this.isConfigured) {
      throw new Error('WhatsApp Business API não configurado');
    }

    try {
      const response = await axios.get(
        `${this.getApiUrl()}`,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Erro ao obter info do número:', error.response?.data || error.message);
      throw new Error(error.message);
    }
  }

  /**
   * Obtém status da configuração
   */
  getStatus() {
    return {
      configured: this.isConfigured,
      phoneNumberId: this.config.phoneNumberId ? 
        `${this.config.phoneNumberId.substring(0, 10)}...` : 
        'não configurado',
      hasToken: !!this.config.accessToken,
      ready: this.isConfigured
    };
  }

  /**
   * Valida webhook do WhatsApp
   */
  validateWebhook(mode, token, verifyToken) {
    // Token de verificação deve ser definido no painel do Meta
    const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || '';

    if (!VERIFY_TOKEN) {
      console.error('WHATSAPP_WEBHOOK_TOKEN nao configurado');
      return null;
    }
    
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return verifyToken;
    }
    
    return null;
  }

  /**
   * Processa webhook recebido (mensagens recebidas)
   */
  processWebhook(body) {
    try {
      // Verifica se é um evento de mensagem
      if (body.object !== 'whatsapp_business_account') {
        return null;
      }

      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      
      if (!value) return null;

      // Mensagem recebida
      if (value.messages) {
        const message = value.messages[0];
        const from = message.from; // Número do remetente
        const messageId = message.id;
        const timestamp = message.timestamp;
        
        let messageData = {
          id: messageId,
          from: from,
          timestamp: timestamp,
          type: message.type
        };

        // Processa diferentes tipos de mensagem
        if (message.type === 'text') {
          messageData.text = message.text.body;
        } else if (message.type === 'image') {
          messageData.image = message.image;
        } else if (message.type === 'document') {
          messageData.document = message.document;
        }

        console.log('Mensagem WhatsApp recebida:', {
          id: messageData.id,
          from: maskPhoneNumber(messageData.from),
          timestamp: messageData.timestamp,
          type: messageData.type
        });
        return messageData;
      }

      // Status de mensagem enviada
      if (value.statuses) {
        const status = value.statuses[0];
        console.log('📊 Status da mensagem:', {
          id: status.id,
          status: status.status, // sent, delivered, read, failed
          timestamp: status.timestamp
        });
        return { type: 'status', ...status };
      }

      return null;
    } catch (error) {
      console.error('❌ Erro ao processar webhook:', error);
      return null;
    }
  }
}

// Singleton global
let whatsappBusinessInstance = null;

export function getWhatsAppBusinessService() {
  if (!whatsappBusinessInstance) {
    console.log('🆕 Criando nova instância do WhatsApp Business Service');
    whatsappBusinessInstance = new WhatsAppBusinessService();
  }
  return whatsappBusinessInstance;
}

export default WhatsAppBusinessService;
