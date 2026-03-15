import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  const supabase = createServerClient();

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('agenda_eventos')
        .select('*')
        .order('data', { ascending: true });

      if (error) throw error;

      return res.status(200).json({ data: data || [] });
    } catch (error) {
      console.error('Erro ao listar agenda:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const payload = req.body;
      const { data, error } = await supabase
        .from('agenda_eventos')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ data });
    } catch (error) {
      console.error('Erro ao criar evento:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, ...payload } = req.body;
      if (!id) return res.status(400).json({ error: 'ID obrigatório' });

      const { data, error } = await supabase
        .from('agenda_eventos')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ data });
    } catch (error) {
      console.error('Erro ao atualizar evento:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID obrigatório' });

      const { error } = await supabase
        .from('agenda_eventos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
