import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export default async function handler(req, res) {
  const { q } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!q || q.length < 3) {
    return res.status(400).json({ error: 'Mínimo 3 caracteres para busca' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    // Buscar eleitores por nome ou CPF
    const { data, error } = await supabase
      .from('eleitores')
      .select('*')
      .or(
        `nome.ilike.%${q}%,cpf.ilike.%${q}%`
      )
      .eq('status', 'ATIVO')
      .limit(20);

    if (error) throw error;

    return res.status(200).json(data || []);
  } catch (error) {
    console.error('Erro ao buscar eleitores:', error);
    return res.status(400).json({ error: error.message });
  }
}
