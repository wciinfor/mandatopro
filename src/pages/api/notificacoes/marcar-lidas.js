import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado } from '@/lib/api-auth';
import { gerarTraceId } from '@/lib/financeiro-utils';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  const traceId = gerarTraceId();

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Metodo nao permitido', traceId });
    }

    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    if (!usuario?.id) {
      return res.status(401).json({ message: 'Nao autenticado', traceId });
    }

    const body = req.body || {};
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const all = body.all === true;

    if (!all && ids.length === 0) {
      return res.status(400).json({ message: 'Informe ids ou all=true', traceId });
    }

    const meuId = Number(usuario.id);
    const now = new Date().toISOString();

    let updateQuery = supabase
      .from('notificacoes')
      .update({ lida: true, data_leitura: now, updated_at: now })
      .eq('destinatario_id', meuId)
      .eq('lida', false);

    if (!all) {
      const idsNumericos = ids
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x));

      if (idsNumericos.length === 0) {
        return res.status(400).json({ message: 'Ids invalidos', traceId });
      }

      updateQuery = updateQuery.in('id', idsNumericos);
    }

    const { error } = await updateQuery;
    if (error) {
      return res.status(400).json({ message: error.message, traceId });
    }

    return res.status(200).json({ success: true, traceId });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error?.message || 'Erro interno', traceId });
  }
}
