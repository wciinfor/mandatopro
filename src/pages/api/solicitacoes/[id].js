import { createServerClient } from '@/lib/supabase-server';
import { gerarTraceId, obterUsuarioHeader } from '@/lib/financeiro-utils';

function nivelUsuario(usuario) {
  return String(usuario?.nivel || '').toUpperCase();
}

function podeAcessarSolicitacoes(usuario) {
  const nivel = nivelUsuario(usuario);
  return nivel === 'ADMINISTRADOR' || nivel === 'LIDERANCA';
}

function isAdmin(usuario) {
  return nivelUsuario(usuario) === 'ADMINISTRADOR';
}

function isLideranca(usuario) {
  return nivelUsuario(usuario) === 'LIDERANCA';
}

export default async function handler(req, res) {
  const traceId = gerarTraceId();
  const usuario = obterUsuarioHeader(req);

  if (!usuario) {
    return res.status(401).json({ message: 'Não autenticado', traceId });
  }

  if (!podeAcessarSolicitacoes(usuario)) {
    return res.status(403).json({ message: 'Acesso restrito para liderança e administrador', traceId });
  }

  const supabase = createServerClient();
  const { id } = req.query;

  // ────────────────────────────────────────────────────────────
  // GET — buscar uma solicitação
  // ────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      let query = supabase
        .from('solicitacoes')
        .select('*')
        .eq('id', id);

      if (isLideranca(usuario)) {
        const emailUsuario = String(usuario?.email || '').trim().toLowerCase();
        query = query.eq('email', emailUsuario || '__sem_email__');
      }

      const { data, error } = await query.single();

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
      if (!isAdmin(usuario)) {
        return res.status(403).json({ message: 'Apenas administrador pode alterar status de solicitações', traceId });
      }

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
