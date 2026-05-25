export const ATENDIMENTO_CONNECT_STATUS = [
  'nova',
  'em_atendimento',
  'aguardando_eleitor',
  'resolver_depois',
  'concluida'
];

export const ATENDIMENTO_CONNECT_ROLES = [
  'ADMINISTRADOR',
  'ATENDENTE_CONNECT',
  'SUPERVISOR_CONNECT'
];

export function normalizarTelefone(value = '') {
  return String(value || '').replace(/\D+/g, '');
}

export function exigirAcessoAtendimentoConnect(usuario) {
  const nivel = String(usuario?.nivel || '').toUpperCase();

  if (!usuario || !ATENDIMENTO_CONNECT_ROLES.includes(nivel)) {
    const err = new Error('Acesso restrito ao Atendimento Connect');
    err.statusCode = 403;
    throw err;
  }
}

export function isMissingAtendimentoConnectTable(error) {
  const message = String(error?.message || '').toLowerCase();
  return String(error?.code || '').toUpperCase() === '42P01'
    || message.includes('atendimento_connect_');
}

export function toPublicConversa(row = {}) {
  return {
    id: row.id,
    eleitorId: row.eleitor_id || null,
    campanhaId: row.campanha_id || null,
    instanciaId: row.instancia_id || null,
    contatoNome: row.contato_nome || 'Contato sem nome',
    contatoTelefone: row.contato_telefone || '',
    canal: row.canal || 'whatsapp',
    status: row.status || 'nova',
    prioridade: row.prioridade || 'normal',
    responsavelId: row.responsavel_id || null,
    ultimaMensagem: row.ultima_mensagem || '',
    ultimaMensagemEm: row.ultima_mensagem_em || row.updated_at || row.created_at || null,
    unreadCount: row.unread_count || 0,
    metadata: row.metadata || {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    responsavel: row.usuarios || null,
    eleitor: row.eleitores || null,
    campanha: row.disparo_campanhas || null
  };
}

export function toPublicMensagem(row = {}) {
  return {
    id: row.id,
    conversaId: row.conversa_id,
    direcao: row.direcao,
    mensagem: row.mensagem,
    mediaUrl: row.media_url || null,
    mediaTipo: row.media_tipo || null,
    providerMessageId: row.provider_message_id || null,
    status: row.status || 'registrada',
    usuarioId: row.usuario_id || null,
    createdAt: row.created_at || null,
    usuario: row.usuarios || null
  };
}
