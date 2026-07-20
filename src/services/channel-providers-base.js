import { ChannelProvider } from '@/lib/channel-provider';

/**
 * Provedor do canal oficial WhatsApp Business (Meta Cloud API).
 * @implements {ChannelProvider}
 */
export class WhatsAppBusinessChannelProvider extends ChannelProvider {
  /**
   * Consome exclusivamente os registros de conversas persistidos pelo webhook no banco de dados local.
   */
  async listarConversas(filters = {}) {
    try {
      const params = new URLSearchParams({ ...filters, canal: 'whatsapp' });
      const res = await fetch(`/api/atendimento-connect/conversas?${params.toString()}`);
      const payload = await res.json();
      
      if (!res.ok) throw new Error(payload?.message || 'Falha ao buscar conversas locais');

      // Mapeia os dados estruturados locais do Supabase no modelo da Central
      return (payload.data || []).map((c) => ({
        id: c.id,
        contact_id: c.eleitorId || c.contatoTelefone,
        contatoNome: c.contatoNome,
        channel: 'whatsapp',
        status: c.status || 'nova',
        assigned_to: c.responsavelId || null,
        unread_count: c.unreadCount || 0,
        last_message_at: c.ultimaMensagemEm,
        last_message_preview: c.ultimaMensagem,
        responsavel: c.responsavel
      }));
    } catch {
      return [];
    }
  }

  /**
   * Consome o histórico de mensagens da conversa persistidas localmente a partir da base de dados.
   */
  async obterMensagens(conversationId) {
    try {
      const res = await fetch(`/api/atendimento-connect/conversas/${conversationId}/mensagens`);
      const payload = await res.json();
      
      if (!res.ok) throw new Error(payload?.message || 'Falha ao buscar mensagens locais');

      return (payload.data || []).map((m) => ({
        id: m.id,
        conversa_id: conversationId,
        direcao: m.direcao, // 'entrada', 'saida', 'nota'
        mensagem: m.mensagem || '',
        media_url: m.mediaUrl || null,
        media_tipo: m.mediaTipo || null,
        provider_message_id: m.providerMessageId || null,
        status: m.status || 'recebida',
        usuario_id: m.usuarioId || null,
        created_at: m.createdAt
      }));
    } catch {
      return [];
    }
  }

  async enviarMensagem(conversationId, payload) {
    return null;
  }

  async marcarComoLida(conversationId) {
    return true;
  }

  async assumirConversa(conversationId, operador) {
    return true;
  }

  async encerrarConversa(conversationId) {
    return true;
  }
}

/**
 * Provedor do canal legado WhatsApp (API não oficial).
 * @implements {ChannelProvider}
 */
export class WhatsAppLegacyChannelProvider extends ChannelProvider {
  async listarConversas(filters = {}) {
    return [];
  }

  async obterMensagens(conversationId) {
    return [];
  }

  async enviarMensagem(conversationId, payload) {
    // Integração via instâncias legadas de Webhooks
    return null;
  }

  async marcarComoLida(conversationId) {
    return true;
  }

  async assumirConversa(conversationId, operador) {
    return true;
  }

  async encerrarConversa(conversationId) {
    return true;
  }
}

/**
 * Provedor do canal Instagram Direct.
 * @implements {ChannelProvider}
 */
export class InstagramDirectChannelProvider extends ChannelProvider {
  async listarConversas(filters = {}) {
    return [];
  }

  async obterMensagens(conversationId) {
    return [];
  }

  async enviarMensagem(conversationId, payload) {
    // Integração com Meta Graph API para Direct Messages (IG)
    return null;
  }

  async marcarComoLida(conversationId) {
    return true;
  }

  async assumirConversa(conversationId, operador) {
    return true;
  }

  async encerrarConversa(conversationId) {
    return true;
  }
}
