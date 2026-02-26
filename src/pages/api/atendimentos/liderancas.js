import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  const { q } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Mínimo 2 caracteres para busca' });
  }

  try {
    // Buscar lideranças por nome
    const { data, error } = await supabase
      .from('liderancas')
      .select('id, nome, cpf, telefone, influencia, area_atuacao')
      .ilike('nome', `%${q}%`)
      .eq('status', 'ATIVO')
      .limit(20);

    if (error) throw error;

    return res.status(200).json(data || []);
  } catch (error) {
    console.error('Erro ao buscar lideranças:', error);
    return res.status(400).json({ error: error.message });
  }
}
