/**
 * Normalizador responsável por traduzir a estrutura aninhada de payloads enviados 
 * pelo Webhook oficial do WhatsApp Business Cloud API (Meta) para o formato interno padronizado.
 */
export class MetaWebhookNormalizer {
  /**
   * Identifica e extrai os dados principais de uma mensagem de entrada do webhook da Meta
   * @param {Object} valueEntry - O objeto 'value' dentro do payload da Meta (entry[0].changes[0].value)
   */
  static normalizarMensagem(valueEntry) {
    if (!valueEntry.messages || valueEntry.messages.length === 0) return null;

    const rawMessage = valueEntry.messages[0];
    const rawContact = valueEntry.contacts && valueEntry.contacts[0];

    const normal = {
      tipo: 'mensagem',
      provider_message_id: rawMessage.id,
      contact_id: rawMessage.from,
      contato_nome: (rawContact && rawContact.profile && rawContact.profile.name) || rawMessage.from,
      timestamp: new Date(Number(rawMessage.timestamp) * 1000).toISOString(),
      mensagem_tipo: rawMessage.type, // text, image, document, audio, video, location, contacts
      conteudo: ''
    };

    // Extrai o conteúdo com base no tipo de mensagem oficial da Meta
    switch (rawMessage.type) {
      case 'text':
        normal.conteudo = rawMessage.text?.body || '';
        break;
      case 'image':
        normal.conteudo = `[Imagem ID: ${rawMessage.image?.id}]${rawMessage.image?.caption ? ' - ' + rawMessage.image.caption : ''}`;
        normal.media_id = rawMessage.image?.id;
        break;
      case 'document':
        normal.conteudo = `[Documento ID: ${rawMessage.document?.id}] ${rawMessage.document?.filename || ''}`;
        normal.media_id = rawMessage.document?.id;
        break;
      case 'audio':
        normal.conteudo = `[Áudio ID: ${rawMessage.audio?.id}]`;
        normal.media_id = rawMessage.audio?.id;
        break;
      case 'video':
        normal.conteudo = `[Vídeo ID: ${rawMessage.video?.id}]`;
        normal.media_id = rawMessage.video?.id;
        break;
      case 'location':
        normal.conteudo = `[Localização] Latitude: ${rawMessage.location?.latitude}, Longitude: ${rawMessage.location?.longitude}`;
        break;
      case 'contacts':
        const primeiroContato = rawMessage.contacts?.[0]?.name?.formatted || 'Contato';
        normal.conteudo = `[Cartão de Contato] ${primeiroContato}`;
        break;
      default:
        normal.conteudo = `[Mensagem tipo: ${rawMessage.type || 'desconhecido'}]`;
    }

    return normal;
  }

  /**
   * Identifica e extrai os dados principais de um evento de alteração de status
   * @param {Object} valueEntry - O objeto 'value' dentro do payload da Meta (entry[0].changes[0].value)
   */
  static normalizarStatus(valueEntry) {
    if (!valueEntry.statuses || valueEntry.statuses.length === 0) return null;

    const rawStatus = valueEntry.statuses[0];

    // Status mapeados: sent, delivered, read, failed
    return {
      tipo: 'status',
      provider_message_id: rawStatus.id,
      contact_id: rawStatus.recipient_id,
      status: rawStatus.status,
      timestamp: new Date(Number(rawStatus.timestamp) * 1000).toISOString(),
      erro: rawStatus.errors && rawStatus.errors.length > 0 ? {
        code: rawStatus.errors[0].code,
        title: rawStatus.errors[0].title,
        message: rawStatus.errors[0].message
      } : null
    };
  }
}
