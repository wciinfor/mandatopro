import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  try {
    const supabase = createServerClient();

    // GET - Buscar lideranças (com filtro opcional por nome/CPF)
    if (req.method === 'GET') {
      const { search = '', limit = 20 } = req.query;

      let query = supabase
        .from('liderancas')
        .select('id, nome, cpf, telefone, influencia, area_atuacao, status')
        .eq('status', 'ATIVO');

      if (search && search.trim().length > 0) {
        query = query.or(`nome.ilike.%${search}%,cpf.ilike.%${search}%`);
      }

      const { data: liderancas, error } = await query
        .limit(parseInt(limit))
        .order('nome', { ascending: true });

      if (error) {
        return res.status(400).json({
          message: 'Erro ao buscar lideranças',
          error: error.message
        });
      }

      return res.status(200).json({ 
        data: (liderancas || []).map(l => ({
          ...l,
          id: l.id.toString() // Converter para string para compatibilidade
        }))
      });
    }

    return res.status(405).json({ message: 'Método não permitido' });
  } catch (error) {
    console.error('Erro na API:', error);
    return res.status(500).json({
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
}
