import YCloudApiService, { createYCloudApiService } from './ycloud-api.js';
import WhatsAppBusinessService from './whatsapp-business.js';
import WaBlastApiService, { createWaBlastApiService } from './wablast-api.js';
import WaflyApiService, { createWaflyApiService } from './wafly-api.js';

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
    const language = payload.idiomaCode || payload.language || 'pt_BR';
    const components = payload.components || [];
    const response = await this.service.sendTemplateMessage(to, templateName, language, components);
    const messageId = response?.messageId || response?.id || response?.messages?.[0]?.id || null;

    if (!messageId) {
      throw new Error('Meta Graph API não retornou um Message ID válido após o envio.');
    }

    return {
      success: true,
      id: messageId,
      messageId: messageId,
      recipient: response?.recipient || to,
      template: templateName,
      data: response
    };
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

  _cleanNumber(num) {
    return String(num || '').replace(/\D/g, '');
  }

  _resolveFromNumber() {
    // Para a API YCloud, o remetente ('from') DEVE ser o número de telefone no padrão E.164 (ex: +559180823372)
    // NUNCA utilizar phoneNumberId / phone_number_id, pois estes são IDs internos de hardware/WABA da Graph API Meta
    const raw = this.account?.displayPhoneNumber
      || this.account?.display_phone_number
      || this.account?.from
      || this.account?.phone
      || '';
    return this._cleanNumber(raw);
  }

  async sendMessage(payload) {
    const rawFrom = payload.from || this._resolveFromNumber();
    const rawTo = payload.to || payload.recipient;
    const textBody = payload.text?.body || payload.text || payload.message || payload.body;

    const formattedPayload = {
      from: this._cleanNumber(rawFrom),
      to: this._cleanNumber(rawTo),
      type: payload.type || 'text',
      text: typeof textBody === 'object' ? textBody : { body: textBody }
    };

    return this.service.sendMessage(formattedPayload);
  }

  async sendTemplate(payload) {
    const rawFrom = payload.from || this._resolveFromNumber();
    const rawTo = payload.to || payload.recipient;

    // Normalização flexível das entradas de template
    const templateName = payload.templateName || payload.name || payload.template?.name || '';
    const langCode = payload.idiomaCode || payload.language?.code || payload.language || 'pt_BR';
    const components = payload.components || payload.template?.components || [];

    const formattedPayload = {
      from: this._cleanNumber(rawFrom),
      to: this._cleanNumber(rawTo),
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: typeof langCode === 'object' ? langCode.code : langCode
        },
        components: components
      }
    };

    return this.service.sendMessage(formattedPayload);
  }

  async getStatus() {
    return this.service.getStatus();
  }
}

/**
 * Adaptador para o WaBlast Partner API implementando o contrato unificado
 */
export class WaBlastWhatsAppAdapter extends WhatsAppProviderContract {
  constructor(account) {
    super();
    this.account = account;
    this.service = createWaBlastApiService();
  }

  _formatE164(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.startsWith('+') ? digits : `+${digits}`;
  }

  async sendMessage(payload) {
    const accountId = this.account?.wablastAccountId || this.account?.wablast_account_id || this.account?.account_id;
    if (!accountId) {
      throw new Error('WaBlastWhatsAppAdapter: wablast_account_id não configurado na conta');
    }

    const rawTo = payload.to || payload.recipient;
    const formattedTo = this._formatE164(rawTo);
    const textBody = typeof payload.text === 'object' 
      ? payload.text.body 
      : (payload.text || payload.message || payload.body || '');

    const formattedPayload = {
      account_id: accountId,
      to: formattedTo,
      type: 'text',
      text: {
        body: textBody
      }
    };

    const response = await this.service.sendMessage(formattedPayload);
    const messageId = response?.id || response?.message_id || response?.messages?.[0]?.id || null;

    return {
      success: true,
      messageId,
      id: messageId,
      status: response?.status || 'sent',
      recipient: formattedTo,
      data: response
    };
  }

  async sendTemplate(payload) {
    const accountId = this.account?.wablastAccountId || this.account?.wablast_account_id || this.account?.account_id;
    if (!accountId) {
      throw new Error('WaBlastWhatsAppAdapter: wablast_account_id não configurado na conta');
    }

    const rawTo = payload.to || payload.recipient;
    const formattedTo = this._formatE164(rawTo);

    const templateName = payload.templateName || payload.name || payload.template?.name || '';
    const langCode = typeof payload.idiomaCode === 'object' 
      ? (payload.idiomaCode.code || 'pt_BR')
      : (payload.idiomaCode || payload.language?.code || payload.language || 'pt_BR');
    const components = payload.components || payload.template?.components || [];

    const formattedPayload = {
      account_id: accountId,
      to: formattedTo,
      type: 'template',
      template: {
        name: templateName,
        language: langCode,
        components: components
      }
    };

    const response = await this.service.sendMessage(formattedPayload);
    const messageId = response?.id || response?.message_id || response?.messages?.[0]?.id || null;

    return {
      success: true,
      messageId,
      id: messageId,
      status: response?.status || 'sent',
      recipient: formattedTo,
      data: response
    };
  }

