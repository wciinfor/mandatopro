import crypto from 'crypto';
import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import { lerConfiguracoes, salvarConfiguracoes } from '@/lib/configuracoes';
import { carregarSnapshotAniversariantes } from '@/lib/aniversariantes';

export const runtime = 'nodejs';

const allowedTables = {
  eleitores: {
    fields: 'id, nome, telefone, cidade, bairro, status',
    dateField: 'created_at',
    searchField: 'nome'
  },
  campanhas: {
    fields: 'id, nome, data_campanha, status, local, municipio',
    dateField: 'data_campanha',
    searchField: 'nome'
  },
  agenda_eventos: {
    fields: 'id, titulo, data, hora_inicio, tipo, categoria, local, municipio',
    dateField: 'data',
    searchField: 'titulo'
  },
  liderancas: {
    fields: 'id, nome, telefone, email, cidade, bairro, influencia, status',
    dateField: 'created_at',
    searchField: 'nome'
  },
  funcionarios: {
    fields: 'id, nome, telefone, email, cargo, departamento, cidade, bairro, status',
    dateField: 'created_at',
    searchField: 'nome'
  },
  atendimentos: {
    fields: 'id, protocolo, data_atendimento, status, assunto',
    dateField: 'data_atendimento',
    searchField: 'protocolo'
  },
  solicitacoes: {
    fields: 'id, protocolo, titulo, status, municipio, bairro, data_abertura',
    dateField: 'data_abertura',
    searchField: 'titulo'
  },
  emendas: {
    fields: 'id, numero_emenda, titulo, valor, status, data_apresentacao, beneficiarios',
    dateField: 'data_apresentacao',
    searchField: 'titulo'
  },
  orgaos: {
    fields: 'id, nome, sigla, email, telefone, responsavel, status',
    dateField: 'created_at',
    searchField: 'nome'
  },
  repasses: {
    fields: 'id, emenda_id, valor, data_prevista, data_efetiva, status',
    dateField: 'data_prevista',
    searchField: 'status'
  },
  financeiro_lancamentos: {
    fields: 'id, codigo, data_lancamento, tipo, categoria, parceiro_nome, valor, status',
    dateField: 'data_lancamento',
    searchField: 'parceiro_nome'
  },
  financeiro_despesas: {
    fields: 'id, codigo, data_despesa, tipo, categoria, fornecedor_nome, valor, status',
    dateField: 'data_despesa',
    searchField: 'fornecedor_nome'
  },
  financeiro_parceiros: {
    fields: 'id, codigo, nome, tipo, email, telefone, status',
    dateField: 'created_at',
    searchField: 'nome'
  },
  documentos: {
    fields: 'id, titulo, tipo, categoria, data_upload, publico',
    dateField: 'data_upload',
    searchField: 'titulo'
  },
  notificacoes: {
    fields: 'id, titulo, mensagem, lida, created_at',
    dateField: 'created_at',
    searchField: 'titulo'
  },
  geolocalizacao: {
    fields: 'id, tipo, nome, cidade, bairro, endereco, latitude, longitude, status, nivel_influencia',
    dateField: 'id',
    searchField: 'nome'
  },
  aniversariantes: {
    fields: 'id, eleitor_id, data_nascimento, mes, ano_nascimento, enviado_mensagem, created_at',
    dateField: 'created_at',
    searchField: 'eleitor_id'
  }
};

const tableNames = Object.keys(allowedTables).join(', ');

const PLANNER_PROMPT = `Voce e o planejador da Thai, assessora pessoal do parlamentar no MandatoPro.\n` +
  `Responda APENAS com JSON valido.\n` +
  `Tabelas permitidas: ${tableNames}.\n` +
  `Acoes permitidas: list, search, count, detail, list_contacts, prioritize, none.\n` +
  `Filtros permitidos: status, municipio, cidade, bairro, data_from, data_to, ids, id_field.\n` +
  `Para pessoas por cidade, use filters.cidade em eleitores, liderancas, funcionarios ou geolocalizacao. Para agenda/campanhas/solicitacoes, use filters.municipio.\n` +
  `Use o campo search para nome/titulo/protocolo.\n` +
  `Se houver "Contexto da conversa" e a pergunta for follow-up (ex: eles/deles/todos/contatos/primeiro/segundo/quem devo procurar), use a mesma table do contexto e reaproveite filtros/ids anteriores.\n` +
  `Se nao for pergunta de dados, use {"action":"none","reason":"..."}.`;

const PLANNER_REPAIR_PROMPT = `Voce recebe um JSON invalido do planner.\n` +
  `Corrija e devolva SOMENTE JSON valido no schema: {action, table, filters, search, limit, order}.\n` +
  `Acoes: list, search, count, detail, list_contacts, prioritize, none.\n` +
  `Tabelas: ${tableNames}.\n` +
  `Filtros: status, municipio, cidade, bairro, data_from, data_to, ids, id_field.\n` +
  `Se nao for consulta de dados, use {"action":"none","reason":"..."}.`;

const ANSWER_PROMPT = `Voce e a Thai, assessora pessoal do parlamentar. Responda APENAS com base nos dados fornecidos.\n` +
  `Nao invente informacoes.\n` +
  `Use tom direto, executivo e util em campo.\n` +
  `Para contagens, responda no formato "Temos X ... cadastrados" quando fizer sentido.\n` +
  `Para contatos, comece com "Segue os contatos:" e liste nome e telefone/email disponivel.\n` +
  `Se houver resultados, responda curto e humano, preservando os dados fornecidos sem alterar numeros, nomes ou datas.\n` +
  `Se nao houver resultados, explique a tentativa, use as sugestoes fornecidas e faca a pergunta objetiva informada.\n` +
  `Nao use dados externos nem assuma valores ausentes.`;

// Adicione sinonimos aqui para melhorar reconhecimento de termos.
const searchSynonyms = {
  campanha: ['campanhas', 'acao', 'acoes'],
  evento: ['eventos', 'agenda'],
  reuniao: ['reuniao', 'reunioes'],
  mutirao: ['mutirao', 'mutiroes'],
  solicitacao: ['solicitacao', 'solicitacoes', 'pedido', 'demanda'],
  atendimento: ['atendimento', 'atendimentos', 'chamado'],
  eleitor: ['eleitor', 'eleitores', 'cidadao', 'cidadaos'],
  lideranca: ['lideranca', 'liderancas', 'lider'],
  funcionario: ['funcionario', 'funcionarios', 'equipe', 'servidor'],
  emenda: ['emenda', 'emendas', 'recurso'],
  repasse: ['repasse', 'repasses'],
  financeiro: ['financeiro', 'despesa', 'despesas', 'lancamento', 'lancamentos', 'parceiro', 'parceiros'],
  documento: ['documento', 'documentos', 'arquivo', 'arquivos'],
  notificacao: ['notificacao', 'notificacoes', 'alerta', 'avisos'],
  geolocalizacao: ['geolocalizacao', 'mapa', 'territorio', 'marcadores'],
  aniversariante: ['aniversariante', 'aniversariantes', 'aniversario', 'aniversarios']
};

const CONTEXT_TTL_MS = 20 * 60 * 1000;
const conversationStore = new Map();

function cleanupConversationStore(now) {
  for (const [key, entry] of conversationStore.entries()) {
    if (!entry || entry.expiresAt <= now) {
      conversationStore.delete(key);
    }
  }
}

function getConversationKey(req, user) {
  const body = req?.body || {};
  const headerConversationId = req?.headers?.['x-conversation-id'] || req?.headers?.['x-session-id'];
  const sessionId = body.sessionId || body.clientConversationId || headerConversationId;
  if (sessionId) return `session:${sessionId}`;
  const userId = user?.id || user?.userId || user?.email || user?.cpf;
  if (userId) return `user:${userId}`;
  return '';
}

function getConversationContext(key) {
  if (!key) return null;
  const now = Date.now();
  cleanupConversationStore(now);
  const entry = conversationStore.get(key);
  if (!entry || entry.expiresAt <= now) {
    conversationStore.delete(key);
    return null;
  }
  return entry.value || null;
}

function setConversationContext(key, value) {
  if (!key) return;
  const now = Date.now();
  cleanupConversationStore(now);
  conversationStore.set(key, { value, expiresAt: now + CONTEXT_TTL_MS });
}

function logPhase(phase, data) {
  try {
    console.info(JSON.stringify({ phase, ...data }));
  } catch (error) {
    console.info({ phase, ...data });
  }
}

function getConversationKeyHash(key) {
  if (!key) return 'none';
  return crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 8);
}

function getLastMessageByRole(history, role) {
  const safeHistory = Array.isArray(history) ? history : [];
  for (let i = safeHistory.length - 1; i >= 0; i -= 1) {
    const item = safeHistory[i];
    if (item?.role === role && item?.content) {
      return String(item.content);
    }
  }
  return '';
}

function summarizeAssistantMessage(text) {
  const clean = String(text || '').trim();
  if (!clean) return '';
  if (clean.length <= 160) return clean;
  return `${clean.slice(0, 157)}...`;
}

function detectTableFromText(message) {
  const normalized = normalizeForMatch(message);
  const tableKeywords = {
    campanhas: ['campanha', 'campanhas'],
    agenda_eventos: ['agenda', 'evento', 'eventos'],
    liderancas: ['lideranca', 'liderancas'],
    eleitores: ['eleitor', 'eleitores'],
    funcionarios: ['funcionario', 'funcionarios', 'equipe'],
    atendimentos: ['atendimento', 'atendimentos'],
    solicitacoes: ['solicitacao', 'solicitacoes', 'pedido', 'demanda'],
    emendas: ['emenda', 'emendas'],
    orgaos: ['orgao', 'orgaos', 'órgão', 'órgãos'],
    repasses: ['repasse', 'repasses'],
    financeiro_lancamentos: ['lancamento', 'lancamentos', 'doacao', 'doacoes', 'receita', 'receitas'],
    financeiro_despesas: ['despesa', 'despesas', 'gasto', 'gastos'],
    financeiro_parceiros: ['parceiro', 'parceiros', 'doador', 'doadores'],
    documentos: ['documento', 'documentos', 'arquivo', 'arquivos'],
    notificacoes: ['notificacao', 'notificacoes', 'aviso', 'avisos', 'alerta', 'alertas'],
    geolocalizacao: ['geolocalizacao', 'geolocalização', 'mapa', 'territorio', 'território', 'marcador', 'marcadores'],
    aniversariantes: ['aniversariante', 'aniversariantes', 'aniversario', 'aniversarios']
  };
  for (const [table, keywords] of Object.entries(tableKeywords)) {
    if (keywords.some((term) => normalized.includes(term))) {
      return table;
    }
  }
  return '';
}

function buildShortHistoryMessages(history) {
  const messages = [];
  const lastUser = getLastMessageByRole(history, 'user');
  const lastAssistant = getLastMessageByRole(history, 'assistant');
  if (lastUser) {
    const shortened = shortenText(lastUser, 160);
    messages.push({ role: 'user', content: `Mensagem anterior do usuario: ${shortened}` });
  }
  if (lastAssistant) {
    const summary = summarizeAssistantMessage(lastAssistant);
    if (summary) {
      messages.push({ role: 'assistant', content: `Resumo da ultima resposta: ${summary}` });
    }
  }
  return messages;
}

function detectFollowUpIntent(message) {
  const normalized = normalizeForMatch(message);
  const followUpRegex = /(\beles\b|\bdeles\b|\bessas\b|\besses\b|\btodos\b|\btodas\b|\btods\b|\bos contatos\b|\bos anteriores\b|\bdaqueles\b|\bo primeiro\b|\bo segundo\b|\bo terceiro\b|\ba primeira\b|\ba segunda\b|\ba terceira\b|\bprimeiro\b|\bsegundo\b|\bterceiro\b)/;
  const wantsContacts = /(contato|telefone|celular|whatsapp|email|numero|numeros)/.test(normalized);
  const wantsLocation = /(municipio|cidade|bairro|uf|estado|local)/.test(normalized);
  const wantsAll = /(\btodos\b|\btodas\b|\btods\b|\btodo mundo\b|\bgeral\b)/.test(normalized);
  const wantsPriority = /(prioridade|priorizar|priorize|procurar primeiro|falar primeiro|acionar primeiro|quem devo procurar|quem devo falar|mais importante|mais fortes|principais)/.test(normalized);
  const ordinalMap = {
    primeiro: 0,
    primeira: 0,
    segundo: 1,
    segunda: 1,
    terceiro: 2,
    terceira: 2,
    ultimo: -1,
    ultima: -1
  };
  let ordinalIndex = null;
  Object.keys(ordinalMap).forEach((key) => {
    if (ordinalIndex === null && normalized.includes(key)) {
      ordinalIndex = ordinalMap[key];
    }
  });

  const fieldMap = {
    telefone: 'telefone',
    celular: 'celular',
    whatsapp: 'whatsapp',
    email: 'email',
    municipio: 'municipio',
    cidade: 'cidade',
    bairro: 'bairro',
    uf: 'uf',
    estado: 'estado',
    local: 'local'
  };
  let requestedField = '';
  Object.keys(fieldMap).forEach((key) => {
    if (!requestedField && normalized.includes(key)) {
      requestedField = fieldMap[key];
    }
  });

  return {
    isFollowUp: followUpRegex.test(normalized) || wantsContacts || wantsLocation || wantsPriority || ordinalIndex !== null,
    wantsContacts,
    wantsLocation,
    wantsAll,
    wantsPriority,
    ordinalIndex,
    requestedField
  };
}

function resolveFollowup(question, lastContext) {
  const followUp = detectFollowUpIntent(question);
  if (!followUp.isFollowUp || !lastContext?.table) {
    return { isFollowUp: false };
  }

  const explicitTable = detectTableFromText(question);
  if (explicitTable && explicitTable !== lastContext.table) {
    return { isFollowUp: false, explicitTable };
  }

  const shown = Array.isArray(lastContext.shown)
    ? lastContext.shown
    : (Array.isArray(lastContext.displayList) ? lastContext.displayList : []);
  const ids = shown.map((item) => item.id).filter(Boolean);
  const idField = lastContext.idField || shown[0]?.idField || 'id';
  const labels = shown.map((item) => item.label).filter(Boolean);

  let targetIds = ids;
  if (followUp.wantsAll) {
    targetIds = [];
  } else if (followUp.ordinalIndex !== null && ids.length > 0) {
    if (followUp.ordinalIndex === -1) {
      targetIds = ids.slice(-1);
    } else if (ids[followUp.ordinalIndex]) {
      targetIds = [ids[followUp.ordinalIndex]];
    }
  }

  let targetLabel = '';
  if (labels.length > 0) {
    if (followUp.ordinalIndex === -1) {
      targetLabel = labels[labels.length - 1];
    } else if (followUp.ordinalIndex !== null && labels[followUp.ordinalIndex]) {
      targetLabel = labels[followUp.ordinalIndex];
    } else {
      targetLabel = labels[0];
    }
  }

  let intent = 'detail';
  if (followUp.wantsPriority) {
    intent = 'prioritize';
  } else if (followUp.wantsLocation || ['municipio', 'cidade', 'bairro', 'uf', 'estado', 'local'].includes(followUp.requestedField)) {
    intent = 'list_location';
  } else if (followUp.wantsContacts || ['telefone', 'celular', 'whatsapp', 'email', 'phone', 'mobile'].includes(followUp.requestedField)) {
    intent = 'list_contacts';
  }

  return {
    isFollowUp: true,
    lockedTable: lastContext.table,
    intent,
    targetIds,
    idField,
    ordinalIndex: followUp.ordinalIndex,
    requestedField: followUp.requestedField,
    targetLabel,
    wantsAll: followUp.wantsAll,
    wantsPriority: followUp.wantsPriority,
    reuseLastFilters: followUp.wantsAll || followUp.wantsPriority || ids.length === 0
  };
}

function getProviderConfig(config) {
  const provider = String(config.openai?.provider || 'openai').toLowerCase();
  if (provider === 'groq') {
    return {
      provider: 'groq',
      label: 'Groq',
      apiKey: config.openai?.groqApiKey,
      model: config.openai?.groqModel || 'llama-3.1-8b-instant',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions'
    };
  }

  return {
    provider: 'openai',
    label: 'OpenAI',
    apiKey: config.openai?.apiKey,
    model: config.openai?.model || 'gpt-4o-mini',
    endpoint: 'https://api.openai.com/v1/chat/completions'
  };
}

async function callChatCompletion(provider, payload) {
  const response = await fetch(provider.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message = `Erro ao consultar ${provider.label}`;
    let code = '';
    try {
      const parsed = JSON.parse(errorText);
      message = parsed?.error?.message || message;
      code = parsed?.error?.code || parsed?.error?.type || '';
    } catch (error) {
      message = errorText || message;
    }
    const err = new Error(message);
    err.code = code;
    err.raw = errorText;
    throw err;
  }

  return response.json();
}

function formatDate(value) {
  if (!value) return '-';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('pt-BR');
  } catch (error) {
    return String(value);
  }
}

