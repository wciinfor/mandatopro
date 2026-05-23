import { createServerClient } from '@/lib/supabase-server';

export default async function handler(req, res) {
  // Apenas GET é permitido
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { q = '' } = req.query;

    // Validar query
    if (typeof q !== 'string' || q.trim().length < 1) {
      return res.status(400).json({ error: 'Query deve conter pelo menos 1 caractere' });
    }

    // Criar cliente Supabase
    const supabase = createServerClient();

    // Buscar lideranças que correspondem ao termo de busca
    // Procura em: nome, nomeSocial, email, profissao, areaAtuacao
    const { data, error } = await supabase
      .from('liderancas')
      .select('id, nome, email, telefone, profissao, areaAtuacao')
      .or(`nome.ilike.%${q}%,email.ilike.%${q}%,profissao.ilike.%${q}%,areaAtuacao.ilike.%${q}%`)
      .limit(10);

    if (error) {
      console.error('Erro ao buscar lideranças:', error);
      return res.status(500).json({ error: 'Erro ao buscar lideranças' });
    }

    return res.status(200).json(data || []);
  } catch (error) {
    console.error('Erro no endpoint buscar lideranças:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
