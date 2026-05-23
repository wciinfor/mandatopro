import { createServerClient } from '@/lib/supabase-server';
import { gerarTraceId, obterUsuarioHeader } from '@/lib/financeiro-utils';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  const traceId = gerarTraceId();

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido', traceId });
  }

  try {
    const usuarioHeader = obterUsuarioHeader(req);

    if (!usuarioHeader?.id && !usuarioHeader?.email) {
      return res.status(401).json({ message: 'Não autenticado', traceId });
    }

    const supabase = createServerClient();

    let query = supabase.from('usuarios').select('id, nome, email, nivel, status, lideranca_id');

    if (usuarioHeader.id) {
      query = query.eq('id', usuarioHeader.id);
    } else {
      query = query.eq('email', usuarioHeader.email);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return res.status(404).json({ message: 'Usuário não encontrado', traceId });
    }

    return res.status(200).json({ data, traceId });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Erro interno', traceId });
  }
}