  async getStatus() {
    const accountId = this.account?.wablastAccountId || this.account?.wablast_account_id || this.account?.account_id;
    if (!accountId) {
      throw new Error('WaBlastWhatsAppAdapter: wablast_account_id não configurado');
    }
    return this.service.request(`/v1/accounts/${encodeURIComponent(accountId)}`, { method: 'GET' });
  }
}

/**
 * Adaptador para o provedor WAFLY implementando o contrato unificado
 * Converte chamadas de template em texto livre interpolado via busca isolada.
 */
export class WaflyWhatsAppAdapter extends WhatsAppProviderContract {
  constructor(account = {}) {
    super();
    this.account = account;

    const metadata = typeof account.access_token_metadata === 'object' && account.access_token_metadata
      ? account.access_token_metadata
      : {};

    const clientToken = account.waflyClientToken
      || account.wafly_client_token
      || account.clientToken
      || account.client_token
      || metadata.wafly_client_token
      || metadata.clientToken
      || metadata.client_token
      || '';

    const instance = account.waflyInstance
      || account.wafly_instance
      || account.instance
      || account.instance_id
      || metadata.wafly_instance
      || metadata.instance
      || metadata.instance_id
      || '';

    const token = account.waflyToken
      || account.wafly_token
      || account.token
      || account.instance_token
      || metadata.wafly_token
      || metadata.token
      || metadata.instance_token
      || (account.access_token && String(account.provider || '').toUpperCase() === 'WAFLY' ? account.access_token : '')
      || '';

    const baseUrl = account.waflyBaseUrl
      || account.wafly_base_url
      || metadata.wafly_base_url
      || undefined;

    this.service = createWaflyApiService({
      clientToken,
      instance,
      token,
      baseUrl
    });
  }

  async sendMessage(payload = {}) {
    const to = payload.to || payload.recipient;
    const message = typeof payload.text === 'object' && payload.text?.body !== undefined
      ? payload.text.body
      : (payload.text || payload.message || payload.body || '');

    const response = await this.service.sendText({
      phone: to,
      message,
      delayMessage: payload.delayMessage,
      messageId: payload.messageId,
      editMessageId: payload.editMessageId,
      fromMe: payload.fromMe,
      isGroup: payload.isGroup,
      mentioned: payload.mentioned
    });

    const messageId = response?.messageId || response?.id || null;

    return {
      success: true,
      messageId,
      id: messageId
    };
  }

  /**
   * Obtém a redação base do template de forma isolada
   * @private
   */
  async _obterTextoTemplate(templateName) {
    if (!templateName) return null;
    const cleanName = String(templateName).trim();

    // 1. Fonte primária: tabela communication_templates do banco de dados (reutilizando createServerClient)
    try {
      let createServerClient;
      try {
        const mod = await import('../lib/supabase-server.js');
        createServerClient = mod.createServerClient;
      } catch {
        const mod = await import('@/lib/supabase-server');
        createServerClient = mod.createServerClient;
      }
      const supabase = createServerClient();

      let query = supabase
        .from('communication_templates')
        .select('componentes, nome')
        .eq('nome', cleanName);

      if (this.account?.tenant_id) {
        query = query.eq('tenant_id', this.account.tenant_id);
      }

      const { data: rows } = await query;
      if (Array.isArray(rows) && rows.length > 0) {
        const tmpl = rows[0];
        const componentes = Array.isArray(tmpl.componentes) ? tmpl.componentes : [];
        const bodyComp = componentes.find(c => String(c.type || '').toUpperCase() === 'BODY');
        if (bodyComp?.text) {
          return bodyComp.text;
        }
      }
    } catch (err) {
      console.warn('[WAFLY ADAPTER] Falha ao consultar communication_templates:', err?.message || err);
    }

    // 2. Fonte secundária: catálogo de templates oficiais pré-configurados do sistema
    const CATALOGO_PADRAO = {
      'acao_social_beneficio_01': 'Olá, {{1}}.\n\nO benefício {{2}} está disponível.\n\n- Entrega: {{3}}\n\n- Local: {{4}}\n\nApresentar documento com foto.',
      'consulta_grau_oculos': 'Olá, {{1}}.\n\nSua consulta gratuita de grau, escolha da armação e lentes está disponível.\n\nData e horário: {{2}}\nLocal: {{3}}\n\nApresente documento com foto.\nAtendimento por ordem de chegada.',
      'comunicado_institucional': 'Olá, {{1}}.\n\nGostaríamos de compartilhar uma mensagem de agradecimento.\n\nAgradecemos pela confiança, pela parceria e pela presença ao longo desta caminhada.\n\nSeguimos trabalhando com compromisso, respeito e gratidão por todos que fazem parte dessa trajetória.\n\nDesejamos a você e à sua família muita paz, saúde e esperança.\n\nMuito obrigado!'
    };

    if (CATALOGO_PADRAO[cleanName]) {
      return CATALOGO_PADRAO[cleanName];
    }

    return null;
  }

