import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const supabase = createServerClient();
  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ error: error.message || 'Erro interno' });
  }

  return res.status(503).json({
    error: 'Consulta TSE temporariamente indisponivel. A base sera reconfigurada em uma nova VPS.'
  });
}
