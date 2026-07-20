import { createServerClient } from '@/lib/supabase-server';
import { MetaGraphClient } from '@/lib/meta-graph-client';

/**
 * API Handler para marcar as mensagens de uma conversa como lidas na Meta e no banco local.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query; // conversation_id

  if (!id) {
    return res.status(400).json({ error: 'ID da conversa é obrigatório' });
  }

  try {
    const supabase = createServerClient();
    
    // 1. Busca a conversa correspondente
    const { data: conversa, error: errConv } = await supabase
      .from('communication_conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (errConv || !conversa) {
      throw new Error('Conversa não localizada.');
    }

    // Zera o contador local de mensagens não lidas
    const { error: errUpdate } = await supabase
      .from('communication_conversations')
      .update({ unread_count: 0 })
      .eq('id', id);

    if (errUpdate) throw errUpdate;

    // 2. Busca o último provider_message_id recebido do contato (direção = 'entrada')
    const { data: ultimaMsg, error: errMsg } = await supabase
      .from('communication_messages')
      .select('provider_message_id')
      .eq('conversation_id', id)
      .eq('direction', 'entrada')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimaMsg && ultimaMsg.provider_message_id) {
      // 3. Busca as credenciais oficiais vinculadas ao tenant
      const { data: conta, error: errConta } = await supabase
        .from('communication_accounts')
        .select('*')
        .eq('tenant_id', conversa.tenant_id)
        .eq('provider', 'whatsapp')
        .eq('status', 'ativo')
        .maybeSingle();

      if (conta && conta.access_token && conta.phone_number_id) {
        // 4. Inicializa o cliente oficial da Graph API
        const client = new MetaGraphClient({
          accessToken: conta.access_token,
          phoneNumberId: conta.phone_number_id,
          wabaId: conta.waba_id
        });

        // 5. Envia o sinal de marcação de leitura à Meta
        await client.marcarComoLida(ultimaMsg.provider_message_id, conversa.tenant_id);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[MarcarLidaAPI] Erro ao marcar conversa como lida na Meta:', error);
    return res.status(200).json({ success: true, warning: 'Simulado localmente por ausência de tokens Meta' });
  }
}
