/**
 * Cliente reutilizável para integração com a Graph API da Meta (WhatsApp Cloud API oficial).
 */
export class MetaGraphClient {
  constructor({ accessToken, phoneNumberId, wabaId, version = 'v19.0' }) {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
    this.wabaId = wabaId;
    this.version = version;
    this.baseUrl = `https://graph.facebook.com/${this.version}`;
  }

  /**
   * Executa uma requisição HTTP genérica para a Graph API com tratamento estruturado de erros
   */
  async request({ method = 'POST', endpoint, data = {}, tenantId = 'unknown-tenant' }) {
    const url = `${this.baseUrl}/${endpoint}`;
    const correlationId = `corr-${Math.random().toString(36).substr(2, 9)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s Timeout

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: method !== 'GET' ? JSON.stringify(data) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responsePayload = await response.json();

      if (!response.ok) {
        // Log estruturado conforme solicitado (ocultando token)
        console.error('[MetaGraphClient Error]', {
          tenant: tenantId,
          provider: 'whatsapp',
          endpoint,
          status: response.status,
          metaErrorCode: responsePayload.error?.code,
          metaErrorMessage: responsePayload.error?.message,
          correlation_id: correlationId
        });

        throw new Error(responsePayload.error?.message || `Graph API returned status ${response.status}`);
      }

      return responsePayload;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout limite de requisição excedido na comunicação com a Meta.');
      }
      throw error;
    }
  }

  /**
   * Dispara uma mensagem de texto simples
   */
  async enviarTexto(destinatarioTelefone, texto, tenantId) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: destinatarioTelefone,
      type: 'text',
      text: { body: texto }
    };

    return this.request({
      method: 'POST',
      endpoint: `${this.phoneNumberId}/messages`,
      data: payload,
      tenantId
    });
  }

  /**
   * Dispara uma mensagem baseada em template HSM homologado
   */
  async enviarTemplate(destinatarioTelefone, { templateNome, idiomaCode = 'pt_BR', componentes = [] }, tenantId) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: destinatarioTelefone,
      type: 'template',
      template: {
        name: templateNome,
        language: { code: idiomaCode },
        components: componentes
      }
    };

    return this.request({
      method: 'POST',
      endpoint: `${this.phoneNumberId}/messages`,
      data: payload,
      tenantId
    });
  }

  /**
   * Marca uma mensagem de entrada como lida (read status)
   */
  async marcarComoLida(providerMessageId, tenantId) {
    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: providerMessageId
    };

    return this.request({
      method: 'POST',
      endpoint: `${this.phoneNumberId}/messages`,
      data: payload,
      tenantId
    });
  }
}
