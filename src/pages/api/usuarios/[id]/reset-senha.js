import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import {
  gerarTraceId,
  registrarAuditoria,
  buildAuditoriaPayload
} from '@/lib/financeiro-utils';

export const runtime = 'nodejs';

function resolveBaseUrl(req) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  return `${protocol}://${host}`.replace(/\/$/, '');
}

export default async function handler(req, res) {
  const traceId = gerarTraceId();
  const { id } = req.query;

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Metodo nao permitido', traceId });
    }

    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAdministrador(usuario);
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

    const baseUrl = resolveBaseUrl(req);
    const redirectTo = `${baseUrl}/auth/redefinir-senha`;

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: usuarioRegistro.email,
      options: {
        redirectTo
      }
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
      redirectTo,
      traceId
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Erro interno', traceId });
  }
}
