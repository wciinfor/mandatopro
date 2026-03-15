import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();

    // Buscar top 10 líderes ordenados por projeção de votos (maior primeiro)
    const { data: lideres, error } = await supabase
      .from('liderancas')
      .select('*')
      .order('projecao_votos', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Erro na query:', error);
      throw error;
    }

    // Buscar contagem de cadastros (eleitores com lideranca_id) para cada líder
    const lideresComCadastros = await Promise.all(
      (lideres || []).map(async (lider) => {
        const { count } = await supabase
          .from('eleitores')
          .select('id', { count: 'exact', head: true })
          .eq('lideranca_id', lider.id);

        // Obter projeção de votos (pode estar em qualquer um dos formatos)
        const projecaoVotos = lider.projecao_votos || lider.projecaoVotos || 0;
        
        // Calcular percentual baseado na projeção
        const percentual = projecaoVotos > 0 ? ((count || 0) / projecaoVotos * 100).toFixed(1) : 0;

        return {
          id: lider.id,
          nome: lider.nome,
          projecaoVotos: projecaoVotos,
          areaAtividade: lider.area_atuacao || lider.areaAtuacao || '',
          cadastros: count || 0,
          percentual: parseFloat(percentual)
        };
      })
    );

    return res.status(200).json({
      data: lideresComCadastros,
      total: lideresComCadastros.length
    });
  } catch (error) {
    console.error('Erro ao carregar top líderes:', error);
    return res.status(500).json({
      error: 'Erro ao carregar top líderes',
      message: error.message
    });
  }
}
