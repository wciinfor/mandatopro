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
  'SUPERVISOR_CONNECT',
  'ANALISTA_META'
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
    canal: row.canal || 'whatsapp_legacy',
    channel: row.channel || row.canal || 'whatsapp_legacy',
    status: row.status || 'nova',
    prioridade: row.prioridade || 'normal',
    responsavelId: row.responsavel_id || null,
    unreadCount: row.unread_count || 0,
    ultimaMensagem: row.ultima_mensagem || '',
    ultimaMensagemEm: row.ultima_mensagem_em || row.updated_at || row.created_at || null,
    metadata: row.metadata || {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    responsavel: row.usuarios || null,
    eleitor: row.eleitores || null,
    campanha: row.communication_campaigns || row.disparo_campanhas || null
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
    rawPayload: row.raw_payload || row.rawPayload || null,
    usuarioId: row.usuario_id || null,
    createdAt: row.created_at || null,
    usuario: row.usuarios || null
  };
}

/**
 * Detecta o tipo de mídia da mensagem segundo ordem estrita de prioridade:
 * 1. mensagem.mediaTipo / mensagem.media_tipo
 * 2. rawPayload.mensagem_tipo
 * 3. rawPayload.media_tipo
 * 4. Fallback pelo conteúdo legado ([Áudio ID:, [Áudio Wafly], [Imagem ID:, [Documento ID:, [Vídeo ID:)
 * 5. Outros fallbacks defensivos
 */
export function obterTipoMidia(mensagem) {
  if (!mensagem) return 'text';

  // 1. mediaTipo / media_tipo direto
  const tipoDireto = String(mensagem.mediaTipo || mensagem.media_tipo || '').trim().toLowerCase();
  if (tipoDireto && tipoDireto !== 'text' && tipoDireto !== 'texto') {
    return tipoDireto;
  }

  // 2. rawPayload.mensagem_tipo
  const raw = mensagem.rawPayload || mensagem.raw_payload || {};
  const rawMsgTipo = String(raw.mensagem_tipo || '').trim().toLowerCase();
  if (rawMsgTipo && rawMsgTipo !== 'text' && rawMsgTipo !== 'texto') {
    return rawMsgTipo;
  }

  // 3. rawPayload.media_tipo
  const rawMediaTipo = String(raw.media_tipo || '').trim().toLowerCase();
  if (rawMediaTipo && rawMediaTipo !== 'text' && rawMediaTipo !== 'texto') {
    return rawMediaTipo;
  }

  // 4. Fallback pelo conteúdo legado
  const texto = String(mensagem.mensagem || '').trim();
  if (
    /^\[áudio\s+id:/i.test(texto) ||
    /^\[audio\s+id:/i.test(texto) ||
    /^\[áudio\s+wafly\]/i.test(texto) ||
    /^\[audio\s+wafly\]/i.test(texto) ||
    /^\[áudio\s+transcrito\]/i.test(texto) ||
    /^\[audio\s+transcrito\]/i.test(texto)
  ) {
    return 'audio';
  }
  if (/^\[imagem\s+id:/i.test(texto) || /^\[image\s+id:/i.test(texto) || /^\[imagem\s+wafly\]/i.test(texto)) {
    return 'image';
  }
  if (/^\[documento\s+id:/i.test(texto) || /^\[document\s+id:/i.test(texto) || /^\[documento\s+wafly\]/i.test(texto)) {
    return 'document';
  }
  if (/^\[vídeo\s+id:/i.test(texto) || /^\[video\s+id:/i.test(texto) || /^\[vídeo\s+wafly\]/i.test(texto)) {
    return 'video';
  }

  // Fallback se existir media_id ou audio_url no raw
  if (raw.audio_url || (raw.media_id && (raw.tipo === 'audio' || /áudio|audio/i.test(texto)))) {
    return 'audio';
  }
  if (raw.image_url) return 'image';
  if (raw.video_url) return 'video';
  if (raw.document_url) return 'document';

  return 'text';
}

/**
 * Obtém a transcrição de um áudio caso já tenha sido normalizada ou persistida.
 */
export function obterTranscricao(mensagem) {
  if (!mensagem) return null;
  const raw = mensagem.rawPayload || mensagem.raw_payload || {};

  if (raw.transcription) {
    if (typeof raw.transcription === 'string' && raw.transcription.trim()) {
      return raw.transcription.trim();
    }
    if (typeof raw.transcription === 'object' && raw.transcription.text) {
      return String(raw.transcription.text).trim();
    }
  }

  if (raw.transcription_text && typeof raw.transcription_text === 'string') {
    return raw.transcription_text.trim();
  }

  const metaRaw = raw.metadata?.rawPayload;
  if (metaRaw?.transcription) {
    if (typeof metaRaw.transcription === 'string' && metaRaw.transcription.trim()) {
      return metaRaw.transcription.trim();
    }
    if (typeof metaRaw.transcription === 'object' && metaRaw.transcription.text) {
      return String(metaRaw.transcription.text).trim();
    }
  }

  // Fallback para conteúdo no formato "[Áudio transcrito]: ..."
  const texto = String(mensagem.mensagem || '').trim();
  const match = texto.match(/^\[(?:áudio|audio)\s+transcrito\]:\s*(.+)$/i);
  if (match && match[1]) {
    return match[1].trim();
  }

  return null;
}

/**
 * Extrai legenda de imagens/vídeos removendo prefixos de IDs legados
 */
export function extrairLegenda(texto = '') {
  if (!texto) return '';
  const limpo = texto
    .replace(/^\[(?:imagem|image|vídeo|video|documento|document)\s+(?:id:\s*[^\]]+|wafly)\]\s*(-|\s*)/i, '')
    .trim();
  if (/^https?:\/\//i.test(limpo)) return '';
  return limpo;
}

/**
 * Extrai nome do arquivo para documentos
 */
export function extrairNomeArquivo(mensagem) {
  const raw = mensagem?.rawPayload || mensagem?.raw_payload || {};
  if (raw.document?.filename) return raw.document.filename;
  if (raw.document?.fileName) return raw.document.fileName;
  if (raw.fileName || raw.filename) return raw.fileName || raw.filename;
  const texto = String(mensagem?.mensagem || '');
  const match = texto.match(/^\[(?:documento|document)\s+(?:id:\s*[^\]]+|wafly)\]\s*(.*)$/i);
  if (match && match[1]) {
    const nome = match[1].replace(/https?:\/\/\S+/g, '').trim();
    if (nome) return nome;
  }
  return 'Documento anexo';
}

