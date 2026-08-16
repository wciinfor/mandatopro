import YCloudApiService, { createYCloudApiService } from './ycloud-api';
import WhatsAppBusinessService from './whatsapp-business';

/**
 * Interface/Contrato comum de Provider para WhatsApp
 */
export class WhatsAppProviderContract {
  async sendMessage(payload) {
    throw new Error('Método sendMessage não implementado no provider');
  }

  async sendTemplate(payload) {
    throw new Error('Método sendTemplate não implementado no provider');
  }

  async getStatus() {
    throw new Error('Método getStatus não implementado no provider');
  }
}

/**
 * Adaptador para a Meta Cloud API implementando o contrato unificado
 */
export class MetaWhatsAppAdapter extends WhatsAppProviderContract {
  constructor(account) {
    super();
    this.account = account;
    this.service = new WhatsAppBusinessService();
    if (account?.phoneNumberId && account?.accessToken) {
      this.service.updateConfig(account.phoneNumberId, account.accessToken);
    }
  }

  async sendMessage(payload) {
    // Repassa para a implementação da Meta Cloud API
    const to = payload.to || payload.recipient;
    const message = payload.text || payload.message || payload.body;
    return this.service.sendTextMessage(to, message);
  }

  async sendTemplate(payload) {
    const to = payload.to || payload.recipient;
    const templateName = payload.templateName || payload.name;
    const language = payload.language || 'pt_BR';
    const components = payload.components || [];
    return this.service.sendTemplateMessage(to, templateName, language, components);
  }

  async getStatus() {
    return this.service.getPhoneInfo();
  }
}

/**
 * Adaptador para o YCloud implementando o contrato unificado
 */
export class YCloudWhatsAppAdapter extends WhatsAppProviderContract {
  constructor(account) {
    super();
    this.account = account;
    const apiKey = account?.ycloudApiKey || account?.access_token || account?.ycloud_api_key;
    this.service = createYCloudApiService({ apiKey });
  }

  async sendMessage(payload) {
    return this.service.sendMessage(payload);
  }

  async sendTemplate(payload) {
    return this.service.sendTemplate(payload);
  }

  async getStatus() {
    return this.service.getStatus();
  }
}

/**
 * Factory para instanciar o Provider correto (META ou YCLOUD) baseado na conta/mandato
 */
export function createWhatsAppProvider(account = {}) {
  const provider = String(account.provider || account.provider_type || 'META').toUpperCase();

  if (provider === 'YCLOUD') {
    return new YCloudWhatsAppAdapter(account);
  }

  // Padrão: META
  return new MetaWhatsAppAdapter(account);
}

export default createWhatsAppProvider;
