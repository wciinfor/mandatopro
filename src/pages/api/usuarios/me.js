import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { gerarTraceId } from '@/lib/financeiro-utils';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  const traceId = gerarTraceId();

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Metodo nao permitido', traceId });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    // Buscar mandatos vinculados
    const { data: vinculos } = await supabase
      .from('usuarios_mandatos')
      .select('mandato_id')
      .eq('usuario_id', usuario.id);

    const mandatos = (vinculos || []).map(v => v.mandato_id);

    return res.status(200).json({
      data: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        nivel: usuario.nivel,
        status: usuario.status,
        lideranca_id: usuario.lideranca_id,
        mandatos
      },
      traceId
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Erro interno', traceId });
  }
}
