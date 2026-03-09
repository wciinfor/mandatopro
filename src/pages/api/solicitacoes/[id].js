import { createServerClient } from '@/lib/supabase-server';
import { gerarTraceId, obterUsuarioHeader } from '@/lib/financeiro-utils';

export default async function handler(req, res) {
  const traceId = gerarTraceId();
  const usuario = obterUsuarioHeader(req);

  if (!usuario) {
    return res.status(401).json({ message: 'Não autenticado', traceId });
  }

  const supabase = createServerClient();
  const { id } = req.query;

  // ────────────────────────────────────────────────────────────
  // GET — buscar uma solicitação
  // ────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('solicitacoes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return res.status(200).json({ data, traceId });
    } catch (err) {
      return res.status(400).json({ message: err.message, traceId });
    }
  }

  // ────────────────────────────────────────────────────────────
  // PUT — atualizar status / observações
  // ────────────────────────────────────────────────────────────
  if (req.method === 'PUT') {
    try {
      const body = req.body || {};
      const updates = { updated_at: new Date().toISOString() };

      const STATUSES_VALIDOS = ['NOVO', 'RECEBIDO', 'ATENDIDO', 'RECUSADO'];
      if (body.status) {
        if (!STATUSES_VALIDOS.includes(body.status)) {
          return res.status(422).json({ message: 'Status inválido', traceId });
        }
        updates.status = body.status;
      }

      if (body.observacoes !== undefined) updates.observacoes = body.observacoes;
      if (body.atendente_id !== undefined) updates.atendente_id = body.atendente_id;

      // Registra data de conclusão ao finalizar
      if (body.status === 'ATENDIDO' || body.status === 'RECUSADO') {
        updates.data_conclusao = new Date().toISOString().slice(0, 10);
      }

      const { data, error } = await supabase
        .from('solicitacoes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ data, traceId });
    } catch (err) {
      return res.status(400).json({ message: err.message, traceId });
    }
  }

  return res.status(405).json({ message: 'Método não permitido', traceId });
}