function formatCurrency(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '-';
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatRow(table, row) {
  if (table === 'campanhas') {
    return `${row.nome || 'Sem nome'} | ${formatDate(row.data_campanha)} | ${row.status || '-'} | ${row.municipio || row.local || '-'}`;
  }
  if (table === 'agenda_eventos') {
    const hora = row.hora_inicio ? ` ${row.hora_inicio}` : '';
    return `${row.titulo || 'Sem titulo'} | ${formatDate(row.data)}${hora} | ${row.tipo || '-'} | ${row.municipio || row.local || '-'}`;
  }
  if (table === 'liderancas') {
    return `${row.nome || 'Sem nome'} | ${row.telefone || '-'} | ${row.email || '-'} | ${row.cidade || '-'} | ${row.bairro || '-'} | ${row.influencia || '-'} | ${row.status || '-'}`;
  }
  if (table === 'funcionarios') {
    return `${row.nome || 'Sem nome'} | ${row.cargo || '-'} | ${row.departamento || '-'} | ${row.telefone || '-'} | ${row.status || '-'}`;
  }
  if (table === 'eleitores') {
    return `${row.nome || 'Sem nome'} | ${row.cidade || '-'} | ${row.bairro || '-'} | ${row.status || '-'}`;
  }
  if (table === 'atendimentos') {
    return `${row.protocolo || 'Sem protocolo'} | ${formatDate(row.data_atendimento)} | ${row.status || '-'} | ${row.assunto || '-'}`;
  }
  if (table === 'solicitacoes') {
    return `${row.protocolo || 'Sem protocolo'} | ${row.titulo || 'Sem titulo'} | ${row.status || '-'} | ${row.municipio || '-'}`;
  }
  if (table === 'emendas') {
    return `${row.numero_emenda || row.id} | ${row.titulo || 'Sem titulo'} | ${row.status || '-'} | ${formatCurrency(row.valor)}`;
  }
  if (table === 'repasses') {
    return `${row.id} | ${formatCurrency(row.valor)} | ${row.status || '-'} | prevista: ${formatDate(row.data_prevista)}`;
  }
  if (table === 'financeiro_lancamentos') {
    return `${row.codigo || row.id} | ${formatDate(row.data_lancamento)} | ${row.tipo || '-'} | ${row.parceiro_nome || '-'} | ${formatCurrency(row.valor)} | ${row.status || '-'}`;
  }
  if (table === 'financeiro_despesas') {
    return `${row.codigo || row.id} | ${formatDate(row.data_despesa)} | ${row.tipo || '-'} | ${row.fornecedor_nome || '-'} | ${formatCurrency(row.valor)} | ${row.status || '-'}`;
  }
  if (table === 'financeiro_parceiros' || table === 'orgaos') {
    return `${row.nome || 'Sem nome'} | ${row.telefone || '-'} | ${row.email || '-'} | ${row.status || '-'}`;
  }
  if (table === 'documentos') {
    return `${row.titulo || 'Sem titulo'} | ${row.tipo || '-'} | ${row.categoria || '-'} | ${formatDate(row.data_upload)}`;
  }
  if (table === 'notificacoes') {
    return `${row.titulo || 'Sem titulo'} | ${row.lida ? 'lida' : 'nao lida'} | ${formatDate(row.created_at)}`;
  }
  if (table === 'geolocalizacao') {
    return `${row.nome || 'Sem nome'} | ${row.tipo || '-'} | ${row.cidade || '-'} | ${row.bairro || '-'} | ${row.status || '-'}`;
  }
  if (table === 'aniversariantes') {
    return `${row.eleitor_id || row.id} | ${formatDate(row.data_nascimento)} | mes ${row.mes || '-'} | mensagem enviada: ${row.enviado_mensagem ? 'sim' : 'nao'}`;
  }
  return JSON.stringify(row);
}

function labelForTable(table) {
  const labels = {
    campanhas: 'campanhas',
    agenda_eventos: 'eventos da agenda',
    liderancas: 'liderancas',
    eleitores: 'eleitores',
    funcionarios: 'funcionarios',
    atendimentos: 'atendimentos',
    solicitacoes: 'solicitacoes',
    emendas: 'emendas',
    orgaos: 'orgaos',
    repasses: 'repasses',
    financeiro_lancamentos: 'lancamentos financeiros',
    financeiro_despesas: 'despesas',
    financeiro_parceiros: 'parceiros financeiros',
    documentos: 'documentos',
    notificacoes: 'notificacoes',
    geolocalizacao: 'marcadores no mapa',
    aniversariantes: 'aniversariantes'
  };
  return labels[table] || 'registros';
}

function formatValue(value, table, field) {
  if (!value) return '-';
  const dateField = allowedTables[table]?.dateField;
  if (field === dateField || String(field).includes('data')) {
    return formatDate(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function shortenText(value, maxLen) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 3)}...`;
}

const snippetFields = {
  campanhas: ['nome', 'municipio', 'local', 'status', 'data_campanha'],
  agenda_eventos: ['titulo', 'municipio', 'local', 'tipo', 'data'],
  liderancas: ['nome', 'telefone', 'email', 'cidade', 'bairro', 'influencia', 'status'],
  eleitores: ['nome', 'cidade', 'bairro', 'status'],
  funcionarios: ['nome', 'cargo', 'departamento', 'telefone', 'cidade', 'bairro', 'status'],
  atendimentos: ['protocolo', 'assunto', 'status', 'data_atendimento'],
  solicitacoes: ['protocolo', 'titulo', 'status', 'municipio', 'bairro', 'data_abertura'],
  emendas: ['numero_emenda', 'titulo', 'valor', 'status', 'data_apresentacao'],
  orgaos: ['nome', 'sigla', 'telefone', 'email', 'responsavel', 'status'],
  repasses: ['valor', 'data_prevista', 'data_efetiva', 'status'],
  financeiro_lancamentos: ['codigo', 'data_lancamento', 'tipo', 'categoria', 'parceiro_nome', 'valor', 'status'],
  financeiro_despesas: ['codigo', 'data_despesa', 'tipo', 'categoria', 'fornecedor_nome', 'valor', 'status'],
  financeiro_parceiros: ['codigo', 'nome', 'tipo', 'telefone', 'email', 'status'],
  documentos: ['titulo', 'tipo', 'categoria', 'data_upload', 'publico'],
  notificacoes: ['titulo', 'mensagem', 'lida', 'created_at'],
  geolocalizacao: ['nome', 'tipo', 'cidade', 'bairro', 'endereco', 'status'],
  aniversariantes: ['eleitor_id', 'data_nascimento', 'mes', 'ano_nascimento', 'enviado_mensagem']
};

function getSnippetFieldsForPlan(plan, table) {
  if (plan?.action === 'list_contacts') {
    const contactFields = getContactFieldsForTable(table);
    if (contactFields.length > 0) return contactFields;
  }
  if (plan?.action === 'list_location') {
    const locationFields = getLocationFieldsForTable(table);
    if (locationFields.length > 0) return locationFields;
  }
  return snippetFields[table] || [];
}

const idFieldCandidates = ['id', 'uuid', 'codigo', 'protocolo', 'nome', 'titulo'];

function pickIdField(rows, table) {
  if (!rows || rows.length === 0) return '';
  for (const candidate of idFieldCandidates) {
    const hasAny = rows.some((row) => row?.[candidate]);
    if (hasAny) return candidate;
  }
  const fallbackField = snippetFields[table]?.find((field) => rows.some((row) => row?.[field]));
  return fallbackField || '';
}

function buildDisplayLabel(table, row) {
  const label = row?.nome || row?.titulo || row?.protocolo || row?.assunto;
  if (label) return shortenText(label, 64);
  const fallbackField = snippetFields[table]?.find((field) => row?.[field]);
  if (fallbackField) return shortenText(formatValue(row[fallbackField], table, fallbackField), 64);
  return 'Sem titulo';
}

function buildDisplayList(table, rows, idField) {
  const list = [];
  (rows || []).slice(0, 3).forEach((row) => {
    const idValue = idField ? row?.[idField] : null;
    const label = buildDisplayLabel(table, row);
    list.push({ label, idField: idField || '', id: idValue || '' });
  });
  return list;
}

function getContactFieldsForTable(table) {
  const candidates = ['telefone', 'phone', 'celular', 'mobile', 'whatsapp', 'email'];
  const allowed = parseFieldsList(allowedTables[table]?.fields);
  return candidates.filter((field) => allowed.includes(field));
}

function getLocationFieldsForTable(table) {
  const candidates = ['municipio', 'cidade', 'bairro', 'uf', 'estado', 'local'];
  const allowed = parseFieldsList(allowedTables[table]?.fields);
  return candidates.filter((field) => allowed.includes(field));
}

function buildContactLines(rows, table, idField, lastContext, requestedField) {
  const contactFields = getContactFieldsForTable(table);
  if (contactFields.length === 0) return [];

  const labelMap = new Map();
  const shown = Array.isArray(lastContext?.shown) ? lastContext.shown : (lastContext?.displayList || []);
  shown.forEach((item) => {
    if (item?.id) labelMap.set(String(item.id), item.label);
  });

  return (rows || []).map((row) => {
    const rowId = idField ? row?.[idField] : '';
    const label = labelMap.get(String(rowId)) || buildDisplayLabel(table, row);
    const fieldsToUse = requestedField && contactFields.includes(requestedField)
      ? [requestedField]
      : contactFields;
    const parts = fieldsToUse.map((field) => {
      const value = row?.[field];
      return `${field}: ${value || '-'}`;
    });
    return `${label} - ${parts.join(' | ')}`;
  });
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatBrazilPhone(value) {
  const digits = onlyDigits(value);
  if (!digits) return '';
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return value;
}

function buildWhatsappUrl(value) {
  const digits = onlyDigits(value);
  if (!digits) return '';
  const normalized = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${normalized}`;
}

function buildActionableContactLine(row, table, idField, labelMap, fieldsToCheck) {
  const rowId = idField ? row?.[idField] : '';
  const label = labelMap.get(String(rowId)) || buildDisplayLabel(table, row);
  const phoneField = fieldsToCheck.find((field) => ['telefone', 'phone', 'celular', 'mobile', 'whatsapp'].includes(field) && row?.[field]);
  const emailField = fieldsToCheck.find((field) => field === 'email' && row?.[field]);
  const phone = phoneField ? formatBrazilPhone(row?.[phoneField]) : '';
  const whatsapp = phoneField ? buildWhatsappUrl(row?.[phoneField]) : '';
  const email = emailField ? row?.[emailField] : '';
  const parts = [];

  if (phone) parts.push(`telefone: ${phone}`);
  if (whatsapp) parts.push(`WhatsApp: ${whatsapp}`);
  if (email) parts.push(`email: ${email}`);

  return {
    label,
    hasContact: parts.length > 0,
    line: parts.length > 0 ? `- ${label}: ${parts.join(' | ')}` : `- ${label}: sem telefone/email cadastrado`
  };
}

function influenceRank(value) {
  const normalized = normalizeForMatch(value).replace(/_/g, ' ');
  if (normalized.includes('muito alta') || normalized.includes('muitoalta')) return 4;
  if (normalized.includes('alta')) return 3;
  if (normalized.includes('media')) return 2;
  if (normalized.includes('baixa')) return 1;
  return 0;
}

function contactRank(row) {
  if (row?.telefone || row?.celular || row?.whatsapp || row?.phone || row?.mobile) return 2;
  if (row?.email) return 1;
  return 0;
}

function prioritizeRows(table, rows) {
  if (table !== 'liderancas') return rows || [];
  return [...(rows || [])].sort((a, b) => {
    const influenceDiff = influenceRank(b?.influencia) - influenceRank(a?.influencia);
    if (influenceDiff !== 0) return influenceDiff;
    const contactDiff = contactRank(b) - contactRank(a);
    if (contactDiff !== 0) return contactDiff;
    return String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR');
  });
}

function buildPriorityAnswer(plan, rows, meta) {
  const table = plan?.table || '';
  if (table !== 'liderancas') {
    return 'Consigo priorizar melhor as liderancas. Quer que eu filtre por cidade primeiro?';
  }
  if (!rows || rows.length === 0) {
    return 'Nao encontrei liderancas para priorizar nesse contexto. Quer informar a cidade?';
  }

  const prioritized = prioritizeRows(table, rows).slice(0, 5);
  const labelMap = new Map();
  const lastContext = meta?.lastContext || {};
  const shown = Array.isArray(lastContext?.shown) ? lastContext.shown : (lastContext?.displayList || []);
  shown.forEach((item) => {
    if (item?.id) labelMap.set(String(item.id), item.label);
  });

  const lines = prioritized.map((row, index) => {
    const label = labelMap.get(String(row?.id)) || buildDisplayLabel(table, row);
    const influence = row?.influencia || 'sem influencia informada';
    const bairro = row?.bairro ? ` | bairro: ${row.bairro}` : '';
    const phone = row?.telefone ? ` | ${formatBrazilPhone(row.telefone)}` : '';
    const whatsapp = row?.telefone ? ` | WhatsApp: ${buildWhatsappUrl(row.telefone)}` : '';
    const contactNote = !row?.telefone && !row?.email ? ' | sem contato cadastrado' : '';
    return `${index + 1}) ${label} - influencia: ${influence}${bairro}${phone}${whatsapp}${contactNote}`;
  });

  return [
    'Eu priorizaria assim:',
    ...lines,
    'Critério: maior influência primeiro, depois quem tem contato disponível.'
  ].join('\n');
}

function buildFollowUpAnswer(plan, rows, meta) {
  const tableLabel = labelForTable(plan?.table);
  const requestedField = meta?.followUp?.requestedField || '';
  const intent = meta?.followUp?.intent || '';
  const possibleContactFields = ['telefone', 'phone', 'celular', 'mobile', 'whatsapp', 'email'];
  const possibleLocationFields = ['municipio', 'cidade', 'bairro', 'uf', 'estado', 'local'];
  const idField = meta?.followUp?.idField || plan?.idField || 'id';
  const lastContext = meta?.lastContext || {};
  const shown = Array.isArray(lastContext?.shown) ? lastContext.shown : (lastContext?.displayList || []);
  const labelMap = new Map();
  shown.forEach((item) => {
    if (item?.id) labelMap.set(String(item.id), item.label);
  });

  if (!rows || rows.length === 0) {
    return `Nao encontrei os itens anteriores em ${tableLabel}. Quer refazer a lista?`;
  }

  if (intent === 'prioritize' || plan?.action === 'prioritize') {
    return buildPriorityAnswer(plan, rows, meta);
  }

  const availableFields = intent === 'list_location'
    ? getLocationFieldsForTable(plan?.table || '')
    : getContactFieldsForTable(plan?.table || '');
  const pool = intent === 'list_location' ? possibleLocationFields : possibleContactFields;
  const fieldsToCheck = requestedField
    ? [requestedField, ...pool.filter((field) => field !== requestedField)]
    : pool;

  if (availableFields.length === 0) {
    return `Nao encontrei campos de ${intent === 'list_location' ? 'localizacao' : 'contato'} em ${tableLabel}.`;
  }
  if (requestedField && !availableFields.includes(requestedField)) {
    return `Nao ha campo ${requestedField} em ${tableLabel}. Tenho apenas: ${availableFields.join(', ')}.`;
  }

  const lines = (rows || []).map((row) => {
    const rowId = idField ? row?.[idField] : '';
    const label = labelMap.get(String(rowId)) || buildDisplayLabel(plan?.table, row);
    const field = fieldsToCheck.find((name) => row?.[name]);
    const value = field ? row?.[field] : '';
    return { label, field: field || '', value: value || '' };
  });

  const hasAnyContact = lines.some((item) => item.value);
  if (!hasAnyContact) {
    const suggestions = buildSuggestions(plan);
    return [
      `Os itens selecionados nao possuem ${intent === 'list_location' ? 'localizacao' : 'contatos'} registrados em ${tableLabel}.`,
      'Sugestoes de consulta:',
      `1) ${suggestions[0]}`,
      `2) ${suggestions[1]}`,
      `3) ${suggestions[2]}`
    ].join('\n');
  }

  let header = 'Segue os contatos:';
  if (intent === 'list_location') {
    header = requestedField ? `Aqui esta a ${requestedField}:` : 'Aqui esta a localizacao:';
  } else if (requestedField) {
    header = `Segue os ${requestedField}:`;
  }
  const contactLines = lines
    .filter((item) => item.value)
    .map((item) => `- ${item.label}: ${item.value}`);
  const actionableContactLines = intent === 'list_contacts'
    ? (rows || []).map((row) => buildActionableContactLine(row, plan?.table, idField, labelMap, fieldsToCheck))
    : [];
  const missingContacts = actionableContactLines.filter((item) => !item.hasContact).length;
  const totalContext = Number(lastContext?.count || 0);
  const limitNote = totalContext > rows.length
    ? `Mostrei ${rows.length} de ${totalContext}. Posso refinar por bairro ou status se precisar.`
    : '';
  const missingNote = missingContacts > 0
    ? `${missingContacts} cadastro(s) sem telefone/email.`
    : '';
  const outputLines = actionableContactLines.length > 0
    ? actionableContactLines.map((item) => item.line)
    : contactLines;
  return [header, ...outputLines, missingNote, limitNote].filter(Boolean).join('\n');
}

function buildLastContext(traceId, plan, rows, countOverride) {
  const table = plan?.table || '';
  const idField = pickIdField(rows, table);
  const ids = (rows || [])
    .map((row) => (idField ? row?.[idField] : null))
    .filter(Boolean)
    .slice(0, 20);
  const names = (rows || [])
    .map((row) => row?.nome || row?.titulo || row?.protocolo)
    .filter(Boolean)
    .slice(0, 20);
  const displayList = buildDisplayList(table, rows, idField);
  const shown = displayList.map((item) => ({ id: item.id, label: item.label, idField: item.idField }));
  const countValue = typeof countOverride === 'number' ? countOverride : (rows?.length || 0);
  const currentLocation = getLocationFromPlan(plan);

  return {
    traceId,
    currentLocation,
    table,
    idField,
    count: countValue,
    shown,
    lastPlan: {
      action: plan?.action || 'none',
      table,
      search: plan?.search || '',
      filters: plan?.filters || {}
    },
    lastResultMeta: {
      table,
      count: countValue,
      idField,
      ids,
      nomes: names
    },
    displayList
  };
}

function buildConversationContextBlock(context) {
  if (!context) return '';
  const plan = context.lastPlan || { table: context.table || '', action: 'list', search: '' };
  const itemsSource = context.displayList || context.shown || [];
  const items = (itemsSource || [])
    .map((item, index) => {
      const idPart = item.id ? `${item.idField || 'id'}=${item.id}` : 'sem id';
      return `${index + 1}) ${item.label || item.nome || item.titulo || 'Sem titulo'} (${idPart})`;
    })
    .join('\n');
  const fields = snippetFields[plan.table] || [];
  const contactFields = getContactFieldsForTable(plan.table);
  const fieldList = Array.from(new Set([...fields, ...contactFields])).slice(0, 8).join(', ');

  return [
    `Cidade atual: ${context.currentLocation || '-'}\n`,
    `Ultima consulta: tabela=${plan.table} action=${plan.action} search=${plan.search || '-'}\n`,
    `Itens retornados (ate 3):\n${items || '-'}`,
    `Campos principais: ${fieldList || 'nao informado'}`
  ].join('\n');
}

function applyFollowUpOverrides(plan, followUp, context) {
  if (!followUp?.isFollowUp || !context?.lastPlan?.table) return plan;
  const updated = { ...plan };
  updated.table = updated.table || context.lastPlan.table;
  updated.action = updated.action === 'none' ? (followUp.wantsContacts ? 'list_contacts' : 'detail') : updated.action;
  updated.filters = { ...(updated.filters || {}) };

  const idField = context.lastResultMeta?.idField || 'id';
  const ids = Array.isArray(context.lastResultMeta?.ids) ? context.lastResultMeta.ids : [];

  if (followUp.ordinalIndex !== null && ids[followUp.ordinalIndex]) {
    updated.filters.ids = [ids[followUp.ordinalIndex]];
    updated.filters.id_field = idField;
  } else if (ids.length > 0 && !updated.filters.ids) {
    updated.filters.ids = ids;
    updated.filters.id_field = idField;
  }

  if ((!updated.search || updated.search === '') && ids.length === 0 && context.displayList?.length) {
    const targetIndex = followUp.ordinalIndex ?? 0;
    const label = context.displayList[targetIndex]?.label;
    if (label) updated.search = label;
  }

  return updated;
}

function buildSnippets(plan, rows, question) {
  if (!rows || rows.length === 0) return [];
  const table = plan.table;
  const fields = getSnippetFieldsForPlan(plan, table);
  const searchTerm = normalizeForMatch(plan.search || extractLocationTerm(question) || '');
  const maxLen = 72;

  return rows.map((row) => {
    let field = '';
    if (searchTerm) {
      field = fields.find((name) => normalizeForMatch(row?.[name]).includes(searchTerm)) || '';
    }
    if (!field) {
      field = fields.find((name) => row?.[name]) || fields[0] || '';
    }

    const label = field || 'registro';
    const rawValue = field ? row?.[field] : row;
    const formatted = formatValue(rawValue, table, field);
    const value = shortenText(formatted, maxLen);
    const matched = searchTerm && normalizeForMatch(rawValue).includes(searchTerm);
    const matchTag = matched ? ' (match)' : '';
    return `${label}: ${value}${matchTag}`;
  });
}

function buildPlanSummary(plan) {
  if (!plan || plan.action === 'none') return 'consulta geral';
  const parts = [];
  if (plan.search) parts.push(`busca "${plan.search}"`);
  const filters = plan.filters || {};
  if (filters.status) parts.push(`status ${filters.status}`);
  if (filters.municipio) parts.push(`municipio ${filters.municipio}`);
  if (filters.cidade) parts.push(`cidade ${filters.cidade}`);
  if (filters.bairro) parts.push(`bairro ${filters.bairro}`);
  if (filters.data_from || filters.data_to) {
    const from = filters.data_from || '-';
    const to = filters.data_to || '-';
    parts.push(`periodo ${from} a ${to}`);
  }
  return parts.length ? parts.join(', ') : 'consulta geral';
}

function countPhraseForTable(table) {
  const phrases = {
    campanhas: { noun: 'campanhas', suffix: 'cadastradas' },
    agenda_eventos: { noun: 'eventos na agenda', suffix: 'cadastrados' },
    liderancas: { noun: 'liderancas', suffix: 'cadastradas' },
    eleitores: { noun: 'eleitores', suffix: 'cadastrados' },
    funcionarios: { noun: 'funcionarios', suffix: 'cadastrados' },
    atendimentos: { noun: 'atendimentos', suffix: 'cadastrados' },
    solicitacoes: { noun: 'solicitacoes', suffix: 'cadastradas' },
    emendas: { noun: 'emendas', suffix: 'cadastradas' },
    orgaos: { noun: 'orgaos', suffix: 'cadastrados' },
    repasses: { noun: 'repasses', suffix: 'cadastrados' },
    financeiro_lancamentos: { noun: 'lancamentos financeiros', suffix: 'cadastrados' },
    financeiro_despesas: { noun: 'despesas', suffix: 'cadastradas' },
    financeiro_parceiros: { noun: 'parceiros financeiros', suffix: 'cadastrados' },
    documentos: { noun: 'documentos', suffix: 'cadastrados' },
    notificacoes: { noun: 'notificacoes', suffix: 'cadastradas' },
    geolocalizacao: { noun: 'marcadores no mapa', suffix: 'cadastrados' },
    aniversariantes: { noun: 'aniversariantes', suffix: 'monitorados' }
  };
  return phrases[table] || { noun: labelForTable(table), suffix: 'cadastrados' };
}

function buildSuggestions(plan) {
  const table = plan?.table || '';
  const suggestionsByTable = {
    campanhas: [
      'Listar campanhas mais recentes',
      'Buscar campanhas por municipio (ex: "campanhas em Belem")',
      'Buscar campanhas por status (ex: "campanhas em planejamento")'
    ],
    agenda_eventos: [
      'Listar eventos desta semana',
      'Buscar agenda por municipio (ex: "eventos em Belem")',
      'Buscar eventos por tipo (ex: "eventos de reuniao")'
    ],
    liderancas: [
      'Listar liderancas ativas',
      'Buscar liderancas por nome',
      'Buscar liderancas por telefone'
    ],
    eleitores: [
      'Buscar eleitores por cidade',
      'Buscar eleitores por bairro',
      'Listar eleitores recentes'
    ],
    atendimentos: [
      'Listar atendimentos recentes',
      'Buscar atendimentos por protocolo',
      'Contar atendimentos por status'
    ],
    solicitacoes: [
      'Listar solicitacoes recentes',
      'Buscar solicitacoes por municipio',
      'Buscar solicitacoes por status'
    ]
  };

  const fallback = [
    'Listar registros recentes',
    'Buscar por municipio ou cidade',
    'Buscar por status'
  ];

  return suggestionsByTable[table] || fallback;
}

function buildClarificationQuestion(plan) {
  const table = plan?.table || '';
  if (['campanhas', 'agenda_eventos', 'solicitacoes'].includes(table)) {
    return 'Qual municipio devo considerar?';
  }
  if (table === 'eleitores') {
    return 'Qual cidade ou bairro devo considerar?';
  }
  if (table === 'atendimentos') {
    return 'Qual periodo ou status devo considerar?';
  }
  if (table === 'liderancas') {
    return 'Qual nome ou telefone devo buscar?';
  }
  return 'Qual termo devo buscar (nome, protocolo ou titulo)?';
}

function buildClarificationOnlyResponse() {
  const suggestions = buildSuggestions({ table: '' });
  return [
    'Para ajudar melhor, preciso de um detalhe a mais.',
    'Sugestoes de consulta:',
    `1) ${suggestions[0]}`,
    `2) ${suggestions[1]}`,
    `3) ${suggestions[2]}`,
    'Qual modulo voce quer consultar (campanhas, agenda, liderancas, eleitores, atendimentos, solicitacoes)?'
  ].join('\n');
}

function buildAnswerLocal(plan, rows, meta, question) {
  const tableLabel = labelForTable(plan?.table);
  const snippets = meta?.snippets || buildSnippets(plan, rows, question);

  if (plan?.action === 'count') {
    const total = meta?.count || 0;
    const scope = buildPlanSummary(plan);
    const scopeText = scope === 'consulta geral' ? '' : ` com ${scope}`;
    const phrase = countPhraseForTable(plan?.table);
    return `Temos ${total} ${phrase.noun} ${phrase.suffix}${scopeText}.`;
  }

  if (!rows || rows.length === 0) {
    const summary = buildPlanSummary(plan);
    const suggestions = buildSuggestions(plan);
    const questionText = buildClarificationQuestion(plan);

    return [
      `Nao encontrei resultados para ${tableLabel} com ${summary}.`,
      'Sugestoes de consulta:',
      `1) ${suggestions[0]}`,
      `2) ${suggestions[1]}`,
      `3) ${suggestions[2]}`,
      questionText
    ].join('\n');
  }

  const limit = Math.min(rows.length, plan?.limit || 5, 5);
  const evidence = snippets.slice(0, limit).map((item) => `- ${item}`).join('\n');
  const shownNote = rows.length > limit ? `Mostrando ${limit} de ${rows.length}.` : '';

  return [
    `Encontrei ${rows.length} ${rows.length === 1 ? 'resultado' : 'resultados'} em ${tableLabel}.`,
    evidence,
    shownNote
  ].filter(Boolean).join('\n');
}

function answerIncludesEvidence(answer, snippets) {
  if (!snippets || snippets.length === 0) return true;
  const normalized = normalizeForMatch(answer);
  return snippets.some((item) => normalized.includes(normalizeForMatch(item)));
}

function answerIncludesSuggestions(answer) {
  return /1\)/.test(answer) && /2\)/.test(answer) && /3\)/.test(answer);
}

