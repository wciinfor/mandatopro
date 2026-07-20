import { createServerClient } from '@/lib/supabase-server';

/**
 * API Handler para processamento de eventos do webhook com RLS e persistência atômica.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const evento = req.body;

  if (!evento || !evento.tipo) {
    return res.status(400).json({ error: 'Evento inválido' });
  }

  try {
    const supabase = createServerClient();

    // 1. PROCESSAMENTO DE MENSAGENS DE ENTRADA
    if (evento.tipo === 'mensagem') {
      // Idempotência: Verifica se o provider_message_id já existe
      const { data: msgExistente, error: errIdem } = await supabase
        .from('communication_messages')
        .select('id')
        .eq('provider_message_id', evento.provider_message_id)
        .maybeSingle();

      if (msgExistente) {
        console.log(`[WebhookProcessar] Mensagem ${evento.provider_message_id} já processada (idempotência ativa).`);
        return res.status(200).json({ success: true, duplicated: true });
      }

      // Procura conversa ativa (diferente de 'finalizada') para o contato/canal
      let { data: conversa, error: errConv } = await supabase
        .from('communication_conversations')
        .select('*')
        .eq('contact_id', evento.contact_id)
        .neq('status', 'finalizada')
        .limit(1)
        .maybeSingle();

      const tenantId = '00000000-0000-0000-0000-000000000000'; // Default Tenant para fins de sandbox/auditoria

      // Se não houver conversa ativa, cria uma nova
      if (!conversa) {
        const { data: novaConv, error: errCriaConv } = await supabase
          .from('communication_conversations')
          .insert({
            tenant_id: tenantId,
            contact_id: evento.contact_id,
            channel: evento.mensagem_tipo === 'instagram' ? 'instagram' : 'whatsapp',
            status: 'nova',
            unread_count: 1,
            last_message_at: evento.timestamp,
            last_message_preview: evento.conteudo
          })
          .select('*')
          .single();

        if (errCriaConv) throw errCriaConv;
        conversa = novaConv;
      } else {
        // Se já existe, atualiza metadados e incrementa o contador de não lidas
        const novoUnread = (conversa.unread_count || 0) + 1;
        const { error: errUpdate } = await supabase
          .from('communication_conversations')
          .update({
            last_message_preview: evento.conteudo,
            last_message_at: evento.timestamp,
            unread_count: novoUnread
          })
          .eq('id', conversa.id);

        if (errUpdate) throw errUpdate;
      }

      // Insere a nova mensagem no histórico
      const { data: msgInserida, error: errMsg } = await supabase
        .from('communication_messages')
        .insert({
          tenant_id: tenantId,
          conversation_id: conversa.id,
          provider_message_id: evento.provider_message_id,
          provider: 'whatsapp',
          channel: conversa.channel,
          direction: 'entrada',
          mensagem: evento.conteudo
        })
        .select('*')
        .single();

      if (errMsg) throw errMsg;

      return res.status(200).json({ success: true, mensagem: msgInserida });
    }

    // 2. PROCESSAMENTO DE ALTERAÇÃO DE STATUS
    if (evento.tipo === 'status') {
      const statusMap = {
        sent: 'enviada',
        delivered: 'entregue',
        read: 'lida',
        failed: 'falhou'
      };

      const statusInterno = statusMap[evento.status] || evento.status;

      // Localiza a mensagem na fila
      const { data: msgFila, error: errFila } = await supabase
        .from('communication_messages')
        .select('*')
        .eq('provider_message_id', evento.provider_message_id)
        .maybeSingle();

      if (msgFila) {
        // Atualiza o status
        const { error: errUpdateMsg } = await supabase
          .from('communication_messages')
          .update({
            meta_dados: {
              ...(msgFila.meta_dados || {}),
              status: statusInterno,
              atualizado_em: evento.timestamp
            }
          })
          .eq('id', msgFila.id);

        if (errUpdateMsg) throw errUpdateMsg;
      }

      // Também tenta atualizar a fila de disparos de campanhas se houver correspondência
      const { error: errUpdateFila } = await supabase
        .from('communication_campaign_items')
        .update({
          status: statusInterno,
          delivered_at: evento.status === 'delivered' ? evento.timestamp : undefined,
          read_at: evento.status === 'read' ? evento.timestamp : undefined,
          last_error: evento.status === 'failed' ? JSON.stringify(evento.erro) : undefined
        })
        .eq('provider_message_id', evento.provider_message_id);

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Tipo de evento não processado' });
  } catch (error) {
    console.error('[ProcessarEventoAPI] Erro ao consolidar evento:', error);
    return res.status(500).json({ error: error.message });
  }
}
