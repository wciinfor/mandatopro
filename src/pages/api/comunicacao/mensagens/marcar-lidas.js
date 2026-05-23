import { obterUsuarioAutenticado } from '@/lib/api-auth';
import { gerarTraceId } from '@/lib/financeiro-utils';
import { obterSupabaseServer, validarParDeChat, validarUsuario } from '@/lib/comunicacao-permissoes';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  const traceId = gerarTraceId();

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Metodo nao permitido', traceId });
    }

    const supabase = await obterSupabaseServer();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    validarUsuario(usuario);

    const meuId = Number(usuario.id);

    const body = req.body || {};
    const remetenteId = body.remetenteId;

    await validarParDeChat({ supabase, usuarioOrigem: usuario, destinatarioId: remetenteId });

    const otherId = Number(remetenteId);
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('comunicacao_mensagens')
      .update({ lida: true, data_leitura: now, updated_at: now })
      .eq('destinatario_id', meuId)
      .eq('remetente_id', otherId)
      .eq('lida', false);

    if (error) {
      return res.status(400).json({ message: error.message, traceId });
    }

    return res.status(200).json({ success: true, traceId });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error?.message || 'Erro interno', traceId });
  }
}