async function buildAnswer(plan, rows, meta, question, provider, historyMessages, conversationContextBlock) {
  const allSnippets = meta?.snippets || buildSnippets(plan, rows, question);
  const limit = Math.min(allSnippets.length || 0, plan?.limit || 5, 5);
  const snippets = allSnippets.slice(0, limit);
  const tableLabel = labelForTable(plan?.table);
  const planSummary = buildPlanSummary(plan);
  const suggestions = buildSuggestions(plan);
  const clarifyingQuestion = buildClarificationQuestion(plan);
  const totalCount = plan?.action === 'count' ? (meta?.count || 0) : (rows?.length || 0);
  const context = {
    pergunta: question,
    tabela: tableLabel,
    acao: plan?.action || 'none',
    total: totalCount,
    contagem: meta?.count ?? null,
    resumoConsulta: planSummary,
    filtros: plan?.filters || {},
    search: plan?.search || '',
    evidencias: snippets,
    sugestoes: suggestions,
    perguntaClarificacao: clarifyingQuestion
  };

  if (!provider?.apiKey) {
    return buildAnswerLocal(plan, rows, { ...meta, snippets }, question);
  }

  const payload = {
    model: provider.model,
    temperature: 0.2,
    max_tokens: 240,
    messages: buildAnswerMessages(context, historyMessages, conversationContextBlock)
  };

  try {
    const data = await callChatCompletion(provider, payload);
    const answer = String(data.choices?.[0]?.message?.content || '').trim();
    if (!answer) return buildAnswerLocal(plan, rows, { ...meta, snippets }, question);
    if (plan?.action === 'count' && meta?.count !== undefined) {
      const countText = String(meta.count);
      if (!answer.includes(countText)) {
        return buildAnswerLocal(plan, rows, { ...meta, snippets }, question);
      }
    }
    if (rows && rows.length > 0 && !answerIncludesEvidence(answer, snippets)) {
      return buildAnswerLocal(plan, rows, { ...meta, snippets }, question);
    }
    if (plan?.action !== 'count' && (!rows || rows.length === 0) && !answerIncludesSuggestions(answer)) {
      return buildAnswerLocal(plan, rows, { ...meta, snippets }, question);
    }
    return answer;
  } catch (error) {
    return buildAnswerLocal(plan, rows, { ...meta, snippets }, question);
  }
}

async function gerarPlanoConsulta(question, provider, historyMessages, conversationContextBlock) {
  const payload = {
    model: provider.model,
    temperature: 0,
    max_tokens: 200,
    messages: buildPlannerMessages(question, historyMessages, conversationContextBlock)
  };

  const data = await callChatCompletion(provider, payload);
  const content = data.choices?.[0]?.message?.content || '';

  try {
    return { plan: JSON.parse(content), raw: content, repaired: false };
  } catch (error) {
    const repairPayload = {
      model: provider.model,
      temperature: 0,
      max_tokens: 200,
      messages: [
        { role: 'system', content: PLANNER_REPAIR_PROMPT },
        { role: 'user', content: `Pergunta: ${question}\nContexto da conversa: ${conversationContextBlock || '-'}\nJSON invalido: ${content}` }
      ]
    };

    const repairData = await callChatCompletion(provider, repairPayload);
    const repairContent = repairData.choices?.[0]?.message?.content || '';
    try {
      return { plan: JSON.parse(repairContent), raw: repairContent, repaired: true };
    } catch (err) {
      return { plan: { action: 'none', reason: 'Falha ao interpretar a pergunta.' }, raw: repairContent, repaired: true };
    }
  }
}

function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object') return { action: 'none' };
  const actionRaw = String(plan.action || '').toLowerCase();
  const actionAliases = {
    listar: 'list',
    lista: 'list',
    buscar: 'search',
    procura: 'search',
    pesquisar: 'search',
    contar: 'count',
    quantidade: 'count',
    detalhar: 'detail',
    detalhe: 'detail',
    contatos: 'list_contacts'
  };
  const action = actionAliases[actionRaw] || actionRaw;
  if (!['list', 'search', 'count', 'detail', 'list_contacts', 'prioritize', 'none'].includes(action)) return { action: 'none' };
  if (action === 'none') return { action };

  const tableRaw = String(plan.table || '').toLowerCase();
  const tableAliases = {
    campanha: 'campanhas',
    campanhas: 'campanhas',
    agenda: 'agenda_eventos',
    evento: 'agenda_eventos',
    eventos: 'agenda_eventos',
    lideranca: 'liderancas',
    liderancas: 'liderancas',
    funcionario: 'funcionarios',
    funcionarios: 'funcionarios',
    equipe: 'funcionarios',
    eleitor: 'eleitores',
    eleitores: 'eleitores',
    atendimento: 'atendimentos',
    atendimentos: 'atendimentos',
    solicitacao: 'solicitacoes',
    solicitacoes: 'solicitacoes',
    emenda: 'emendas',
    emendas: 'emendas',
    orgao: 'orgaos',
    orgaos: 'orgaos',
    repasse: 'repasses',
    repasses: 'repasses',
    documento: 'documentos',
    documentos: 'documentos',
    notificacao: 'notificacoes',
    notificacoes: 'notificacoes',
    mapa: 'geolocalizacao',
    geolocalizacao: 'geolocalizacao',
    aniversariante: 'aniversariantes',
    aniversariantes: 'aniversariantes',
    aniversario: 'aniversariantes',
    aniversarios: 'aniversariantes',
    despesas: 'financeiro_despesas',
    despesa: 'financeiro_despesas',
    lancamentos: 'financeiro_lancamentos',
    lancamento: 'financeiro_lancamentos',
    receitas: 'financeiro_lancamentos',
    parceiros: 'financeiro_parceiros',
    parceiro: 'financeiro_parceiros',
    financeiro: 'financeiro_lancamentos'
  };
  const table = tableAliases[tableRaw] || tableRaw;
  if (!allowedTables[table]) return { action: 'none' };

  const limit = Math.min(parseInt(plan.limit || 5, 10) || 5, 20);
  const order = String(plan.order || 'date_desc');

  const filters = plan.filters || {};
  const idField = plan.id_field || plan.idField || filters.id_field || filters.idField || '';

  return {
    action,
    table,
    filters,
    search: plan.search || '',
    idField,
    limit,
    order
  };
}

