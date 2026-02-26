import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  try {
    const supabase = createServerClient();

    // GET - Listar categorias de serviços
    if (req.method === 'GET') {
      const { data: categorias, error } = await supabase
        .from('categorias_servicos')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (error) {
        return res.status(400).json({
          message: 'Erro ao listar categorias',
          error: error.message
        });
      }

      return res.status(200).json({ data: categorias });
    }

    // POST - Criar nova categoria de serviço
    if (req.method === 'POST') {
      const { nome, descricao } = req.body;

      if (!nome || !nome.trim()) {
        return res.status(400).json({
          message: 'Nome da categoria é obrigatório'
        });
      }

      try {
        const { data: categoria, error } = await supabase
          .from('categorias_servicos')
          .insert([{
            nome: nome.trim(),
            descricao: descricao && descricao.trim() ? descricao.trim() : null,
            ativo: true
          }])
          .select();

        if (error) {
          console.error('Erro ao criar categoria:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });

          // Verificar se é erro de constraint (nome duplicado)
          if (error.code === '23505' || error.message.includes('unique')) {
            return res.status(409).json({
              message: 'Erro ao criar categoria',
              error: `Já existe um serviço com o nome "${nome.trim()}"`
            });
          }

          return res.status(400).json({
            message: 'Erro ao criar categoria',
            error: error.message || 'Erro desconhecido ao criar categoria',
            details: error.details,
            hint: error.hint
          });
        }

        return res.status(201).json({
          data: categoria[0],
          message: 'Categoria criada com sucesso'
        });
      } catch (innerError) {
        console.error('Erro interno ao criar categoria:', innerError);
        return res.status(500).json({
          message: 'Erro ao criar categoria',
          error: innerError.message
        });
      }
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
