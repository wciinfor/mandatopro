import crypto from 'crypto';
import { createServerClient } from '@/lib/supabase-server';
import { lerConfiguracoes, salvarConfiguracoes } from '@/lib/configuracoes';

export const runtime = 'nodejs';

const allowedTables = {
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
    fields: 'id, nome, telefone, status',
    dateField: 'created_at',
    searchField: 'nome'
  },
  eleitores: {
    fields: 'id, nome, telefone, cidade, bairro, status',
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
  }
};

const PLANNER_PROMPT = `Voce e um planejador de consultas do MandatoPro.\n` +
  `Responda APENAS com JSON valido.\n` +
  `Tabelas permitidas: campanhas, agenda_eventos, liderancas, eleitores, atendimentos, solicitacoes.\n` +
  `Acoes permitidas: list, search, count, detail, list_contacts, none.\n` +
  `Filtros permitidos: status, municipio, cidade, bairro, data_from, data_to, ids, id_field.\n` +
  `Use o campo search para nome/titulo/protocolo.\n` +
  `Se houver "Contexto da conversa" e a pergunta for follow-up (ex: eles/deles/primeiro/segundo), use a mesma table do contexto, action detail ou list_contacts e filtre pelos ids fornecidos.\n` +
  `Se nao for pergunta de dados, use {"action":"none","reason":"..."}.`;

const PLANNER_REPAIR_PROMPT = `Voce recebe um JSON invalido do planner.\n` +
  `Corrija e devolva SOMENTE JSON valido no schema: {action, table, filters, search, limit, order}.\n` +
  `Acoes: list, search, count, detail, list_contacts, none.\n` +
  `Tabelas: campanhas, agenda_eventos, liderancas, eleitores, atendimentos, solicitacoes.\n` +
  `Filtros: status, municipio, cidade, bairro, data_from, data_to, ids, id_field.\n` +
  `Se nao for consulta de dados, use {"action":"none","reason":"..."}.`;

