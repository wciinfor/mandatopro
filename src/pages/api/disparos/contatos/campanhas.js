import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  }

  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
    const search = String(req.query.search || '').trim();

    let query = supabase
      .from('campanhas')
      .select('id, nome, local, municipio, data_campanha, status')
      .order('data_campanha', { ascending: false })
      .limit(limit);

    if (search) {
      const termo = search.replace(/[,()"']/g, '');
      query = query.or(`nome.ilike.%${termo}%,local.ilike.%${termo}%,municipio.ilike.%${termo}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Erro ao listar campanhas para Mandato Connect:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || 'Erro ao listar campanhas'
    });
  }
}