function normalizeTextValue(value) {
  return String(value || '')
    .replace(/[\?\!\.,;:"'`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForMatch(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekRange(baseDate) {
  const day = baseDate.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(baseDate);
  start.setDate(baseDate.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { from: formatDateOnly(start), to: formatDateOnly(end) };
}

function getMonthRange(baseDate) {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { from: formatDateOnly(start), to: formatDateOnly(end) };
}

function extractDateRange(text) {
  const normalized = normalizeForMatch(text);
  const today = new Date();

  if (/(hoje)/.test(normalized)) {
    const date = formatDateOnly(today);
    return { from: date, to: date };
  }
  if (/(amanha|amanha)/.test(normalized)) {
    const date = new Date(today);
    date.setDate(date.getDate() + 1);
    const value = formatDateOnly(date);
    return { from: value, to: value };
  }
  if (/(ontem)/.test(normalized)) {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    const value = formatDateOnly(date);
    return { from: value, to: value };
  }

  if (/(esta semana|nesta semana|desta semana|semana atual)/.test(normalized)) {
    return getWeekRange(today);
  }
  if (/(semana passada|ultima semana|semana anterior)/.test(normalized)) {
    const base = new Date(today);
    base.setDate(base.getDate() - 7);
    return getWeekRange(base);
  }
  if (/(semana que vem|proxima semana)/.test(normalized)) {
    const base = new Date(today);
    base.setDate(base.getDate() + 7);
    return getWeekRange(base);
  }

  if (/(este mes|neste mes|mes atual)/.test(normalized)) {
    return getMonthRange(today);
  }
  if (/(mes passado|ultimo mes)/.test(normalized)) {
    const base = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return getMonthRange(base);
  }

  return null;
}

function applyDateRangeIfMissing(plan, message) {
  if (!plan || plan.action === 'none') return plan;
  const existing = plan.filters || {};
  if (existing.data_from || existing.data_to) return plan;
  const range = extractDateRange(message);
  if (!range) return plan;
  return {
    ...plan,
    filters: {
      ...existing,
      data_from: range.from,
      data_to: range.to
    }
  };
}

function buildSearchVariants(value) {
  const base = normalizeTextValue(value);
  if (!base) return [];
  const normalized = normalizeForMatch(base);
  const variants = new Set();
  variants.add(base);
  if (normalized && normalized !== base) variants.add(normalized);
  if (!base.includes(' ') && base.length > 3) {
    if (base.endsWith('s')) {
      variants.add(base.slice(0, -1));
    } else {
      variants.add(`${base}s`);
    }
  }
  const synonyms = searchSynonyms[normalized] || searchSynonyms[base] || [];
  synonyms.forEach((item) => {
    const clean = normalizeTextValue(item);
    if (clean) variants.add(clean);
  });
  return Array.from(variants).slice(0, 3);
}

function getPrimarySearchFields(table) {
  if (table === 'campanhas') return ['nome', 'municipio', 'local'];
  if (table === 'agenda_eventos') return ['titulo', 'municipio', 'local'];
  if (table === 'solicitacoes') return ['titulo', 'protocolo', 'municipio', 'bairro'];
  if (table === 'liderancas') return ['nome', 'telefone', 'email', 'cidade', 'bairro', 'influencia'];
  if (table === 'eleitores') return ['nome', 'cidade', 'bairro'];
  if (table === 'funcionarios') return ['nome', 'telefone', 'email', 'cargo', 'departamento', 'cidade', 'bairro'];
  if (table === 'atendimentos') return ['protocolo', 'assunto'];
  if (table === 'emendas') return ['numero_emenda', 'titulo', 'beneficiarios', 'status'];
  if (table === 'orgaos') return ['nome', 'sigla', 'responsavel', 'email', 'telefone'];
  if (table === 'repasses') return ['status', 'observacoes'];
  if (table === 'financeiro_lancamentos') return ['codigo', 'tipo', 'categoria', 'parceiro_nome', 'descricao', 'status'];
  if (table === 'financeiro_despesas') return ['codigo', 'tipo', 'categoria', 'fornecedor_nome', 'descricao', 'status'];
  if (table === 'financeiro_parceiros') return ['codigo', 'nome', 'tipo', 'email', 'telefone', 'status'];
  if (table === 'documentos') return ['titulo', 'tipo', 'categoria'];
  if (table === 'notificacoes') return ['titulo', 'mensagem'];
  if (table === 'geolocalizacao') return ['nome', 'tipo', 'cidade', 'bairro', 'endereco'];
  if (table === 'aniversariantes') return ['eleitor_id', 'mes'];
  const fallback = allowedTables[table]?.searchField;
  return fallback ? [fallback] : [];
}

function isSearchableField(field) {
  if (!field) return false;
  const value = String(field).toLowerCase();
  if (value === 'id' || value.endsWith('_id')) return false;
  if (value.includes('data') || value.includes('hora')) return false;
  return true;
}

function parseFieldsList(fields) {
  return String(fields || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getFallbackSearchFields(table) {
  const base = getPrimarySearchFields(table);
  const fromConfig = parseFieldsList(allowedTables[table]?.fields);
  const merged = Array.from(new Set([...base, ...fromConfig]));
  return merged.filter(isSearchableField);
}

function buildSearchOrClause(fields, variants) {
  const clauses = [];
  fields.forEach((field) => {
    variants.forEach((term) => {
      if (!term) return;
      const value = `*${term}*`;
      clauses.push(`${field}.ilike.${value}`);
    });
  });
  return clauses.join(',');
}

function applySearchWithFields(query, table, searchValue, fieldsOverride) {
  const variants = buildSearchVariants(searchValue);
  if (!variants.length) return query;
  const fields = fieldsOverride && fieldsOverride.length > 0 ? fieldsOverride : getPrimarySearchFields(table);
  const orClause = buildSearchOrClause(fields, variants);
  if (orClause) return query.or(orClause);
  return query;
}

function extractLocationTerm(text) {
  const raw = String(text || '');
  const segments = raw
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
  const extractFrom = (value) => {
    const clean = normalizeTextValue(value);
    const match = clean.match(/\b(?:em|no|na|para)\s+([^|]+)$/i);
    return match ? match[1].trim() : '';
  };
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const cleaned = segments[i]
      .replace(/^Contexto recente:/i, '')
      .replace(/^Pergunta atual:/i, '')
      .trim();
    const term = extractFrom(cleaned);
    if (term) return term;
  }
  return '';
}

function shouldClarifyQuestion(message, history) {
  if (!isVagueQuestion(message)) return false;
  const keywords = [
    'campanha', 'campanhas', 'agenda', 'evento', 'eventos',
    'lideranca', 'liderancas', 'eleitor', 'eleitores',
    'atendimento', 'atendimentos', 'solicitacao', 'solicitacoes'
  ];
  const lastRelevant = findLastRelevantMessage(history, keywords);
  return !lastRelevant;
}

function isVagueQuestion(text) {
  const value = String(text || '').trim().toLowerCase();
  if (!value) return true;
  if (value.length <= 12) return true;
  return /^(ok|certo|isso|essa|esse|ele|ela|agora|veja|veja se|tem|tem\?|pode|pode\?|sim|nao)$/.test(value);
}

function getUserMessages(history) {
  const safeHistory = Array.isArray(history) ? history : [];
  return safeHistory
    .filter(item => item?.role === 'user' && item?.content)
    .map(item => String(item.content));
}

function findLastRelevantMessage(history, keywords) {
  const messages = getUserMessages(history);
  if (messages.length === 0) return '';
  const normalizedKeywords = keywords.map(item => normalizeForMatch(item));
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const normalized = normalizeForMatch(messages[i]);
    if (normalizedKeywords.some(key => normalized.includes(key))) {
      return messages[i];
    }
  }
  return messages[messages.length - 1] || '';
}

function shouldPreferList(message) {
  const normalized = normalizeForMatch(message);
  if (/(quantos|quantas|quantidade|numero|total)/.test(normalized)) return false;
  return /(qual|quais|titulo|lista|listar|mostra|mostrar|exiba|exibir|tem|temos|ha|existe)/.test(normalized);
}

function buildQuestionWithContext(message, history) {
  const keywords = [
    'campanha', 'campanhas', 'agenda', 'evento', 'eventos',
    'lideranca', 'liderancas', 'eleitor', 'eleitores',
    'atendimento', 'atendimentos', 'solicitacao', 'solicitacoes'
  ];
  const userMessages = getUserMessages(history);
  const lastRelevant = findLastRelevantMessage(history, keywords);

  if (isVagueQuestion(message) && lastRelevant) {
    return `${lastRelevant}\nPergunta atual: ${message}`;
  }
  if (userMessages.length >= 3) {
    const recent = userMessages.slice(-3).join(' | ');
    return `Contexto recente: ${recent}\nPergunta atual: ${message}`;
  }
  if (userMessages.length >= 2) {
    const recent = userMessages.slice(-2).join(' | ');
    return `Contexto recente: ${recent}\nPergunta atual: ${message}`;
  }
  return message;
}

function buildPlannerMessages(question, historyMessages, conversationContextBlock) {
  const messages = [{ role: 'system', content: PLANNER_PROMPT }];
  if (Array.isArray(historyMessages) && historyMessages.length > 0) {
    messages.push(...historyMessages.slice(0, 2));
  }
  const contextText = conversationContextBlock
    ? `${question}\n\nContexto da conversa:\n${conversationContextBlock}`
    : question;
  messages.push({ role: 'user', content: contextText });
  return messages;
}

function buildAnswerMessages(context, historyMessages, conversationContextBlock) {
  const messages = [{ role: 'system', content: ANSWER_PROMPT }];
  if (Array.isArray(historyMessages) && historyMessages.length > 0) {
    messages.push(...historyMessages.slice(0, 2));
  }
  const payload = {
    ...context,
    contextoConversa: conversationContextBlock || ''
  };
  messages.push({ role: 'user', content: JSON.stringify(payload) });
  return messages;
}

function quickIntentPlan(message, history, lastContext) {
  const text = String(message || '').trim();
  if (!text) return null;

  const table = detectTableFromText(text);
  if (!table) return null;

  const normalized = normalizeForMatch(text);
  const countRegex = /(quantos|quantas|total|contagem|quantidade|numero)/;
  const listRegex = /(quais|listar|liste|mostre|exiba|tem|temos|ha|existe)/;
  const priorityRegex = /(prioridade|priorizar|priorize|procurar primeiro|falar primeiro|acionar primeiro|quem devo procurar|quem devo falar|mais importante|mais fortes|principais)/;

  let action = '';
  if (priorityRegex.test(normalized)) action = 'prioritize';
  else if (countRegex.test(normalized)) action = 'count';
  else if (listRegex.test(normalized)) action = 'list';
  else action = 'search';

  const filters = {};
  const location = extractLocationTerm(text) || (refersToCurrentLocation(text) ? lastContext?.currentLocation : '');
  if (location) {
    if (['campanhas', 'agenda_eventos', 'solicitacoes'].includes(table)) {
      filters.municipio = location;
    } else if (['eleitores', 'liderancas', 'funcionarios', 'geolocalizacao'].includes(table)) {
      if (normalized.includes('bairro')) {
        filters.bairro = location;
      } else {
        filters.cidade = location;
      }
    }
  }

  let search = '';
  const namedMatch = text.match(/\b(nome|protocolo|titulo)\s+([^\n]+)$/i);
  if (namedMatch && namedMatch[2]) {
    search = normalizeTextValue(namedMatch[2]);
    action = 'search';
  }

  const plan = {
    action,
    table,
    filters,
    search,
    limit: 5,
    order: 'date_desc'
  };

  const hasFilters = Object.keys(filters).length > 0;
  const hasSearch = Boolean(search);
  const reason = hasSearch
    ? 'quick:search'
    : (hasFilters ? 'quick:filters' : `quick:${action}`);

  return { plan, reason };
}

function buildSelectFields(plan, table) {
  const baseFields = parseFieldsList(allowedTables[table]?.fields);
  if (baseFields.length === 0) return allowedTables[table]?.fields || '*';
  if (plan?.action === 'list_contacts') {
    const contactFields = getContactFieldsForTable(table);
    if (contactFields.length === 0) {
      return baseFields.join(', ');
    }
    const idField = baseFields.includes('id') ? ['id'] : [];
    const labelFields = ['nome', 'titulo', 'protocolo'].filter((field) => baseFields.includes(field));
    const merged = Array.from(new Set([...idField, ...labelFields, ...contactFields]));
    return merged.join(', ');
  }
  if (plan?.action === 'list_location') {
    const locationFields = getLocationFieldsForTable(table);
    if (locationFields.length === 0) {
      return baseFields.join(', ');
    }
    const idField = baseFields.includes('id') ? ['id'] : [];
    const merged = Array.from(new Set([...idField, ...locationFields]));
    return merged.join(', ');
  }
  if (plan?.action === 'prioritize') {
    const priorityFields = ['influencia', 'telefone', 'email', 'cidade', 'bairro', 'status'].filter((field) => baseFields.includes(field));
    const idField = baseFields.includes('id') ? ['id'] : [];
    const labelFields = ['nome', 'titulo', 'protocolo'].filter((field) => baseFields.includes(field));
    const merged = Array.from(new Set([...idField, ...labelFields, ...priorityFields]));
    return merged.join(', ');
  }
  return allowedTables[table].fields;
}

function applyFilters(query, table, plan) {
  const config = allowedTables[table];
  const filters = plan.filters || {};
  if (filters.ids) {
    const idField = plan.idField || filters.id_field || filters.idField || 'id';
    const ids = Array.isArray(filters.ids)
      ? filters.ids
      : String(filters.ids).split(',').map((item) => item.trim()).filter(Boolean);
    const limitedIds = ids.slice(0, 20);
    if (limitedIds.length > 0) {
      query = query.in(idField, limitedIds);
    }
  }
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.municipio && ['campanhas', 'agenda_eventos', 'solicitacoes'].includes(table)) {
    const municipioValue = normalizeTextValue(filters.municipio);
    const value = `*${municipioValue}*`;
    if (['campanhas', 'agenda_eventos'].includes(table)) {
      query = query.or(`municipio.ilike.${value},local.ilike.${value}`);
    } else {
      query = query.ilike('municipio', `%${municipioValue}%`);
    }
  }
  if (filters.cidade && ['eleitores', 'liderancas', 'funcionarios', 'geolocalizacao'].includes(table)) {
    const cidadeValue = normalizeTextValue(filters.cidade);
    query = query.ilike('cidade', `%${cidadeValue}%`);
  }
  if (filters.bairro && ['eleitores', 'liderancas', 'funcionarios', 'geolocalizacao', 'solicitacoes'].includes(table)) {
    const bairroValue = normalizeTextValue(filters.bairro);
    query = query.ilike('bairro', `%${bairroValue}%`);
  }
  if (filters.data_from) query = query.gte(config.dateField, filters.data_from);
  if (filters.data_to) query = query.lte(config.dateField, filters.data_to);

  if (plan.search) {
    query = applySearchWithFields(query, table, plan.search, getPrimarySearchFields(table));
  }

  if (plan.action === 'prioritize' && table === 'liderancas') {
    query = query
      .order('influencia', { ascending: false })
      .order(config.dateField, { ascending: false });
    return query;
  }

  const ascending = plan.order === 'date_asc';
  query = query.order(config.dateField, { ascending });
  return query;
}

async function tryFallbackCampaigns(supabase, question, history, limit) {
  const lastRelevant = findLastRelevantMessage(history, ['campanha', 'campanhas']);
  const hasCampaign = normalizeForMatch(question).includes('campanha') || normalizeForMatch(lastRelevant).includes('campanha');
  if (!hasCampaign) return null;

  const baseTerm = extractLocationTerm(question) || extractLocationTerm(lastRelevant) || question;
  const term = normalizeTextValue(baseTerm);
  const cleaned = term.replace(/^(tem|temos|existe|ha|há|veja se tem|veja se|verifique se)\s+/i, '').trim();
  const searchTerm = cleaned.split(' ').slice(0, 6).join(' ').trim();
  if (!searchTerm) return null;

  const searchValue = `*${searchTerm}*`;
  let query = supabase
    .from('campanhas')
    .select(allowedTables.campanhas.fields)
    .limit(Math.min(limit || 5, 20));

  query = query.or(`nome.ilike.${searchValue},municipio.ilike.${searchValue},local.ilike.${searchValue}`);
  query = query.order(allowedTables.campanhas.dateField, { ascending: false });

  const { data, error } = await query;
  if (error || !data || data.length === 0) return null;

  return {
    plan: {
      action: 'search',
      table: 'campanhas',
      filters: {},
      search: searchTerm,
      limit: Math.min(limit || 5, 20),
      order: 'date_desc'
    },
    data
  };
}

async function tryFallbackListAll(supabase, table, limit) {
  if (!allowedTables[table]) return null;
  const safeLimit = Math.min(limit || 5, 20);
  let query = supabase
    .from(table)
    .select(allowedTables[table].fields)
    .limit(safeLimit);

  query = query.order(allowedTables[table].dateField, { ascending: false });
  const { data, error } = await query;
  if (error || !data || data.length === 0) return null;

  return {
    plan: {
      action: 'list',
      table,
      filters: {},
      search: '',
      limit: safeLimit,
      order: 'date_desc'
    },
    data
  };
}

async function tryFallbackTextSearch(supabase, plan, question, limit) {
  if (!plan?.table) return null;
  const baseTerm = plan.search || extractLocationTerm(question) || '';
  const variants = buildSearchVariants(baseTerm);
  if (!variants.length) return null;

  const safeLimit = Math.min(limit || 5, 20);
  const fields = getFallbackSearchFields(plan.table);
  if (!fields.length) return null;

  let query = supabase
    .from(plan.table)
    .select(allowedTables[plan.table].fields)
    .limit(safeLimit);

  const planWithoutSearch = { ...plan, search: '' };
  query = applyFilters(query, plan.table, planWithoutSearch);
  query = applySearchWithFields(query, plan.table, baseTerm, fields);
  query = query.order(allowedTables[plan.table].dateField, { ascending: false });

  const { data, error } = await query;
  if (error || !data || data.length === 0) return null;

  return {
    plan: {
      ...plan,
      search: baseTerm,
      limit: safeLimit
    },
    data
  };
}

function buildRelaxedFilters(filters) {
  const relaxed = { ...(filters || {}) };
  delete relaxed.status;
  delete relaxed.bairro;
  delete relaxed.cidade;
  delete relaxed.municipio;
  delete relaxed.data_from;
  delete relaxed.data_to;
  return relaxed;
}

async function tryFallbackRelaxFilters(supabase, plan, limit) {
  if (!plan?.table) return null;
  if (!plan.search) return null;
  const relaxedFilters = buildRelaxedFilters(plan.filters || {});
  if (Object.keys(relaxedFilters).length === Object.keys(plan.filters || {}).length) return null;

  const safeLimit = Math.min(limit || 5, 20);
  let query = supabase
    .from(plan.table)
    .select(allowedTables[plan.table].fields)
    .limit(safeLimit);

  const relaxedPlan = { ...plan, filters: relaxedFilters };
  query = applyFilters(query, plan.table, relaxedPlan);
  query = query.order(allowedTables[plan.table].dateField, { ascending: false });

  const { data, error } = await query;
  if (error || !data || data.length === 0) return null;

  return {
    plan: { ...relaxedPlan, limit: safeLimit },
    data
  };
}

function getLocationFromPlan(plan) {
  const filters = plan?.filters || {};
  return filters.cidade || filters.municipio || '';
}

function cleanCityName(value) {
  return normalizeTextValue(value)
    .replace(/\s*-\s*[a-z]{2}$/i, '')
    .replace(/\b(ce|pa|sp|rj|mg|ba|pe|pr|rs|sc|go|df|ma|pi|rn|pb|al|se|am|ac|ap|ro|rr|to|mt|ms|es)\b$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectCityArrival(message) {
  const text = normalizeTextValue(message);
  const patterns = [
    /\b(?:cheguei|chegamos|estou|estamos|to|vou estar|estarei|chegando)\s+(?:em|na|no|a)\s+(.+)$/i,
    /\b(?:cidade atual|cidade|local atual)\s*(?:e|:)?\s+(.+)$/i,
    /\b(?:briefing|resumo|panorama)\s+(?:de|da|do|em|na|no)\s+(.+)$/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const city = cleanCityName(match[1]);
      if (city && city.length > 2) return city;
    }
  }

  return '';
}

function refersToCurrentLocation(message) {
  const normalized = normalizeForMatch(message);
  return /(\baqui\b|\bnessa cidade\b|\bnesta cidade\b|\bna cidade\b|\bnesse municipio\b|\bneste municipio\b|\bno municipio\b|\bpor aqui\b)/.test(normalized);
}

function detectSystemBriefing(message) {
  const normalized = normalizeForMatch(message);
  return /(briefing geral|resumo geral|panorama geral|situacao geral|situação geral|resumo do sistema|como estamos|painel geral|me atualize|o que temos hoje|status geral)/.test(normalized);
}

function detectDataHealthBriefing(message) {
  const normalized = normalizeForMatch(message);
  return /(saude dos dados|qualidade dos dados|dados incompletos|cadastros incompletos|sem telefone|sem contato|sem coordenada|base incompleta|pendencias de dados)/.test(normalized);
}

function detectMissingDataList(message) {
  const normalized = normalizeForMatch(message);
  const wantsList = /(listar|liste|mostre|mostrar|quais|quem|abrir lista|me passe)/.test(normalized);
  if (!wantsList) return null;

  if (/(lideranca|liderancas)/.test(normalized) && /(sem contato|sem telefone|sem email|incomplet)/.test(normalized)) {
    return {
      table: 'liderancas',
      fields: ['telefone', 'email'],
      title: 'Liderancas sem telefone/email'
    };
  }

  if (/(funcionario|funcionarios|equipe)/.test(normalized) && /(sem contato|sem telefone|sem email|incomplet)/.test(normalized)) {
    return {
      table: 'funcionarios',
      fields: ['telefone', 'email'],
      title: 'Funcionarios sem telefone/email'
    };
  }

  if (/(eleitor|eleitores)/.test(normalized) && /(sem telefone|sem contato|incomplet)/.test(normalized)) {
    return {
      table: 'eleitores',
      fields: ['telefone'],
      title: 'Eleitores sem telefone'
    };
  }

  if (/(mapa|marcador|marcadores|geolocalizacao)/.test(normalized) && /(sem coordenada|sem latitude|sem longitude|incomplet)/.test(normalized)) {
    return {
      table: 'geolocalizacao',
      fields: ['latitude', 'longitude'],
      requireAll: true,
      title: 'Marcadores sem coordenada'
    };
  }

  return null;
}

function detectMessageDraftIntent(message) {
  const normalized = normalizeForMatch(message);
  const wantsDraft = /(mensagem|texto|rascunho|modelo|whatsapp|zap|comunicado)/.test(normalized)
    && /(prepar|escrev|gerar|montar|criar|suger|fazer|mande|enviar|envie)/.test(normalized);
  if (!wantsDraft) return null;

  if (/(aniversario|aniversariante|parabens)/.test(normalized)) {
    return { kind: 'birthday', table: 'aniversariantes' };
  }
  if (/(reuniao|agenda|encontro|visita)/.test(normalized)) {
    return { kind: 'meeting' };
  }
  if (/(solicitacao|solicitacoes|demanda|pedido)/.test(normalized)) {
    return { kind: 'request' };
  }
  return { kind: 'general' };
}

function detectFieldPlanIntent(message) {
  const normalized = normalizeForMatch(message);
  return /(roteiro|plano de acao|plano de campo|visita|visitar|agenda de campo|o que fazer primeiro|por onde comecar|proximos passos)/.test(normalized)
    && /(cidade|aqui|campo|lideranca|liderancas|solicitacao|solicitacoes|agenda|mapa|bairro|bairros|fortaleza|belem|municipio|municipio)/.test(normalized);
}

function applyLocationToPlan(plan, location) {
  if (!plan || plan.action === 'none' || !location) return plan;
  const table = plan.table;
  if (!allowedTables[table]) return plan;
  const filters = { ...(plan.filters || {}) };

  if (['liderancas', 'eleitores', 'funcionarios', 'geolocalizacao'].includes(table) && !filters.cidade && !filters.bairro) {
    filters.cidade = location;
  }
  if (['campanhas', 'agenda_eventos', 'solicitacoes'].includes(table) && !filters.municipio) {
    filters.municipio = location;
  }

  return { ...plan, filters };
}

function withContextLocation(newContext, lastContext, plan) {
  const currentLocation = getLocationFromPlan(plan) || newContext?.currentLocation || lastContext?.currentLocation || '';
  return { ...newContext, currentLocation };
}

async function countByCity(supabase, table, city, extra = {}) {
  let query = supabase
    .from(table)
    .select('id', { count: 'exact', head: true });

  const cityValue = cleanCityName(city);
  if (['liderancas', 'eleitores'].includes(table)) {
    query = query.ilike('cidade', `%${cityValue}%`);
  } else if (table === 'agenda_eventos') {
    query = query.or(`municipio.ilike.*${cityValue}*,local.ilike.*${cityValue}*`);
  } else if (table === 'solicitacoes') {
    query = query.ilike('municipio', `%${cityValue}%`);
  }

  if (extra.status) query = query.eq('status', extra.status);
  if (extra.dateField && extra.from) query = query.gte(extra.dateField, extra.from);
  if (extra.dateField && extra.to) query = query.lte(extra.dateField, extra.to);

  const { count, error } = await query;
  if (error) return { count: 0, error: error.message };
  return { count: count || 0, error: null };
}

async function countRows(supabase, table, options = {}) {
  if (!allowedTables[table]) return { count: 0, error: 'Tabela nao permitida' };
  let query = supabase
    .from(table)
    .select('id', { count: 'exact', head: true });

  if (options.status) query = query.eq('status', options.status);
  if (options.lida !== undefined) query = query.eq('lida', options.lida);
  if (options.publico !== undefined) query = query.eq('publico', options.publico);
  if (options.from && options.dateField) query = query.gte(options.dateField, options.from);
  if (options.to && options.dateField) query = query.lte(options.dateField, options.to);
  if (options.city) {
    const cityValue = cleanCityName(options.city);
    if (['liderancas', 'eleitores', 'funcionarios', 'geolocalizacao'].includes(table)) {
      query = query.ilike('cidade', `%${cityValue}%`);
    } else if (['campanhas', 'agenda_eventos'].includes(table)) {
      query = query.or(`municipio.ilike.*${cityValue}*,local.ilike.*${cityValue}*`);
    } else if (table === 'solicitacoes') {
      query = query.ilike('municipio', `%${cityValue}%`);
    }
  }

  const { count, error } = await query;
  if (error) return { count: 0, error: error.message };
  return { count: count || 0, error: null };
}

async function sumValues(supabase, table, field, options = {}) {
  if (!allowedTables[table]) return { total: 0, error: 'Tabela nao permitida' };
  let query = supabase.from(table).select(field);
  if (options.status) query = query.eq('status', options.status);
  if (options.from && options.dateField) query = query.gte(options.dateField, options.from);
  if (options.to && options.dateField) query = query.lte(options.dateField, options.to);
  if (options.ativo !== undefined) query = query.eq('ativo', options.ativo);
  const { data, error } = await query.limit(1000);
  if (error) return { total: 0, error: error.message };
  const total = (data || []).reduce((sum, row) => sum + Number(row?.[field] || 0), 0);
  return { total, error: null };
}

function hasAnyFieldValue(row, fields) {
  return fields.some((field) => {
    const value = row?.[field];
    return value !== null && value !== undefined && String(value).trim() !== '';
  });
}

function hasAllFieldValues(row, fields) {
  return fields.every((field) => {
    const value = row?.[field];
    return value !== null && value !== undefined && String(value).trim() !== '';
  });
}

async function countMissingData(supabase, table, fields, options = {}) {
  if (!allowedTables[table]) return { count: 0, checked: 0, error: 'Tabela nao permitida' };
  const selectedFields = Array.from(new Set(['id', ...fields])).join(', ');
  let query = supabase
    .from(table)
    .select(selectedFields)
    .limit(options.limit || 1000);

  if (options.status) query = query.eq('status', options.status);
  if (options.city) {
    const cityValue = cleanCityName(options.city);
    if (['liderancas', 'eleitores', 'funcionarios', 'geolocalizacao'].includes(table)) {
      query = query.ilike('cidade', `%${cityValue}%`);
    } else if (table === 'solicitacoes') {
      query = query.ilike('municipio', `%${cityValue}%`);
    }
  }

  const { data, error } = await query;
  if (error) return { count: 0, checked: 0, error: error.message };
  const rows = data || [];
  const isComplete = options.requireAll
    ? (row) => hasAllFieldValues(row, fields)
    : (row) => hasAnyFieldValue(row, fields);
  return {
    count: rows.filter((row) => !isComplete(row)).length,
    checked: rows.length,
    error: null
  };
}

function buildMissingDataLabel(row, table) {
  if (table === 'geolocalizacao') {
    return `${row.nome || 'Sem nome'} | ${row.tipo || '-'} | ${row.cidade || '-'}${row.bairro ? `/${row.bairro}` : ''}`;
  }
  if (table === 'eleitores') {
    return `${row.nome || 'Sem nome'} | ${row.cidade || '-'}${row.bairro ? `/${row.bairro}` : ''}`;
  }
  if (table === 'funcionarios') {
    return `${row.nome || 'Sem nome'} | ${row.cargo || '-'} | ${row.cidade || '-'}${row.bairro ? `/${row.bairro}` : ''}`;
  }
  return `${row.nome || 'Sem nome'} | ${row.cidade || '-'}${row.bairro ? `/${row.bairro}` : ''} | influencia: ${row.influencia || '-'}`;
}

async function fetchMissingDataRows(supabase, table, fields, options = {}) {
  if (!allowedTables[table]) return { rows: [], error: 'Tabela nao permitida' };
  const selectedFields = allowedTables[table].fields;
  let query = supabase
    .from(table)
    .select(selectedFields)
    .limit(options.limit || 20);

  if (options.city) {
    const cityValue = cleanCityName(options.city);
    if (['liderancas', 'eleitores', 'funcionarios', 'geolocalizacao'].includes(table)) {
      query = query.ilike('cidade', `%${cityValue}%`);
    }
  }

  const { data, error } = await query.order(allowedTables[table].dateField, { ascending: false });
  if (error) return { rows: [], error: error.message };
  const isComplete = options.requireAll
    ? (row) => hasAllFieldValues(row, fields)
    : (row) => hasAnyFieldValue(row, fields);

  return {
    rows: (data || []).filter((row) => !isComplete(row)).slice(0, options.limit || 20),
    error: null
  };
}

function buildHealthLines(metrics, cityLabel = '') {
  const scope = cityLabel ? ` em ${cityLabel}` : '';
  const lines = [
    `- Liderancas sem telefone/email${scope}: ${metrics.liderancasSemContato.count}`,
    `- Eleitores sem telefone${scope}: ${metrics.eleitoresSemTelefone.count}`,
    `- Funcionarios sem telefone/email${scope}: ${metrics.funcionariosSemContato.count}`,
    `- Marcadores sem coordenada${scope}: ${metrics.marcadoresSemCoordenada.count}`,
    `- Solicitacoes abertas${scope}: ${metrics.solicitacoesAbertas}`
  ];

  const critical = [];
  if (metrics.liderancasSemContato.count > 0) critical.push('completar contatos de liderancas');
  if (metrics.marcadoresSemCoordenada.count > 0) critical.push('corrigir coordenadas do mapa');
  if (metrics.solicitacoesAbertas > 0) critical.push('tratar solicitacoes abertas');

  return {
    lines,
    recommendation: critical.length
      ? `Prioridade operacional: ${critical.slice(0, 2).join(' e ')}.`
      : 'Base operacional sem alerta critico nos principais cadastros.'
  };
}

async function getDataHealthMetrics(supabase, city = '') {
  const cityLabel = city ? cleanCityName(city) : '';
  const cityOptions = cityLabel ? { city: cityLabel } : {};
  const [
    liderancasSemContato,
    eleitoresSemTelefone,
    funcionariosSemContato,
    marcadoresSemCoordenada,
    solicitacoesNovas,
    solicitacoesRecebidas,
    solicitacoesAndamento
  ] = await Promise.all([
    countMissingData(supabase, 'liderancas', ['telefone', 'email'], cityOptions),
    countMissingData(supabase, 'eleitores', ['telefone'], cityOptions),
    countMissingData(supabase, 'funcionarios', ['telefone', 'email'], cityOptions),
    countMissingData(supabase, 'geolocalizacao', ['latitude', 'longitude'], { ...cityOptions, requireAll: true }),
    countRows(supabase, 'solicitacoes', { ...cityOptions, status: 'NOVO' }),
    countRows(supabase, 'solicitacoes', { ...cityOptions, status: 'RECEBIDO' }),
    countRows(supabase, 'solicitacoes', { ...cityOptions, status: 'EM_ANDAMENTO' })
  ]);

  return {
    liderancasSemContato,
    eleitoresSemTelefone,
    funcionariosSemContato,
    marcadoresSemCoordenada,
    solicitacoesAbertas: solicitacoesNovas.count + solicitacoesRecebidas.count + solicitacoesAndamento.count
  };
}

async function buildSystemBriefing(supabase, city = '') {
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const month = getMonthRange(today);
  const cityLabel = city ? cleanCityName(city) : '';
  const cityOptions = cityLabel ? { city: cityLabel } : {};

  const [
    eleitores,
    liderancas,
    funcionarios,
    campanhas,
    atendimentos,
    solicitacoesAbertasNovo,
    solicitacoesAbertasRecebido,
    emendas,
    repassesPendentes,
    documentos,
    notificacoesNaoLidas,
    agendaSemana,
    marcadores,
    receitasMes,
    despesasMes
  ] = await Promise.all([
    countRows(supabase, 'eleitores', cityOptions),
    countRows(supabase, 'liderancas', cityOptions),
    countRows(supabase, 'funcionarios', cityOptions),
    countRows(supabase, 'campanhas', cityOptions),
    countRows(supabase, 'atendimentos'),
    countRows(supabase, 'solicitacoes', { ...cityOptions, status: 'NOVO' }),
    countRows(supabase, 'solicitacoes', { ...cityOptions, status: 'RECEBIDO' }),
    countRows(supabase, 'emendas'),
    countRows(supabase, 'repasses', { status: 'PENDENTE' }),
    countRows(supabase, 'documentos'),
    countRows(supabase, 'notificacoes', { lida: false }),
    countRows(supabase, 'agenda_eventos', {
      ...cityOptions,
      dateField: 'data',
      from: formatDateOnly(today),
      to: formatDateOnly(nextWeek)
    }),
    countRows(supabase, 'geolocalizacao', cityOptions),
    sumValues(supabase, 'financeiro_lancamentos', 'valor', {
      dateField: 'data_lancamento',
      from: month.from,
      to: month.to,
      ativo: true
    }),
    sumValues(supabase, 'financeiro_despesas', 'valor', {
      dateField: 'data_despesa',
      from: month.from,
      to: month.to,
      ativo: true
    })
  ]);

  const solicitacoesAbertas = solicitacoesAbertasNovo.count + solicitacoesAbertasRecebido.count;
  const scope = cityLabel ? ` de ${cityLabel}` : ' geral';

  return {
    reply: [
      `Briefing${scope}:`,
      `- Cadastros: ${eleitores.count} eleitores, ${liderancas.count} liderancas, ${funcionarios.count} funcionarios`,
      `- Relacionamento: ${campanhas.count} campanhas, ${atendimentos.count} atendimentos, ${solicitacoesAbertas} solicitacoes abertas`,
      `- Agenda: ${agendaSemana.count} evento(s) nos proximos 7 dias`,
      `- Emendas: ${emendas.count} emendas, ${repassesPendentes.count} repasse(s) pendente(s)`,
      `- Financeiro deste mes: ${formatCurrency(receitasMes.total)} em lancamentos, ${formatCurrency(despesasMes.total)} em despesas`,
      `- Operacao: ${documentos.count} documentos, ${notificacoesNaoLidas.count} notificacoes nao lidas, ${marcadores.count} marcadores no mapa`,
      'Posso detalhar qualquer modulo: agenda, solicitacoes, emendas, financeiro, documentos, mapa ou cadastros.'
    ].join('\n')
  };
}

async function buildDataHealthBriefing(supabase, city = '') {
  const cityLabel = city ? cleanCityName(city) : '';
  const metrics = await getDataHealthMetrics(supabase, cityLabel);
  const healthBlock = buildHealthLines(metrics, cityLabel);
  const title = cityLabel ? `Saude dos dados de ${cityLabel}:` : 'Saude dos dados:';

  return [
    title,
    ...healthBlock.lines,
    healthBlock.recommendation,
    'Posso listar os cadastros sem contato ou filtrar por cidade/bairro.'
  ].join('\n');
}

async function buildMissingDataList(supabase, target, city = '') {
  const cityLabel = city ? cleanCityName(city) : '';
  const result = await fetchMissingDataRows(supabase, target.table, target.fields, {
    city: cityLabel,
    requireAll: Boolean(target.requireAll),
    limit: 20
  });

  if (result.error) return `Nao consegui listar agora: ${result.error}`;
  const scope = cityLabel ? ` em ${cityLabel}` : '';
  if (result.rows.length === 0) {
    return `${target.title}${scope}: nao encontrei pendencias nessa consulta.`;
  }

  const lines = result.rows.map((row, index) => `${index + 1}) ${buildMissingDataLabel(row, target.table)}`);
  return [
    `${target.title}${scope}:`,
    ...lines,
    result.rows.length >= 20 ? 'Mostrei os 20 primeiros registros encontrados.' : '',
    'Posso filtrar por bairro/cidade ou detalhar um cadastro especifico.'
  ].filter(Boolean).join('\n');
}

async function buildCityBriefing(supabase, city) {
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const cityLabel = cleanCityName(city);

  const [
    liderancas,
    eleitores,
    funcionarios,
    solicitacoesNovas,
    solicitacoesRecebidas,
    solicitacoesAndamento,
    agenda,
    marcadores,
    proximasLiderancas,
    health
  ] = await Promise.all([
    countByCity(supabase, 'liderancas', city),
    countByCity(supabase, 'eleitores', city),
    countRows(supabase, 'funcionarios', { city }),
    countByCity(supabase, 'solicitacoes', city, { status: 'NOVO' }),
    countByCity(supabase, 'solicitacoes', city, { status: 'RECEBIDO' }),
    countByCity(supabase, 'solicitacoes', city, { status: 'EM_ANDAMENTO' }),
    countByCity(supabase, 'agenda_eventos', city, {
      dateField: 'data',
      from: formatDateOnly(today),
      to: formatDateOnly(nextWeek)
    }),
    countRows(supabase, 'geolocalizacao', { city }),
    fetchRows(supabase, 'liderancas', { city, limit: 8, ascending: false }),
    getDataHealthMetrics(supabase, city)
  ]);

  const solicitacoesAbertas = solicitacoesNovas.count + solicitacoesRecebidas.count + solicitacoesAndamento.count;
  const prioritized = prioritizeRows('liderancas', proximasLiderancas.rows).slice(0, 3);
  const priorityLines = prioritized.map((row, index) => {
    const phone = row.telefone ? ` | ${formatBrazilPhone(row.telefone)}` : '';
    const bairro = row.bairro ? ` | bairro: ${row.bairro}` : '';
    const influence = row.influencia ? ` | influencia: ${row.influencia}` : '';
    return `${index + 1}) ${row.nome || 'Sem nome'}${influence}${bairro}${phone}`;
  });
  const healthBlock = buildHealthLines(health, cityLabel);

  return {
    reply: [
      `Briefing de ${cityLabel}:`,
      `- Cadastros: ${liderancas.count} liderancas, ${eleitores.count} eleitores, ${funcionarios.count} funcionarios`,
      `- Campo: ${solicitacoesAbertas} solicitacoes abertas, ${agenda.count} compromisso(s) nos proximos 7 dias`,
      `- Territorio: ${marcadores.count} marcador(es) no mapa`,
      priorityLines.length ? 'Sugestao de prioridade:' : '',
      ...priorityLines,
      'Saude dos dados:',
      ...healthBlock.lines,
      healthBlock.recommendation,
      'Posso listar os contatos prioritarios, abrir solicitacoes ou detalhar o mapa da cidade.'
    ].filter(Boolean).join('\n'),
    counts: {
      liderancas: liderancas.count,
      eleitores: eleitores.count,
      funcionarios: funcionarios.count,
      solicitacoesAbertas,
      agendaProximos7Dias: agenda.count,
      marcadores: marcadores.count
    }
  };
}

function detectAgendaBriefing(message) {
  const normalized = normalizeForMatch(message);
  return /(agenda|compromisso|compromissos|evento|eventos)/.test(normalized)
    && /(hoje|amanha|semana|proximos|proximas|aqui|cidade)/.test(normalized);
}

function detectOpenRequestsBriefing(message) {
  const normalized = normalizeForMatch(message);
  return /(solicitacao|solicitacoes|demanda|demandas|pedido|pedidos)/.test(normalized)
    && /(aberta|abertas|pendente|pendentes|novo|novos|recebido|recebidos|aqui|cidade)/.test(normalized);
}

function detectFinanceBriefing(message) {
  const normalized = normalizeForMatch(message);
  return /(financeiro|caixa|receita|receitas|despesa|despesas|gasto|gastos|lancamento|lancamentos)/.test(normalized)
    && /(mes|mês|atual|resumo|saldo|quanto|total|hoje)/.test(normalized);
}

function detectAmendmentsBriefing(message) {
  const normalized = normalizeForMatch(message);
  return /(emenda|emendas|repasse|repasses|recurso|recursos)/.test(normalized)
    && /(resumo|status|pendente|pendentes|aprovada|aprovadas|andamento|valor|quanto|total|listar|liste)/.test(normalized);
}

function detectDocumentsBriefing(message) {
  const normalized = normalizeForMatch(message);
  return /(documento|documentos|arquivo|arquivos|material|materiais)/.test(normalized)
    && /(recente|recentes|ultimo|ultimos|resumo|listar|liste|publico|publicos)/.test(normalized);
}

function detectNotificationsBriefing(message) {
  const normalized = normalizeForMatch(message);
  return /(notificacao|notificacoes|aviso|avisos|alerta|alertas)/.test(normalized)
    && /(nao lida|nao lidas|pendente|pendentes|resumo|listar|liste|recentes)/.test(normalized);
}

function detectMapBriefing(message) {
  const normalized = normalizeForMatch(message);
  return /(mapa|geolocalizacao|territorio|territorial|marcador|marcadores|bairro|bairros)/.test(normalized)
    && /(resumo|ranking|onde|cidade|aqui|marcador|marcadores|concentracao|concentrados|quantos|quantas)/.test(normalized);
}

function detectBirthdayBriefing(message) {
  const normalized = normalizeForMatch(message);
  return /(aniversario|aniversarios|aniversariante|aniversariantes)/.test(normalized)
    && /(hoje|semana|mes|proximos|proximas|resumo|listar|liste|quem)/.test(normalized);
}

function getRequestedDateRange(message) {
  const explicitRange = extractDateRange(message);
  if (explicitRange) return explicitRange;
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  return { from: formatDateOnly(today), to: formatDateOnly(nextWeek) };
}

async function fetchRows(supabase, table, options = {}) {
  if (!allowedTables[table]) return { rows: [], error: 'Tabela nao permitida' };
  const limit = Math.min(options.limit || 5, 20);
  let query = supabase
    .from(table)
    .select(options.fields || allowedTables[table].fields)
    .limit(limit);

  if (options.status) query = query.eq('status', options.status);
  if (Array.isArray(options.statuses) && options.statuses.length > 0) {
    query = query.in('status', options.statuses);
  }
  if (options.city) {
    const cityValue = cleanCityName(options.city);
    if (['liderancas', 'eleitores', 'funcionarios', 'geolocalizacao'].includes(table)) {
      query = query.ilike('cidade', `%${cityValue}%`);
    } else if (['campanhas', 'agenda_eventos'].includes(table)) {
      query = query.or(`municipio.ilike.*${cityValue}*,local.ilike.*${cityValue}*`);
    } else if (table === 'solicitacoes') {
      query = query.ilike('municipio', `%${cityValue}%`);
    }
  }
  if (options.from) query = query.gte(allowedTables[table].dateField, options.from);
  if (options.to) query = query.lte(allowedTables[table].dateField, options.to);

  const ascending = options.ascending !== undefined ? options.ascending : true;
  query = query.order(allowedTables[table].dateField, { ascending });
  const { data, error } = await query;
  if (error) return { rows: [], error: error.message };
  return { rows: data || [], error: null };
}

async function buildAgendaBriefing(supabase, message, city = '') {
  const range = getRequestedDateRange(message);
  const cityLabel = city ? cleanCityName(city) : '';
  const [total, rowsResult] = await Promise.all([
    countRows(supabase, 'agenda_eventos', {
      city: cityLabel,
      dateField: 'data',
      from: range.from,
      to: range.to
    }),
    fetchRows(supabase, 'agenda_eventos', {
      city: cityLabel,
      from: range.from,
      to: range.to,
      limit: 5,
      ascending: true
    })
  ]);

  const scope = cityLabel ? ` em ${cityLabel}` : '';
  const lines = rowsResult.rows.map((row) => {
    const hora = row.hora_inicio ? ` ${row.hora_inicio}` : '';
    return `- ${formatDate(row.data)}${hora}: ${row.titulo || 'Sem titulo'} (${row.local || row.municipio || '-'})`;
  });

  return [
    `Agenda${scope}: ${total.count} compromisso(s) no periodo.`,
    ...lines,
    total.count > rowsResult.rows.length ? `Mostrei ${rowsResult.rows.length} de ${total.count}.` : '',
    'Posso detalhar um compromisso ou filtrar por cidade/data.'
  ].filter(Boolean).join('\n');
}

async function buildOpenRequestsBriefing(supabase, city = '') {
  const cityLabel = city ? cleanCityName(city) : '';
  const statuses = ['NOVO', 'RECEBIDO', 'EM_ANDAMENTO'];
  const [totalNovo, totalRecebido, totalAndamento, rowsResult] = await Promise.all([
    countRows(supabase, 'solicitacoes', { city: cityLabel, status: 'NOVO' }),
    countRows(supabase, 'solicitacoes', { city: cityLabel, status: 'RECEBIDO' }),
    countRows(supabase, 'solicitacoes', { city: cityLabel, status: 'EM_ANDAMENTO' }),
    fetchRows(supabase, 'solicitacoes', {
      city: cityLabel,
      statuses,
      limit: 5,
      ascending: false
    })
  ]);
  const total = totalNovo.count + totalRecebido.count + totalAndamento.count;
  const scope = cityLabel ? ` em ${cityLabel}` : '';
  const lines = rowsResult.rows.map((row) => (
    `- ${row.protocolo || row.id}: ${row.titulo || 'Sem titulo'} | ${row.status || '-'} | ${row.municipio || '-'}${row.bairro ? `/${row.bairro}` : ''}`
  ));

  return [
    `Solicitacoes abertas${scope}: ${total}.`,
    `- Novas: ${totalNovo.count}`,
    `- Recebidas: ${totalRecebido.count}`,
    `- Em andamento: ${totalAndamento.count}`,
    ...lines,
    total > rowsResult.rows.length ? `Mostrei ${rowsResult.rows.length} de ${total}.` : '',
    'Posso detalhar uma solicitacao ou separar por bairro/prioridade.'
  ].filter(Boolean).join('\n');
}

async function buildFinanceBriefing(supabase, message) {
  const range = /ano/i.test(message) ? null : getMonthRange(new Date());
  const rangeOptions = range
    ? { from: range.from, to: range.to }
    : {};
  const [receitas, despesas, pendentes, despesasPendentes, parceiros] = await Promise.all([
    sumValues(supabase, 'financeiro_lancamentos', 'valor', {
      dateField: 'data_lancamento',
      ...rangeOptions,
      ativo: true
    }),
    sumValues(supabase, 'financeiro_despesas', 'valor', {
      dateField: 'data_despesa',
      ...rangeOptions,
      ativo: true
    }),
    countRows(supabase, 'financeiro_lancamentos', { status: 'PENDENTE' }),
    countRows(supabase, 'financeiro_despesas', { status: 'PENDENTE' }),
    countRows(supabase, 'financeiro_parceiros', { status: 'ATIVO' })
  ]);
  const saldo = receitas.total - despesas.total;
  const periodo = range ? 'deste mes' : 'do periodo';

  return [
    `Resumo financeiro ${periodo}:`,
    `- Lancamentos/entradas: ${formatCurrency(receitas.total)}`,
    `- Despesas: ${formatCurrency(despesas.total)}`,
    `- Saldo estimado: ${formatCurrency(saldo)}`,
    `- Lancamentos pendentes: ${pendentes.count}`,
    `- Despesas pendentes: ${despesasPendentes.count}`,
    `- Parceiros ativos: ${parceiros.count}`,
    'Posso abrir as despesas pendentes, lancamentos recentes ou parceiros.'
  ].join('\n');
}

async function buildAmendmentsBriefing(supabase) {
  const [total, apresentadas, analise, aprovadas, repassesPendentes, valorEmendas, valorRepassesPendentes, rowsResult] = await Promise.all([
    countRows(supabase, 'emendas'),
    countRows(supabase, 'emendas', { status: 'APRESENTADA' }),
    countRows(supabase, 'emendas', { status: 'EM_ANALISE' }),
    countRows(supabase, 'emendas', { status: 'APROVADA' }),
    countRows(supabase, 'repasses', { status: 'PENDENTE' }),
    sumValues(supabase, 'emendas', 'valor'),
    sumValues(supabase, 'repasses', 'valor', { status: 'PENDENTE' }),
    fetchRows(supabase, 'emendas', { limit: 5, ascending: false })
  ]);
  const lines = rowsResult.rows.map((row) => (
    `- ${row.numero_emenda || row.id}: ${row.titulo || 'Sem titulo'} | ${row.status || '-'} | ${formatCurrency(row.valor)}`
  ));

  return [
    'Resumo de emendas:',
    `- Total: ${total.count}`,
    `- Apresentadas: ${apresentadas.count}`,
    `- Em analise: ${analise.count}`,
    `- Aprovadas: ${aprovadas.count}`,
    `- Valor total cadastrado: ${formatCurrency(valorEmendas.total)}`,
    `- Repasses pendentes: ${repassesPendentes.count} (${formatCurrency(valorRepassesPendentes.total)})`,
    ...lines,
    'Posso detalhar uma emenda, orgao ou repasse pendente.'
  ].join('\n');
}

async function buildDocumentsBriefing(supabase) {
  const [total, publicos, rowsResult] = await Promise.all([
    countRows(supabase, 'documentos'),
    countRows(supabase, 'documentos', { publico: true }),
    fetchRows(supabase, 'documentos', { limit: 5, ascending: false })
  ]);
  const lines = rowsResult.rows.map((row) => (
    `- ${row.titulo || 'Sem titulo'} | ${row.tipo || '-'} | ${row.categoria || '-'} | ${formatDate(row.data_upload)}`
  ));

  return [
    'Documentos:',
    `- Total cadastrado: ${total.count}`,
    `- Publicos: ${publicos.count}`,
    'Recentes:',
    ...lines,
    'Posso buscar por tipo, categoria ou titulo.'
  ].join('\n');
}

async function buildNotificationsBriefing(supabase) {
  const [naoLidas, recentes] = await Promise.all([
    countRows(supabase, 'notificacoes', { lida: false }),
    fetchRows(supabase, 'notificacoes', { limit: 5, ascending: false })
  ]);
  const lines = recentes.rows.map((row) => (
    `- ${row.titulo || 'Sem titulo'} | ${row.lida ? 'lida' : 'nao lida'} | ${formatDate(row.created_at)}`
  ));

  return [
    `Notificacoes: ${naoLidas.count} nao lida(s).`,
    ...lines,
    'Posso listar apenas as nao lidas ou buscar por titulo.'
  ].join('\n');
}

async function buildMapBriefing(supabase, city = '') {
  const cityLabel = city ? cleanCityName(city) : '';
  let query = supabase
    .from('geolocalizacao')
    .select(allowedTables.geolocalizacao.fields)
    .limit(500);

  if (cityLabel) query = query.ilike('cidade', `%${cityLabel}%`);

  const { data, error } = await query.order('id', { ascending: false });
  if (error) return `Nao consegui consultar o mapa agora: ${error.message}`;

  const rows = data || [];
  const semCoordenada = rows.filter((row) => !row.latitude || !row.longitude).length;
  const liderancas = rows.filter((row) => String(row.tipo || '').toLowerCase().includes('lider')).length;
  const bairros = rows.reduce((acc, row) => {
    const bairro = row.bairro || 'Sem bairro';
    acc[bairro] = (acc[bairro] || 0) + 1;
    return acc;
  }, {});
  const rankingBairros = Object.entries(bairros)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([bairro, total]) => `- ${bairro}: ${total}`);
  const scope = cityLabel ? ` em ${cityLabel}` : '';

  return [
    `Mapa${scope}: ${rows.length} marcador(es) consultados.`,
    `- Liderancas no mapa: ${liderancas}`,
    `- Sem coordenada: ${semCoordenada}`,
    rankingBairros.length ? 'Bairros com maior concentracao:' : '',
    ...rankingBairros,
    'Posso listar os marcadores, filtrar por bairro ou cruzar com liderancas/eleitores.'
  ].filter(Boolean).join('\n');
}

async function buildBirthdayBriefing(supabase) {
  const snapshot = await carregarSnapshotAniversariantes(supabase, {
    limite: 8,
    incluirInativos: false,
    deduplicar: true
  });
  const proximos = snapshot.proximosAniversariantes || [];
  const lines = proximos.slice(0, 8).map((item) => {
    const quando = Number(item.diasAte || 0) === 0 ? 'hoje' : `em ${item.diasAte} dia(s)`;
    const contato = item.telefone || item.celular || item.whatsapp || item.email || 'sem contato';
    return `- ${item.nome || 'Sem nome'} (${item.tipo || 'cadastro'}) - ${quando} | ${contato}`;
  });

  return [
    'Aniversariantes:',
    `- Hoje: ${snapshot.resumo?.aniversariantesHoje || 0}`,
    `- Proximos 7 dias: ${snapshot.resumo?.aniversariantesSemana || 0}`,
    `- Proximos 30 dias: ${snapshot.resumo?.aniversariantesMes || 0}`,
    `- Total monitorado: ${snapshot.resumo?.totalAniversariantes || 0}`,
    lines.length ? 'Proximos:' : '',
    ...lines,
    'Posso preparar a lista de contatos ou separar por eleitor, lideranca e funcionario.'
  ].filter(Boolean).join('\n');
}

function resolveDraftAudience(message, lastContext) {
  const explicitTable = detectTableFromText(message);
  const contextTable = lastContext?.table || '';
  const table = explicitTable || (
    ['liderancas', 'eleitores', 'funcionarios', 'financeiro_parceiros', 'orgaos'].includes(contextTable)
      ? contextTable
      : 'liderancas'
  );
  const location = extractLocationTerm(message)
    || (refersToCurrentLocation(message) ? lastContext?.currentLocation : '')
    || lastContext?.currentLocation
    || '';
  const filters = {};

  if (location) {
    if (['liderancas', 'eleitores', 'funcionarios', 'geolocalizacao'].includes(table)) {
      filters.cidade = location;
    } else if (['campanhas', 'agenda_eventos', 'solicitacoes'].includes(table)) {
      filters.municipio = location;
    }
  }

  if (!explicitTable && lastContext?.lastPlan?.filters && table === contextTable) {
    Object.assign(filters, lastContext.lastPlan.filters);
  }

  return { table, filters, location };
}

function buildMessageTemplate(kind, city = '') {
  const cityPart = city ? ` em ${cleanCityName(city)}` : '';
  if (kind === 'birthday') {
    return 'Ola, [NOME]! Passando para desejar um feliz aniversario. Que seu novo ciclo seja de saude, paz e muitas realizacoes. Conte sempre com nosso mandato.';
  }
  if (kind === 'meeting') {
    return `Ola, [NOME]! Estou organizando minha agenda${cityPart} e gostaria de alinhar uma conversa rapida com voce. Qual melhor horario para falarmos?`;
  }
  if (kind === 'request') {
    return 'Ola, [NOME]! Estou acompanhando as demandas da regiao e queria atualizar voce sobre os proximos encaminhamentos. Pode me confirmar o melhor horario para contato?';
  }
  return `Ola, [NOME]! Estou passando${cityPart} e gostaria de falar rapidamente com voce sobre as demandas da comunidade. Pode me dizer o melhor horario para conversarmos?`;
}

function buildDraftRecipientLines(rows, table) {
  return (rows || []).slice(0, 10).map((row) => {
    const name = row.nome || row.titulo || row.responsavel || 'Sem nome';
    const phone = row.telefone || row.celular || row.whatsapp || row.phone || row.mobile || '';
    const email = row.email || '';
    const contact = phone
      ? `${formatBrazilPhone(phone)} | WhatsApp: ${buildWhatsappUrl(phone)}`
      : (email || 'sem contato');
    const bairro = row.bairro ? ` | bairro: ${row.bairro}` : '';
    const influence = table === 'liderancas' && row.influencia ? ` | influencia: ${row.influencia}` : '';
    return `- ${name}${influence}${bairro}: ${contact}`;
  });
}

async function fetchDraftAudienceRows(supabase, audience, lastContext) {
  if (!allowedTables[audience.table]) return { rows: [], error: 'Tabela nao permitida' };
  const fields = buildSelectFields({ action: 'list_contacts', table: audience.table }, audience.table);
  const idField = lastContext?.idField || 'id';
  const ids = Array.isArray(lastContext?.lastResultMeta?.ids) ? lastContext.lastResultMeta.ids : [];
  const plan = {
    action: 'list_contacts',
    table: audience.table,
    filters: { ...(audience.filters || {}) },
    search: '',
    limit: 10,
    idField
  };

  if (ids.length > 0 && audience.table === lastContext?.table) {
    plan.filters.ids = ids.slice(0, 10);
    plan.filters.id_field = idField;
  }

  let query = supabase
    .from(audience.table)
    .select(fields)
    .limit(10);
  query = applyFilters(query, audience.table, plan);
  query = query.order(allowedTables[audience.table].dateField, { ascending: false });
  const { data, error } = await query;
  if (error) return { rows: [], error: error.message };
  return { rows: data || [], error: null };
}

async function buildBirthdayMessageDraft(supabase) {
  const snapshot = await carregarSnapshotAniversariantes(supabase, {
    limite: 10,
    incluirInativos: false,
    deduplicar: true
  });
  const rows = snapshot.proximosAniversariantes || [];
  const lines = rows.slice(0, 10).map((item) => {
    const contact = item.telefone || item.celular || item.whatsapp || item.email || 'sem contato';
    return `- ${item.nome || 'Sem nome'}: ${contact}`;
  });

  return [
    'Rascunho de mensagem de aniversario:',
    buildMessageTemplate('birthday'),
    lines.length ? 'Destinatarios proximos:' : '',
    ...lines,
    'Nao enviei a mensagem. Apenas preparei o texto para revisao.'
  ].filter(Boolean).join('\n');
}

async function buildMessageDraft(supabase, message, intent, lastContext) {
  if (intent.kind === 'birthday') return buildBirthdayMessageDraft(supabase);

  const audience = resolveDraftAudience(message, lastContext);
  const result = await fetchDraftAudienceRows(supabase, audience, lastContext);
  if (result.error) return `Nao consegui preparar os destinatarios agora: ${result.error}`;

  const tableLabel = labelForTable(audience.table);
  const template = buildMessageTemplate(intent.kind, audience.location);
  const recipients = buildDraftRecipientLines(result.rows, audience.table);
  const scope = audience.location ? ` em ${cleanCityName(audience.location)}` : '';

  return [
    `Rascunho de mensagem para ${tableLabel}${scope}:`,
    template,
    recipients.length ? 'Contatos sugeridos:' : 'Nao encontrei contatos nesse contexto.',
    ...recipients,
    recipients.some((line) => line.includes('sem contato')) ? 'Alguns cadastros precisam de telefone/email antes do envio.' : '',
    'Nao enviei a mensagem. Apenas preparei o texto para revisao.'
  ].filter(Boolean).join('\n');
}

function resolveFieldPlanCity(message, lastContext) {
  return extractLocationTerm(message)
    || (refersToCurrentLocation(message) ? lastContext?.currentLocation : '')
    || detectCityArrival(message)
    || lastContext?.currentLocation
    || '';
}

function buildFieldPlanLeaderLines(rows) {
  return prioritizeRows('liderancas', rows).slice(0, 4).map((row, index) => {
    const phone = row.telefone ? ` | ${formatBrazilPhone(row.telefone)}` : '';
    const whatsapp = row.telefone ? ` | WhatsApp: ${buildWhatsappUrl(row.telefone)}` : '';
    const bairro = row.bairro ? ` | bairro: ${row.bairro}` : '';
    const influence = row.influencia ? ` | influencia: ${row.influencia}` : '';
    const contactNote = !row.telefone && !row.email ? ' | sem contato' : '';
    return `${index + 1}) ${row.nome || 'Sem nome'}${influence}${bairro}${phone}${whatsapp}${contactNote}`;
  });
}

function buildFieldPlanAgendaLines(rows) {
  return (rows || []).slice(0, 3).map((row) => {
    const hora = row.hora_inicio ? ` ${row.hora_inicio}` : '';
    return `- ${formatDate(row.data)}${hora}: ${row.titulo || 'Sem titulo'} (${row.local || row.municipio || '-'})`;
  });
}

function buildFieldPlanRequestLines(rows) {
  return (rows || []).slice(0, 4).map((row) => (
    `- ${row.protocolo || row.id}: ${row.titulo || 'Sem titulo'} | ${row.status || '-'} | ${row.bairro || row.municipio || '-'}`
  ));
}

async function buildFieldActionPlan(supabase, message, lastContext) {
  const city = resolveFieldPlanCity(message, lastContext);
  const cityLabel = city ? cleanCityName(city) : '';
  const range = getRequestedDateRange(message);
  const [leaders, agenda, requests, health] = await Promise.all([
    fetchRows(supabase, 'liderancas', { city: cityLabel, limit: 10, ascending: false }),
    fetchRows(supabase, 'agenda_eventos', {
      city: cityLabel,
      from: range.from,
      to: range.to,
      limit: 5,
      ascending: true
    }),
    fetchRows(supabase, 'solicitacoes', {
      city: cityLabel,
      statuses: ['NOVO', 'RECEBIDO', 'EM_ANDAMENTO'],
      limit: 6,
      ascending: false
    }),
    getDataHealthMetrics(supabase, cityLabel)
  ]);

  const leaderLines = buildFieldPlanLeaderLines(leaders.rows);
  const agendaLines = buildFieldPlanAgendaLines(agenda.rows);
  const requestLines = buildFieldPlanRequestLines(requests.rows);
  const healthBlock = buildHealthLines(health, cityLabel);
  const title = cityLabel ? `Roteiro de campo em ${cityLabel}:` : 'Roteiro de campo:';

  return [
    title,
    '1. Comece pelas liderancas prioritarias:',
    leaderLines.length ? leaderLines.join('\n') : '- Nao encontrei liderancas nesse contexto.',
    '2. Confira a agenda proxima:',
    agendaLines.length ? agendaLines.join('\n') : '- Sem compromissos encontrados no periodo.',
    '3. Trate as solicitacoes abertas:',
    requestLines.length ? requestLines.join('\n') : '- Sem solicitacoes abertas encontradas.',
    '4. Corrija riscos operacionais antes da visita:',
    ...healthBlock.lines,
    healthBlock.recommendation,
    '5. Proxima acao sugerida: peça "prepare mensagem para liderancas aqui" ou "liste liderancas sem contato aqui".'
  ].join('\n');
}

export default async function handler(req, res) {
  const traceId = crypto.randomUUID();
  const startedAt = Date.now();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido', traceId });
  }

  try {
    const { message, history } = req.body || {};
    if (!message) {
      return res.status(400).json({ success: false, message: 'Mensagem obrigatoria', traceId });
    }

    const supabase = createServerClient();
    const { usuario: user } = await obterUsuarioAutenticado(req, supabase);
    exigirAdministrador(user);

    const config = lerConfiguracoes();
    const providerConfig = getProviderConfig(config);
    if (!config.openai?.enabled || !providerConfig.apiKey) {
      return res.status(400).json({ success: false, message: 'IA nao configurada', disabled: true, traceId });
    }

    const conversationKey = getConversationKey(req, user);
    const lastContext = getConversationContext(conversationKey);
    const contextualCity = refersToCurrentLocation(message) ? lastContext?.currentLocation : '';
    if (detectFieldPlanIntent(message)) {
      const reply = await buildFieldActionPlan(supabase, message, lastContext);
      logPhase('answer', {
        traceId,
        mode: 'field_action_plan',
        city: contextualCity || lastContext?.currentLocation || '',
        durationMs: Date.now() - startedAt
      });
      return res.status(200).json({ success: true, reply, traceId });
    }

    const messageDraftIntent = detectMessageDraftIntent(message);
    if (messageDraftIntent) {
      const reply = await buildMessageDraft(supabase, message, messageDraftIntent, lastContext);
      logPhase('answer', {
        traceId,
        mode: 'message_draft',
        kind: messageDraftIntent.kind,
        city: contextualCity || '',
        durationMs: Date.now() - startedAt
      });
      return res.status(200).json({ success: true, reply, traceId });
    }

    const missingDataTarget = detectMissingDataList(message);
    if (missingDataTarget) {
      const reply = await buildMissingDataList(supabase, missingDataTarget, contextualCity || '');
      logPhase('answer', {
        traceId,
        mode: 'missing_data_list',
        table: missingDataTarget.table,
        city: contextualCity || '',
        durationMs: Date.now() - startedAt
      });
      return res.status(200).json({ success: true, reply, traceId });
    }

    if (detectDataHealthBriefing(message)) {
      const reply = await buildDataHealthBriefing(supabase, contextualCity || '');
      logPhase('answer', {
        traceId,
        mode: 'data_health_briefing',
        city: contextualCity || '',
        durationMs: Date.now() - startedAt
      });
      return res.status(200).json({ success: true, reply, traceId });
    }

    if (detectSystemBriefing(message)) {
      const briefing = await buildSystemBriefing(supabase, contextualCity || '');
      logPhase('answer', {
        traceId,
        mode: 'system_briefing',
        city: contextualCity || '',
        durationMs: Date.now() - startedAt
      });
      return res.status(200).json({ success: true, reply: briefing.reply, traceId });
    }

    const cityArrival = detectCityArrival(message);
    if (cityArrival) {
      const briefing = await buildCityBriefing(supabase, cityArrival);
      if (conversationKey) {
        const cityPlan = {
          action: 'count',
          table: 'liderancas',
          filters: { cidade: cityArrival },
          search: '',
          limit: Math.min(briefing.counts.liderancas || 20, 100),
          order: 'date_desc'
        };
        const cityContext = withContextLocation(
          buildLastContext(traceId, cityPlan, [], briefing.counts.liderancas),
          lastContext,
          cityPlan
        );
        setConversationContext(conversationKey, cityContext);
      }
      logPhase('answer', {
        traceId,
        mode: 'city_briefing',
        city: cityArrival,
        durationMs: Date.now() - startedAt
      });
      return res.status(200).json({ success: true, reply: briefing.reply, traceId });
    }

    if (detectAgendaBriefing(message)) {
      const reply = await buildAgendaBriefing(supabase, message, contextualCity || '');
      logPhase('answer', {
        traceId,
        mode: 'agenda_briefing',
        city: contextualCity || '',
        durationMs: Date.now() - startedAt
      });
      return res.status(200).json({ success: true, reply, traceId });
    }

    if (detectOpenRequestsBriefing(message)) {
      const reply = await buildOpenRequestsBriefing(supabase, contextualCity || '');
      logPhase('answer', {
        traceId,
        mode: 'requests_briefing',
        city: contextualCity || '',
        durationMs: Date.now() - startedAt
      });
      return res.status(200).json({ success: true, reply, traceId });
    }

    if (detectFinanceBriefing(message)) {
      const reply = await buildFinanceBriefing(supabase, message);
      logPhase('answer', {
        traceId,
        mode: 'finance_briefing',
        durationMs: Date.now() - startedAt
      });
      return res.status(200).json({ success: true, reply, traceId });
    }

    if (detectAmendmentsBriefing(message)) {
      const reply = await buildAmendmentsBriefing(supabase);
      logPhase('answer', {
        traceId,
        mode: 'amendments_briefing',
        durationMs: Date.now() - startedAt
      });
      return res.status(200).json({ success: true, reply, traceId });
    }

    if (detectDocumentsBriefing(message)) {
      const reply = await buildDocumentsBriefing(supabase);
      logPhase('answer', {
        traceId,
        mode: 'documents_briefing',
        durationMs: Date.now() - startedAt
      });
      return res.status(200).json({ success: true, reply, traceId });
    }

    if (detectNotificationsBriefing(message)) {
      const reply = await buildNotificationsBriefing(supabase);
      logPhase('answer', {
        traceId,
        mode: 'notifications_briefing',
        durationMs: Date.now() - startedAt
      });
      return res.status(200).json({ success: true, reply, traceId });
    }

    if (detectMapBriefing(message)) {
      const reply = await buildMapBriefing(supabase, contextualCity || '');
      logPhase('answer', {
        traceId,
        mode: 'map_briefing',
        city: contextualCity || '',
        durationMs: Date.now() - startedAt
      });
      return res.status(200).json({ success: true, reply, traceId });
    }

    if (detectBirthdayBriefing(message)) {
      const reply = await buildBirthdayBriefing(supabase);
      logPhase('answer', {
        traceId,
        mode: 'birthday_briefing',
        durationMs: Date.now() - startedAt
      });
      return res.status(200).json({ success: true, reply, traceId });
    }

    const followUpResolution = resolveFollowup(message, lastContext);
    const followUpActive = followUpResolution.isFollowUp;
    const historyMessages = buildShortHistoryMessages(history);
    const conversationContextBlock = followUpActive ? buildConversationContextBlock(lastContext) : '';

    if (!followUpActive && shouldClarifyQuestion(message, history)) {
      const reply = buildClarificationOnlyResponse();
      logPhase('answer', {
        traceId,
        mode: 'clarify',
        durationMs: Date.now() - startedAt
      });
      return res.status(200).json({ success: true, reply, traceId });
    }

    const question = buildQuestionWithContext(message, history);
    let planResult = null;
    let resolvedPlan = null;

    if (followUpActive) {
      if (!followUpResolution.lockedTable) {
        const reply = 'Preciso da lista anterior para continuar. Pode refazer a consulta?';
        return res.status(200).json({ success: true, reply, traceId });
      }

      resolvedPlan = {
        action: followUpResolution.intent,
        table: followUpResolution.lockedTable,
        filters: {},
        search: '',
        limit: Math.min(
          (followUpResolution.wantsAll || followUpResolution.wantsPriority) ? (lastContext?.count || 20) : (followUpResolution.targetIds?.length || 1),
          100
        ),
        order: 'date_desc',
        idField: followUpResolution.idField || 'id'
      };

      if (resolvedPlan.table !== followUpResolution.lockedTable) {
        resolvedPlan.table = followUpResolution.lockedTable;
      }

      if (followUpResolution.targetIds && followUpResolution.targetIds.length > 0) {
        resolvedPlan.filters.ids = followUpResolution.targetIds;
        resolvedPlan.filters.id_field = resolvedPlan.idField;
      } else if (followUpResolution.reuseLastFilters && lastContext?.lastPlan?.filters) {
        resolvedPlan.filters = { ...lastContext.lastPlan.filters };
        resolvedPlan.search = lastContext.lastPlan.search || '';
      } else if (followUpResolution.targetLabel) {
        resolvedPlan.search = followUpResolution.targetLabel;
      }

      logPhase('plan', {
        traceId,
        followUp: true,
        lockedTable: resolvedPlan.table,
        plan: resolvedPlan,
        question
      });
    } else {
      const quick = quickIntentPlan(message, history, lastContext);
      if (quick?.plan) {
        resolvedPlan = quick.plan;
        logPhase('plan', {
          traceId,
          quick: true,
          reason: quick.reason,
          plan: resolvedPlan,
          question
        });
      } else {
        planResult = await gerarPlanoConsulta(question, providerConfig, historyMessages, conversationContextBlock);
        const plan = normalizePlan(planResult.plan);
        resolvedPlan = plan;
        logPhase('plan', {
          traceId,
          provider: providerConfig.provider,
          model: providerConfig.model,
          repaired: planResult.repaired,
          raw: planResult.raw,
          plan: resolvedPlan,
          question
        });
      }
    }
    if (!followUpActive) {
      const preferList = shouldPreferList(message);
      if (resolvedPlan.action === 'count' && preferList) {
        resolvedPlan = { ...resolvedPlan, action: 'list' };
      }
      if (resolvedPlan.action !== 'none' && !resolvedPlan.search && Object.keys(resolvedPlan.filters || {}).length === 0) {
        const term = extractLocationTerm(question);
        if (term) {
          resolvedPlan = { ...resolvedPlan, search: term };
        }
      }
      if (resolvedPlan.action !== 'none' && !resolvedPlan.search && Object.keys(resolvedPlan.filters || {}).length === 0) {
        if (resolvedPlan.table === 'campanhas' && shouldPreferList(message)) {
          resolvedPlan = { ...resolvedPlan, action: 'list' };
        }
      }
      resolvedPlan = applyDateRangeIfMissing(resolvedPlan, message);
      if (refersToCurrentLocation(message) && lastContext?.currentLocation) {
        resolvedPlan = applyLocationToPlan(resolvedPlan, lastContext.currentLocation);
      }
    }
    const attempts = [];
    let fallbackUsed = null;
    const hasDateRange = Boolean(resolvedPlan.filters?.data_from || resolvedPlan.filters?.data_to);
    const allowFallbacks = !followUpActive && !hasDateRange;
    let didBootstrapList = false;
    const selectedFields = buildSelectFields(resolvedPlan, resolvedPlan.table);

    if (resolvedPlan.action === 'none') {
      const fallback = await tryFallbackCampaigns(supabase, question, history, 5);
      if (fallback) {
        const durationMs = Date.now() - startedAt;
        fallbackUsed = 'fallback_campaigns';
        logPhase('fallback', {
          traceId,
          fallbackUsed,
          plan: fallback.plan,
          rowsCount: fallback.data?.length || 0,
          provider: providerConfig.provider,
          model: providerConfig.model
        });
        const reply = await buildAnswer(
          fallback.plan,
          fallback.data || [],
          { traceId, durationMs, fallbackUsed },
          question,
          providerConfig,
          historyMessages,
          conversationContextBlock
        );
        if (!followUpActive && (fallback.data || []).length > 0 && conversationKey) {
          const newContext = withContextLocation(
            buildLastContext(traceId, fallback.plan, fallback.data || []),
            lastContext,
            fallback.plan
          );
          setConversationContext(conversationKey, newContext);
        }
        return res.status(200).json({ success: true, reply, data: fallback.data || [], traceId });
      }

      return res.status(200).json({
        success: true,
        reply: 'Posso ajudar com consultas de campanhas, agenda, liderancas, eleitores, atendimentos e solicitacoes. Descreva o que voce precisa.',
        traceId
      });
    }

    const configTable = allowedTables[resolvedPlan.table];
    if (followUpActive && resolvedPlan.action === 'list_contacts') {
      const contactFields = getContactFieldsForTable(resolvedPlan.table);
      if (contactFields.length === 0) {
        const reply = `Nao encontrei campos de contato em ${labelForTable(resolvedPlan.table)}. Quer que eu detalhe outro campo?`;
        return res.status(200).json({ success: true, reply, traceId });
      }
    }

    if (
      followUpActive &&
      !followUpResolution?.reuseLastFilters &&
      !resolvedPlan.search &&
      Object.keys(resolvedPlan.filters || {}).length === 0 &&
      (!followUpResolution?.targetIds || followUpResolution.targetIds.length === 0)
    ) {
      if (lastContext?.count && lastContext.count > 0) {
        const bootstrapLimit = Math.min(lastContext.count, 3);
        let bootstrapQuery = supabase
          .from(resolvedPlan.table)
          .select(allowedTables[resolvedPlan.table].fields)
          .limit(bootstrapLimit);
        bootstrapQuery = bootstrapQuery.order(allowedTables[resolvedPlan.table].dateField, { ascending: false });
        const { data: bootstrapRows, error: bootstrapError } = await bootstrapQuery;
        if (!bootstrapError && bootstrapRows && bootstrapRows.length > 0) {
          const bootstrapContext = buildLastContext(traceId, resolvedPlan, bootstrapRows);
          if (conversationKey) {
            setConversationContext(conversationKey, withContextLocation(bootstrapContext, lastContext, resolvedPlan));
          }
          didBootstrapList = true;
          const newIds = bootstrapContext.lastResultMeta?.ids || [];
          if (newIds.length > 0) {
            resolvedPlan.filters.ids = newIds;
            resolvedPlan.filters.id_field = bootstrapContext.idField || resolvedPlan.idField || 'id';
          }
        }
      }
    }

    const hasFollowUpFilter = Object.keys(resolvedPlan.filters || {}).some((key) => (
      key !== 'id_field' && key !== 'idField' && Boolean(resolvedPlan.filters[key])
    ));
    if (followUpActive && !resolvedPlan.filters?.ids && !resolvedPlan.search && !hasFollowUpFilter) {
      const reply = 'Nao consegui identificar quais itens voce quer. Pode indicar o primeiro/segundo ou refazer a lista?';
      return res.status(200).json({ success: true, reply, traceId });
    }

    if (resolvedPlan.action === 'count') {
      let query = supabase
        .from(resolvedPlan.table)
        .select('id', { count: 'exact', head: true });

      query = applyFilters(query, resolvedPlan.table, resolvedPlan);
      const countStarted = Date.now();
      const { count, error } = await query;
      attempts.push({ plan: resolvedPlan, count: count || 0, error: error?.message || null });
      logPhase('query', {
        traceId,
        table: resolvedPlan.table,
        filters: resolvedPlan.filters || {},
        search: resolvedPlan.search || '',
        rowsCount: count || 0,
        durationMs: Date.now() - countStarted,
        provider: providerConfig.provider,
        model: providerConfig.model,
        followUp: followUpActive,
        lockedTable: followUpActive ? resolvedPlan.table : '',
        intent: followUpResolution?.intent || '',
        hasIds: Boolean(resolvedPlan.filters?.ids?.length),
        didBootstrapList,
        selectedFields
      });

      if (error) {
        return res.status(400).json({ success: false, message: error.message, traceId });
      }

      const durationMs = Date.now() - startedAt;
      const reply = await buildAnswer(
        resolvedPlan,
        [],
        { count, traceId, durationMs },
        question,
        providerConfig,
        historyMessages,
        conversationContextBlock
      );

      if (conversationKey) {
        const countContext = withContextLocation(
          buildLastContext(traceId, resolvedPlan, [], count),
          lastContext,
          resolvedPlan
        );
        setConversationContext(conversationKey, countContext);
      }

      return res.status(200).json({
        success: true,
        reply,
        count,
        traceId
      });
    }

    let query = supabase
      .from(resolvedPlan.table)
      .select(selectedFields)
      .limit(resolvedPlan.limit);

    query = applyFilters(query, resolvedPlan.table, resolvedPlan);
    const queryStarted = Date.now();
    const { data, error } = await query;
    attempts.push({ plan: resolvedPlan, count: data?.length || 0, error: error?.message || null });
    logPhase('query', {
      traceId,
      table: resolvedPlan.table,
      filters: resolvedPlan.filters || {},
      search: resolvedPlan.search || '',
      rowsCount: data?.length || 0,
      durationMs: Date.now() - queryStarted,
      provider: providerConfig.provider,
      model: providerConfig.model,
      followUp: followUpActive,
      lockedTable: followUpActive ? resolvedPlan.table : '',
      intent: followUpResolution?.intent || '',
      hasIds: Boolean(resolvedPlan.filters?.ids?.length),
      didBootstrapList,
      selectedFields
    });

    if (error) {
      return res.status(400).json({ success: false, message: error.message, traceId });
    }

    let rows = data || [];
    if (allowFallbacks && rows.length === 0) {
      const fallbackText = await tryFallbackTextSearch(supabase, resolvedPlan, question, resolvedPlan.limit);
      if (fallbackText) {
        fallbackUsed = 'fallback_text_search';
        resolvedPlan = fallbackText.plan;
        rows = fallbackText.data || [];
        attempts.push({ plan: resolvedPlan, count: rows.length, error: null });
        logPhase('fallback', {
          traceId,
          fallbackUsed,
          plan: resolvedPlan,
          rowsCount: rows.length,
          provider: providerConfig.provider,
          model: providerConfig.model
        });
      }
    }

    if (allowFallbacks && rows.length === 0) {
      const fallbackRelax = await tryFallbackRelaxFilters(supabase, resolvedPlan, resolvedPlan.limit);
      if (fallbackRelax) {
        fallbackUsed = 'fallback_relax_filters';
        resolvedPlan = fallbackRelax.plan;
        rows = fallbackRelax.data || [];
        attempts.push({ plan: resolvedPlan, count: rows.length, error: null });
        logPhase('fallback', {
          traceId,
          fallbackUsed,
          plan: resolvedPlan,
          rowsCount: rows.length,
          provider: providerConfig.provider,
          model: providerConfig.model
        });
      }
    }

    if (allowFallbacks && rows.length === 0) {
      const fallback = await tryFallbackCampaigns(supabase, question, history, resolvedPlan.limit);
      if (fallback) {
        fallbackUsed = 'fallback_campaigns';
        resolvedPlan = fallback.plan;
        rows = fallback.data || [];
        attempts.push({ plan: resolvedPlan, count: rows.length, error: null });
        logPhase('fallback', {
          traceId,
          fallbackUsed,
          plan: resolvedPlan,
          rowsCount: rows.length,
          provider: providerConfig.provider,
          model: providerConfig.model
        });
      }
    }

    if (allowFallbacks && rows.length === 0 && resolvedPlan.action === 'list') {
      const fallbackAll = await tryFallbackListAll(supabase, resolvedPlan.table, resolvedPlan.limit);
      if (fallbackAll) {
        fallbackUsed = 'fallback_list_all';
        resolvedPlan = fallbackAll.plan;
        rows = fallbackAll.data || [];
        attempts.push({ plan: resolvedPlan, count: rows.length, error: null });
        logPhase('fallback', {
          traceId,
          fallbackUsed,
          plan: resolvedPlan,
          rowsCount: rows.length,
          provider: providerConfig.provider,
          model: providerConfig.model
        });
      }
    }

    const durationMs = Date.now() - startedAt;
    const snippets = buildSnippets(resolvedPlan, rows, question);
    const answerRows = resolvedPlan.action === 'prioritize'
      ? prioritizeRows(resolvedPlan.table, rows)
      : rows;
    const reply = followUpActive
      ? buildFollowUpAnswer(resolvedPlan, answerRows, {
        traceId,
        followUp: followUpResolution,
        lastContext
      })
      : await buildAnswer(
        resolvedPlan,
        answerRows,
        {
          traceId,
          durationMs,
          fallbackUsed,
          attempts,
          snippets
        },
        question,
        providerConfig,
        historyMessages,
        conversationContextBlock
      );

    logPhase('answer', {
      traceId,
      table: resolvedPlan.table,
      rowsCount: rows.length,
      fallbackUsed,
      durationMs,
      provider: providerConfig.provider,
      model: providerConfig.model,
      followUp: followUpActive,
      lockedTable: followUpActive ? resolvedPlan.table : '',
      intent: followUpResolution?.intent || '',
      hasIds: Boolean(resolvedPlan.filters?.ids?.length),
      didBootstrapList,
      selectedFields
    });

    if (!followUpActive && rows.length > 0 && conversationKey) {
      const newContext = withContextLocation(
        buildLastContext(traceId, resolvedPlan, rows),
        lastContext,
        resolvedPlan
      );
      setConversationContext(conversationKey, newContext);
    }

    return res.status(200).json({ success: true, reply, data: rows, traceId });
  } catch (error) {
    const raw = `${error?.message || ''} ${error?.code || ''} ${error?.raw || ''}`.toLowerCase();
    const config = lerConfiguracoes();
    const provider = String(config.openai?.provider || 'openai').toLowerCase();
    if (provider === 'openai' && (raw.includes('insufficient_quota') || raw.includes('exceeded your current quota'))) {
      config.openai = {
        ...config.openai,
        enabled: false,
        lastError: 'insufficient_quota',
        dataAtualizacao: new Date().toISOString()
      };
      salvarConfiguracoes(config);

      return res.status(200).json({
        success: true,
        reply: 'Sua conta OpenAI esta sem creditos. A IA foi desativada automaticamente. Atualize a chave ou habilite faturamento e reative nas configuracoes.',
        disabled: true,
        traceId
      });
    }

    return res.status(500).json({ success: false, message: error.message, traceId });
  }
}
