import { createServerClient } from '@/lib/supabase-server';

/**
 * API Handler para obter mensagens da tabela communication_messages para um conversation_id.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'ID da conversa é obrigatório' });
  }

  try {
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('communication_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true }); // Ordenação cronológica solicitada

    if (error) throw error;
    
    return res.status(200).json(data || []);
  } catch (error) {
    console.error('[MensagensAPI] Erro ao carregar mensagens de communication_messages:', error);
    return res.status(200).json([]); // Fallback seguro
  }
}