const ANSWER_PROMPT = `Voce responde APENAS com base nos dados fornecidos.\n` +
  `Nao invente informacoes.\n` +
  `Se houver resultados, responda curto e humano, e copie as linhas de evidencias exatamente como recebidas.\n` +
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
  lideranca: ['lideranca', 'liderancas', 'lider']
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
    atendimentos: ['atendimento', 'atendimentos'],
    solicitacoes: ['solicitacao', 'solicitacoes']
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
  const followUpRegex = /(\beles\b|\bdeles\b|\bessas\b|\besses\b|\bos anteriores\b|\bdaqueles\b|\bo primeiro\b|\bo segundo\b|\bo terceiro\b|\ba primeira\b|\ba segunda\b|\ba terceira\b|\bprimeiro\b|\bsegundo\b|\bterceiro\b)/;
  const wantsContacts = /(contato|telefone|celular|whatsapp|email|numero|numeros)/.test(normalized);
  const wantsLocation = /(municipio|cidade|bairro|uf|estado|local)/.test(normalized);
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
    isFollowUp: followUpRegex.test(normalized) || wantsContacts || wantsLocation || ordinalIndex !== null,
    wantsContacts,
    wantsLocation,
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
  if (followUp.ordinalIndex !== null && ids.length > 0) {
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
  if (followUp.wantsLocation || ['municipio', 'cidade', 'bairro', 'uf', 'estado', 'local'].includes(followUp.requestedField)) {
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
    targetLabel
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

function formatRow(table, row) {
  if (table === 'campanhas') {
    return `${row.nome || 'Sem nome'} | ${formatDate(row.data_campanha)} | ${row.status || '-'} | ${row.municipio || row.local || '-'}`;
  }
  if (table === 'agenda_eventos') {
    const hora = row.hora_inicio ? ` ${row.hora_inicio}` : '';
    return `${row.titulo || 'Sem titulo'} | ${formatDate(row.data)}${hora} | ${row.tipo || '-'} | ${row.municipio || row.local || '-'}`;
  }
  if (table === 'liderancas') {
    return `${row.nome || 'Sem nome'} | ${row.telefone || '-'} | ${row.status || '-'}`;
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
  return JSON.stringify(row);
}

function labelForTable(table) {
  if (!table) return 'registros';
  return String(table).replace('_', ' ');
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
  liderancas: ['nome', 'telefone', 'status'],
  eleitores: ['nome', 'cidade', 'bairro', 'status'],
  atendimentos: ['protocolo', 'assunto', 'status', 'data_atendimento'],
  solicitacoes: ['protocolo', 'titulo', 'status', 'municipio', 'bairro', 'data_abertura']
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

  let header = 'Aqui estao os contatos:';
  if (intent === 'list_location') {
    header = requestedField ? `Aqui esta a ${requestedField}:` : 'Aqui esta a localizacao:';
  } else if (requestedField) {
    header = `Aqui estao os ${requestedField}:`;
  }
  const contactLines = lines
    .filter((item) => item.value)
    .map((item) => `- ${item.label} - ${item.field}: ${item.value}`);
  return [header, ...contactLines].join('\n');
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

  return {
    traceId,
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
    return `campo ${label} = ${value}${matchTag}`;
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
    return `Encontrei ${total} registros em ${tableLabel}.`;
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
    'Evidencias:',
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
  if (!['list', 'search', 'count', 'detail', 'list_contacts', 'none'].includes(action)) return { action: 'none' };
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
    eleitor: 'eleitores',
    eleitores: 'eleitores',
    atendimento: 'atendimentos',
    atendimentos: 'atendimentos',
    solicitacao: 'solicitacoes',
    solicitacoes: 'solicitacoes'
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
  if (table === 'liderancas') return ['nome', 'telefone'];
  if (table === 'eleitores') return ['nome', 'cidade', 'bairro'];
  if (table === 'atendimentos') return ['protocolo', 'assunto'];
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

  let action = '';
  if (countRegex.test(normalized)) action = 'count';
  else if (listRegex.test(normalized)) action = 'list';
  else action = 'search';

  const filters = {};
  const location = extractLocationTerm(text);
  if (location) {
    if (['campanhas', 'agenda_eventos', 'solicitacoes'].includes(table)) {
      filters.municipio = location;
    } else if (table === 'eleitores') {
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
    const merged = Array.from(new Set([...idField, ...contactFields]));
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
  if (filters.cidade && ['eleitores'].includes(table)) {
    const cidadeValue = normalizeTextValue(filters.cidade);
    query = query.ilike('cidade', `%${cidadeValue}%`);
  }
  if (filters.bairro && ['eleitores', 'solicitacoes'].includes(table)) {
    const bairroValue = normalizeTextValue(filters.bairro);
    query = query.ilike('bairro', `%${bairroValue}%`);
  }
  if (filters.data_from) query = query.gte(config.dateField, filters.data_from);
  if (filters.data_to) query = query.lte(config.dateField, filters.data_to);

  if (plan.search) {
    query = applySearchWithFields(query, table, plan.search, getPrimarySearchFields(table));
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

export default async function handler(req, res) {
  const traceId = crypto.randomUUID();
  const startedAt = Date.now();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido', traceId });
  }

  try {
    const { message, user, history } = req.body || {};
    if (!message || !user) {
      return res.status(400).json({ success: false, message: 'Mensagem e usuario sao obrigatorios', traceId });
    }

    if (String(user.nivel || '').toUpperCase() !== 'ADMINISTRADOR') {
      return res.status(403).json({ success: false, message: 'Acesso restrito ao administrador', traceId });
    }

    const config = lerConfiguracoes();
    const providerConfig = getProviderConfig(config);
    if (!config.openai?.enabled || !providerConfig.apiKey) {
      return res.status(400).json({ success: false, message: 'IA nao configurada', disabled: true, traceId });
    }

    const conversationKey = getConversationKey(req, user);
    const lastContext = getConversationContext(conversationKey);
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
        limit: Math.min(followUpResolution.targetIds?.length || 1, 5),
        order: 'date_desc',
        idField: followUpResolution.idField || 'id'
      };

      if (resolvedPlan.table !== followUpResolution.lockedTable) {
        resolvedPlan.table = followUpResolution.lockedTable;
      }

      if (followUpResolution.targetIds && followUpResolution.targetIds.length > 0) {
        resolvedPlan.filters.ids = followUpResolution.targetIds;
        resolvedPlan.filters.id_field = resolvedPlan.idField;
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
    }
    const supabase = createServerClient();
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
          const newContext = buildLastContext(traceId, fallback.plan, fallback.data || []);
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

    if (followUpActive && (!followUpResolution?.targetIds || followUpResolution.targetIds.length === 0)) {
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
            setConversationContext(conversationKey, bootstrapContext);
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

    if (followUpActive && !resolvedPlan.filters?.ids && !resolvedPlan.search) {
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
        const countContext = buildLastContext(traceId, resolvedPlan, [], count);
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
    const reply = followUpActive
      ? buildFollowUpAnswer(resolvedPlan, rows, {
        traceId,
        followUp: followUpResolution,
        lastContext
      })
      : await buildAnswer(
        resolvedPlan,
        rows,
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
      const newContext = buildLastContext(traceId, resolvedPlan, rows);
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
