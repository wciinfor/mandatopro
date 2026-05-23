import { createServerClient } from '@/lib/supabase-server';
import {
  gerarTraceId,
  obterUsuarioHeader,
  exigirAdmin,
  registrarAuditoria,
  buildAuditoriaPayload
} from '@/lib/financeiro-utils';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  const traceId = gerarTraceId();
  const { id } = req.query;

  try {
    const usuario = obterUsuarioHeader(req);
    exigirAdmin(usuario);

    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Metodo nao permitido', traceId });
    }

    const supabase = createServerClient();
    const usuarioId = parseInt(id, 10);

    if (Number.isNaN(usuarioId)) {
      return res.status(400).json({ message: 'Id invalido', traceId });
    }

    const { data: usuarioRegistro, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', usuarioId)
      .single();

    if (error || !usuarioRegistro) {
      return res.status(404).json({ message: 'Usuario nao encontrado', traceId });
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: usuarioRegistro.email
    });

    if (linkError) {
      return res.status(400).json({ message: linkError.message, traceId });
    }

    await registrarAuditoria(supabase, buildAuditoriaPayload({
      usuario,
      acao: 'RESET_SENHA',
      modulo: 'USUARIOS',
      descricao: 'Link de recuperacao gerado',
      dadosAnteriores: null,
      dadosNovos: { usuario_id: usuarioRegistro.id, email: usuarioRegistro.email },
      status: 'SUCESSO',
      traceId,
      req
    }));

    return res.status(200).json({
      message: 'Link de recuperacao gerado',
      actionLink: linkData?.properties?.action_link || null,
      traceId
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Erro interno', traceId });
  }
}
