import { createServerClient } from '@/lib/supabase-server';

const NIVEL_ADMIN = 'ADMINISTRADOR';
const NIVEL_LIDERANCA = 'LIDERANCA';

export function normalizarNivel(nivel) {
  return String(nivel || '').toUpperCase();
}

export function validarUsuario(usuario) {
  if (!usuario?.id) {
    const err = new Error('Não autenticado');
    err.statusCode = 401;
    throw err;
  }
}

export function obterNivelPermitidoParaDestino(nivelOrigem) {
  const nivel = normalizarNivel(nivelOrigem);
  if (nivel === NIVEL_ADMIN) return NIVEL_LIDERANCA;
  if (nivel === NIVEL_LIDERANCA) return NIVEL_ADMIN;
  return null;
}

export async function validarParDeChat({ supabase, usuarioOrigem, destinatarioId }) {
  validarUsuario(usuarioOrigem);

  const nivelDestinoPermitido = obterNivelPermitidoParaDestino(usuarioOrigem?.nivel);
  if (!nivelDestinoPermitido) {
    const err = new Error('Sem permissão para usar o chat');
    err.statusCode = 403;
    throw err;
  }

  const otherId = Number(destinatarioId);
  if (!otherId || Number.isNaN(otherId)) {
    const err = new Error('Destinatário inválido');
    err.statusCode = 400;
    throw err;
  }

  const { data: destinatario, error } = await supabase
    .from('usuarios')
    .select('id,nome,nivel,ativo,status')
    .eq('id', otherId)
    .maybeSingle();

  if (error) {
    const err = new Error(error.message);
    err.statusCode = 400;
    throw err;
  }

  if (!destinatario?.id) {
    const err = new Error('Destinatário não encontrado');
    err.statusCode = 404;
    throw err;
  }

  if (normalizarNivel(destinatario.nivel) !== nivelDestinoPermitido) {
    const err = new Error('Você não pode enviar mensagem para este usuário');
    err.statusCode = 403;
    throw err;
  }

  const status = String(destinatario.status || '').toUpperCase();
  if (destinatario.ativo === false || status === 'INATIVO' || status === 'BLOQUEADO') {
    const err = new Error('Destinatário inativo');
    err.statusCode = 403;
    throw err;
  }

  return { destinatario };
}

export function obterSupabaseServer() {
  return createServerClient();
}

export const NIVEIS_CHAT = { NIVEL_ADMIN, NIVEL_LIDERANCA };
