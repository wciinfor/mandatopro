import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    // Buscar campanhas cadastradas (ordenadas pelas mais recentes)
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
      .order('data_campanha', { ascending: false })
      .limit(500);

    if (error) throw error;

    return res.status(200).json(data || []);
  } catch (error) {
    console.error('Erro ao buscar campanhas ativas:', error);
    return res.status(400).json({ error: error.message });
  }
}
