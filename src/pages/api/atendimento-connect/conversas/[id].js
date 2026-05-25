import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import {
  ATENDIMENTO_CONNECT_STATUS,
  exigirAcessoAtendimentoConnect,
  toPublicConversa
} from '@/lib/atendimento-connect';

export const runtime = 'nodejs';

const SELECT = `
  *,
  usuarios:responsavel_id (id, nome, nivel),
  eleitores:eleitor_id (id, nome, telefone, celular, whatsapp),
  disparo_campanhas:campanha_id (id, titulo, status)
`;

export default async function handler(req, res) {
  const supabase = createServerClient();
  const id = Number(req.query.id);

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);
    exigirAcessoAtendimentoConnect(usuario);

    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: 'Id invalido' });
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('atendimento_connect_conversas')
        .select(SELECT)
        .eq('id', id)
        .single();

      if (error || !data) return res.status(404).json({ success: false, message: 'Conversa nao encontrada' });
      return res.status(200).json({ success: true, data: toPublicConversa(data) });
    }

    if (req.method === 'PATCH') {
      const payload = {};
      const status = req.body?.status ? String(req.body.status) : '';

      if (status) {
        if (!ATENDIMENTO_CONNECT_STATUS.includes(status)) {
          return res.status(400).json({ success: false, message: 'Status invalido' });
        }
        payload.status = status;
      }

      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'responsavelId')) {
        payload.responsavel_id = req.body.responsavelId ? Number(req.body.responsavelId) : null;
      }
      if (req.body?.prioridade) {
        payload.prioridade = String(req.body.prioridade);
      }

      payload.atualizado_por_id = usuario.id;
      payload.updated_at = new Date().toISOString();
      if (status === 'em_atendimento' && !Object.prototype.hasOwnProperty.call(payload, 'responsavel_id')) {
        payload.responsavel_id = usuario.id;
      }
      if (status === 'em_atendimento' || status === 'concluida') {
        payload.unread_count = 0;
      }

      const { data, error } = await supabase
        .from('atendimento_connect_conversas')
        .update(payload)
        .eq('id', id)
        .select(SELECT)
        .single();

      if (error) throw error;

      await supabase.from('atendimento_connect_eventos').insert({
        conversa_id: id,
        usuario_id: usuario.id,
        tipo: 'conversa_atualizada',
        descricao: status ? `Status alterado para ${status}` : 'Conversa atualizada',
        dados: payload
      });

      return res.status(200).json({ success: true, data: toPublicConversa(data) });
    }

    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error('Erro em atendimento-connect/conversa:', error);
    return res.status(status).json({ success: false, message: error?.message || 'Erro interno' });
  }
}
