import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Buscar campanhas ativas (status EXECUCAO ou PLANEJAMENTO)
    const { data, error } = await supabase
      .from('campanhas')
      .select(`
        id,
        nome,
        descricao,
        local,
        data_campanha,
        status,
        campanhas_liderancas (
          id,
          lideranca_id,
          papel,
          liderancas (
            id,
            nome,
            telefone,
            influencia
          )
        ),
        campanhas_servicos (
          id,
          categoria_servico_id,
          categorias_servicos (
            id,
            nome,
            descricao
          )
        )
      `)
      .in('status', ['PLANEJAMENTO', 'EXECUCAO'])
      .order('data_campanha', { ascending: false })
      .limit(50);

    if (error) throw error;

    return res.status(200).json(data || []);
  } catch (error) {
    console.error('Erro ao buscar campanhas ativas:', error);
    return res.status(400).json({ error: error.message });
  }
}