  /**
   * Extrai valores dos parâmetros do body preservando a ordem
   * @private
   */
  _extrairValoresParametros(components) {
    if (!Array.isArray(components)) return [];

    const bodyComp = components.find(c => String(c.type || '').toLowerCase() === 'body');
    const parameters = bodyComp?.parameters || [];

    if (!Array.isArray(parameters)) return [];

    return parameters.map(p => {
      if (typeof p === 'string') return p;
      if (p && typeof p === 'object') {
        if (p.text !== undefined && p.text !== null) return String(p.text);
        if (p.value !== undefined && p.value !== null) return String(p.value);
      }
      return '';
    });
  }

  /**
   * Interpola variáveis {{1}}, {{2}}, etc. no corpo do template
   * @private
   */
  _interpolarTexto(templateText, valores) {
    let resultado = templateText;
    valores.forEach((val, idx) => {
      const marcador = `{{${idx + 1}}}`;
      resultado = resultado.split(marcador).join(val);
    });
    return resultado;
  }

  async sendTemplate(payload = {}) {
    const to = payload.to || payload.recipient;
    const templateName = payload.templateName || payload.name || payload.template?.name || '';
    const components = payload.components || payload.template?.components || [];

    if (!to) {
      return {
        success: false,
        provider: 'WAFLY',
        error: 'Destinatário (to/recipient) não informado para sendTemplate',
        templateName
      };
    }

    // 0. Se mensagem direta já foi fornecida (ex: variações / texto livre)
    if (payload.message || payload.text) {
      const directMessage = typeof payload.text === 'object' && payload.text?.body !== undefined
        ? payload.text.body
        : (payload.message || payload.text);
      const res = await this.sendMessage({ to, message: directMessage });
      return {
        success: true,
        id: res.id || res.messageId,
        messageId: res.messageId || res.id,
        recipient: to,
        template: templateName,
        data: res
      };
    }

    // 1. Obter redação base do template
    const templateTexto = await this._obterTextoTemplate(templateName);

    // 2. Fallback explícito: se não encontrar o template, rejeita antes do envio
    if (!templateTexto) {
      return {
        success: false,
        provider: 'WAFLY',
        error: 'Template não encontrado para conversão em mensagem de texto',
        templateName
      };
    }

    // 3. Extrai valores dos parâmetros e interpola
    const valores = this._extrairValoresParametros(components);
    const mensagemFinal = this._interpolarTexto(templateTexto, valores);

    // 4. Envia como mensagem de texto simples via Wafly
    const response = await this.sendMessage({
      to,
      message: mensagemFinal
    });

    return {
      success: true,
      id: response.id || response.messageId,
      messageId: response.messageId || response.id,
      recipient: to,
      template: templateName,
      data: response
    };
  }

  async getStatus() {
    try {
      if (typeof this.service?._request === 'function') {
        const res = await this.service._request('/status', { method: 'GET' });
        const rawStatus = res?.value || res?.status || 'CONNECTED';
        return {
          success: true,
          status: rawStatus,
          provider: 'WAFLY',
          data: res
        };
      }
      return { success: true, status: 'CONNECTED', provider: 'WAFLY' };
    } catch (err) {
      return {
        success: false,
        status: 'ERROR',
        error: err?.error || err?.message || 'Falha ao consultar status WAFLY',
        provider: 'WAFLY'
      };
    }
  }
}

/**
 * Factory para instanciar o Provider correto (META, WABLAST, YCLOUD ou WAFLY) baseado na conta/mandato
 */
export function createWhatsAppProvider(account = {}) {
  const provider = String(account.provider || account.provider_type || 'META').toUpperCase();

  if (provider === 'WABLAST') {
    return new WaBlastWhatsAppAdapter(account);
  }

  if (provider === 'YCLOUD') {
    return new YCloudWhatsAppAdapter(account);
  }

  if (provider === 'WAFLY') {
    return new WaflyWhatsAppAdapter(account);
  }

  // Padrão: META
  return new MetaWhatsAppAdapter(account);
}

export default createWhatsAppProvider;

