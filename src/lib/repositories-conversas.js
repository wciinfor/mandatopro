/**
 * Repository para gerenciar persistência e consultas das Conversas normalizadas.
 */
export class ConversasRepository {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  async findByExternalId(provider, externalConversationId) {
    const { data, error } = await this.supabase
      .from('central_atendimento_conversas')
      .select('*')
      .eq('provider', provider)
      .eq('external_conversation_id', externalConversationId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async create(conversaData) {
    const { data, error } = await this.supabase
      .from('central_atendimento_conversas')
      .insert({
        provider: conversaData.provider,
        channel: conversaData.channel,
        external_conversation_id: conversaData.external_conversation_id,
        contact_id: conversaData.contact_id,
        status: conversaData.status || 'nova',
        metadata: conversaData.metadata || {},
        last_message_at: conversaData.last_message_at || new Date().toISOString(),
        last_message_preview: conversaData.last_message_preview || ''
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  async updateLastMessage(id, previewText, timeISO, incrementUnread = false) {
    const query = this.supabase
      .from('central_atendimento_conversas')
      .update({
        last_message_preview: previewText,
        last_message_at: timeISO,
        updated_at: new Date().toISOString()
      });

    if (incrementUnread) {
      // Nota: Supabase incremento nativo
      query.data({ unread_count: () => 'unread_count + 1' });
    }

    const { data, error } = await query.eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }
}

/**
 * Repository para gerenciar persistência e consultas das Mensagens normalizadas.
 */
export class MensagensRepository {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  async save(mensagemData) {
    const { data, error } = await this.supabase
      .from('central_atendimento_mensagens')
      .insert({
        conversation_id: mensagemData.conversation_id,
        provider: mensagemData.provider,
        provider_message_id: mensagemData.provider_message_id,
        channel: mensagemData.channel,
        direction: mensagemData.direction,
        message: mensagemData.message,
        media_url: mensagemData.media_url || null,
        media_type: mensagemData.media_type || null,
        status: mensagemData.status || 'recebida',
        sender_id: mensagemData.sender_id || null
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  async listByConversation(conversationId) {
    const { data, error } = await this.supabase
      .from('central_atendimento_mensagens')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }
}
