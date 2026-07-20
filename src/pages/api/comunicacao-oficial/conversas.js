import { createServerClient } from '@/lib/supabase-server';

/**
 * API Handler para obter conversas da tabela communication_conversations.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('communication_conversations')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (error) throw error;
    
    // Mapeia para o formato esperado pelo frontend se necessário (por exemplo, contatoNome)
    const formatado = (data || []).map(c => ({
      id: c.id,
      contact_id: c.contact_id,
      contatoNome: c.contact_id, // Fallback se não há join com eleitor
      channel: c.channel,
      status: c.status,
      assigned_to: c.assigned_to,
      unread_count: c.unread_count || 0,
      last_message_at: c.last_message_at,
      last_message_preview: c.last_message_preview,
      responsavel: c.assigned_to ? { id: c.assigned_to, nome: 'Operador' } : null
    }));

    return res.status(200).json(formatado);
  } catch (error) {
    console.error('[ConversasAPI] Erro ao carregar conversas de communication_conversations:', error);
    return res.status(200).json([]); // Fallback seguro
  }
}
