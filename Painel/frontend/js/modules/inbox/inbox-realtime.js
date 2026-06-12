/**
 * InboxRealtime — assinaturas Supabase Realtime para o inbox.
 * - Nível workspace: mudanças em `conversations` (status, unread, atribuição)
 * - Nível conversa: INSERT/UPDATE em `conversation_messages`
 *
 * Depende de: window.SupabaseClient (exposto por supabase.js)
 */
const InboxRealtime = (() => {
  let _convChannel   = null;
  let _msgChannel    = null;
  let _openConvId    = null;

  return {
    /**
     * Assina mudanças de conversas de um workspace.
     * Substitui assinatura anterior automaticamente.
     * @param {string} workspaceId
     * @param {function(payload): void} onConversationChange — callback com payload Realtime
     */
    subscribeWorkspace(workspaceId, onConversationChange) {
      if (_convChannel) {
        _convChannel.unsubscribe();
        _convChannel = null;
      }

      _convChannel = window.SupabaseClient
        .channel(`inbox:workspace:${workspaceId}`)
        .on(
          'postgres_changes',
          {
            event:  '*',
            schema: 'public',
            table:  'conversations',
            filter: `workspace_id=eq.${workspaceId}`,
          },
          onConversationChange,
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.debug('[InboxRealtime] Inscrito em conversas do workspace', workspaceId);
          }
        });
    },

    /**
     * Assina mensagens de uma conversa específica.
     * Substitui assinatura de conversa anterior automaticamente.
     * @param {string} conversationId
     * @param {function(payload): void} onMessage — callback com payload Realtime
     */
    subscribeConversation(conversationId, onMessage) {
      if (_msgChannel) {
        _msgChannel.unsubscribe();
        _msgChannel = null;
      }

      _openConvId = conversationId;

      _msgChannel = window.SupabaseClient
        .channel(`inbox:conversation:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'conversation_messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          onMessage,
        )
        .on(
          'postgres_changes',
          {
            event:  'UPDATE',
            schema: 'public',
            table:  'conversation_messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          onMessage,
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.debug('[InboxRealtime] Inscrito em mensagens da conversa', conversationId);
          }
        });
    },

    /** Remove assinatura de mensagens da conversa ativa. */
    unsubscribeConversation() {
      if (_msgChannel) {
        _msgChannel.unsubscribe();
        _msgChannel  = null;
      }
      _openConvId = null;
    },

    /** Remove todas as assinaturas do inbox. */
    unsubscribeAll() {
      if (_convChannel) {
        _convChannel.unsubscribe();
        _convChannel = null;
      }
      this.unsubscribeConversation();
    },

    /** ID da conversa atualmente aberta (ou null). */
    get openConversationId() {
      return _openConvId;
    },
  };
})();

window.InboxRealtime = InboxRealtime;
