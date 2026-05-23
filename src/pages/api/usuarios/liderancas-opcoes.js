import { createServerClient } from '@/lib/supabase-server';
import { gerarTraceId, obterUsuarioHeader, exigirAdmin } from '@/lib/financeiro-utils';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  const traceId = gerarTraceId();

  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Metodo nao permitido', traceId });
    }

    const usuario = obterUsuarioHeader(req);
    exigirAdmin(usuario);

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('liderancas')
      .select('id, nome, email, telefone, municipio, bairro, status')
      .eq('status', 'ATIVO')
      .order('nome', { ascending: true })
      .limit(500);

    if (error) {
      return res.status(400).json({ message: error.message, traceId });
    }

    return res.status(200).json({
      data: Array.isArray(data) ? data : [],
      traceId,
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Erro interno', traceId });
  }
}
