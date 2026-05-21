import { createServerClient } from '@/lib/supabase-server';
import { gerarTraceId, obterUsuarioHeader, parsePaginacao } from '@/lib/financeiro-utils';

export const runtime = 'nodejs';

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return code === '42P01' || (message.includes('notificacoes') && message.includes('does not exist'));
}

export default async function handler(req, res) {
  const traceId = gerarTraceId();

  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Metodo nao permitido', traceId });
    }

    const usuario = obterUsuarioHeader(req);
    if (!usuario?.id) {
      return res.status(401).json({ message: 'Nao autenticado', traceId });
    }

    const { limit, offset } = parsePaginacao(req.query, 50, 200);
    const onlyUnread = String(req.query?.onlyUnread || '').toLowerCase();
    const filtrarNaoLidas = onlyUnread === '1' || onlyUnread === 'true' || onlyUnread === 'yes';

    const supabase = createServerClient();
    const meuId = Number(usuario.id);

    let query = supabase
      .from('notificacoes')
      .select('id, titulo, mensagem, remetente_nome, remetente_nivel, created_at, lida, data_leitura')
      .eq('destinatario_id', meuId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filtrarNaoLidas) {
      query = query.eq('lida', false);
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingTableError(error)) {
        return res.status(200).json({ data: [], traceId, configurado: false });
      }
      return res.status(400).json({ message: error.message, traceId });
    }

    const payload = (data || []).map((row) => ({
      id: row.id,
      titulo: row.titulo || null,
      mensagem: row.mensagem,
      remetenteNome: row.remetente_nome || null,
      remetenteNivel: row.remetente_nivel || null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      lida: !!row.lida,
      dataLeitura: row.data_leitura ? new Date(row.data_leitura).toISOString() : null
    }));

    return res.status(200).json({ data: payload, traceId, configurado: true });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error?.message || 'Erro interno', traceId });
  }
}
