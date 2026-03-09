import crypto from 'crypto';

export function gerarTraceId() {
  return crypto.randomUUID();
}

export function obterUsuarioHeader(req) {
  const raw = req?.headers?.usuario;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

export function exigirAdmin(usuario) {
  if (!usuario || String(usuario.nivel || '').toUpperCase() !== 'ADMINISTRADOR') {
    const err = new Error('Acesso restrito ao administrador');
    err.statusCode = 403;
    throw err;
  }
}

export function normalizarValor(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

export function parsePaginacao(query, defaultLimit = 20, maxLimit = 100) {
  const limitRaw = parseInt(query?.limit || defaultLimit, 10);
  const offsetRaw = parseInt(query?.offset || 0, 10);
  const limit = Number.isNaN(limitRaw) ? defaultLimit : Math.min(limitRaw, maxLimit);
  const offset = Number.isNaN(offsetRaw) ? 0 : Math.max(offsetRaw, 0);
  return { limit, offset };
}

export async function registrarAuditoria(supabase, payload) {
  try {
    const { error } = await supabase.from('logs_auditoria').insert([payload]);
    if (error) {
      console.error('Erro ao registrar auditoria:', error.message);
    }
  } catch (err) {
    console.error('Erro ao registrar auditoria:', err?.message || err);
  }
}

export function buildAuditoriaPayload({
  usuario,
  acao,
  modulo,
  descricao,
  dadosAnteriores,
  dadosNovos,
  status,
  traceId,
  req
}) {
  const ip = req?.headers?.['x-forwarded-for']?.split(',')[0]
    || req?.headers?.['x-real-ip']
    || req?.socket?.remoteAddress
    || 'desconhecido';
  return {
    usuario_id: usuario?.id || null,
    acao,
    modulo,
    descricao,
    ip_address: ip,
    user_agent: req?.headers?.['user-agent'] || null,
    dados_anteriores: dadosAnteriores || null,
    dados_novos: { ...(dadosNovos || {}), traceId },
    status: status || 'SUCESSO',
    data_acao: new Date().toISOString()
  };
}
