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

function buildReply(plan, rows, count) {
  if (plan.action === 'count') {
    return `Encontrei ${count || 0} registros em ${plan.table.replace('_', ' ')}.`;
  }

  if (!rows || rows.length === 0) {
    return 'Nao encontrei registros com esse filtro.';
  }

  const linhas = rows.map((row) => `- ${formatRow(plan.table, row)}`);
  return `Aqui estao os resultados:\n${linhas.join('\n')}`;
}

async function gerarPlanoConsulta(question, provider) {
  const systemPrompt = `Voce e um planejador de consultas do MandatoPro.\n` +
    `Responda APENAS com JSON valido.\n` +
    `Tabelas permitidas: ${Object.keys(allowedTables).join(', ')}.\n` +
    `Acoes permitidas: list, search, count, none.\n` +
    `Filtros permitidos: status, municipio, cidade, bairro, data_from, data_to.\n` +
    `Use o campo search para nome/titulo/protocolo.\n` +
    `Se mencionar campanha(s), use table campanhas.\n` +
    `Se mencionar agenda ou evento, use table agenda_eventos.\n` +
    `Se mencionar lideranca(s), use table liderancas.\n` +
    `Se mencionar eleitor(es), use table eleitores.\n` +
    `Se mencionar atendimento(s), use table atendimentos.\n` +
    `Se mencionar solicitacao(oes), use table solicitacoes.\n` +
    `Se houver "em <cidade>", use filters.municipio com o valor.\n` +
    `Se a pergunta pedir quantidade (quantos/quantas), use action count.\n` +
    `Exemplo: {"action":"list","table":"campanhas","filters":{"status":"PLANEJAMENTO"},"search":"saude","limit":5,"order":"date_desc"}.\n` +
    `Se nao for pergunta de dados, use {"action":"none","reason":"..."}.`;

  const response = await fetch(provider.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0,
      max_tokens: 200,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ]
    })
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

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  try {
    return JSON.parse(content);
  } catch (error) {
    return { action: 'none', reason: 'Falha ao interpretar a pergunta.' };
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
    quantidade: 'count'
  };
  const action = actionAliases[actionRaw] || actionRaw;
  if (!['list', 'search', 'count', 'none'].includes(action)) return { action: 'none' };
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

  return {
    action,
    table,
    filters: plan.filters || {},
    search: plan.search || '',
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

function applyFilters(query, table, plan) {
  const config = allowedTables[table];
  const filters = plan.filters || {};
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
    const searchText = normalizeTextValue(plan.search);
    const searchValue = `*${searchText}*`;
    if (table === 'campanhas') {
      query = query.or(`nome.ilike.${searchValue},municipio.ilike.${searchValue},local.ilike.${searchValue}`);
    } else if (table === 'agenda_eventos') {
      query = query.or(`titulo.ilike.${searchValue},municipio.ilike.${searchValue},local.ilike.${searchValue}`);
    } else if (table === 'solicitacoes') {
      query = query.or(`titulo.ilike.${searchValue},protocolo.ilike.${searchValue},municipio.ilike.${searchValue},bairro.ilike.${searchValue}`);
    } else if (table === 'liderancas') {
      query = query.or(`nome.ilike.${searchValue},telefone.ilike.${searchValue}`);
    } else {
      query = query.ilike(config.searchField, `%${searchText}%`);
    }
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  }

  try {
    const { message, user, history } = req.body || {};
    if (!message || !user) {
      return res.status(400).json({ success: false, message: 'Mensagem e usuario sao obrigatorios' });
    }

    if (String(user.nivel || '').toUpperCase() !== 'ADMINISTRADOR') {
      return res.status(403).json({ success: false, message: 'Acesso restrito ao administrador' });
    }

    const config = lerConfiguracoes();
    const providerConfig = getProviderConfig(config);
    if (!config.openai?.enabled || !providerConfig.apiKey) {
      return res.status(400).json({ success: false, message: 'IA nao configurada', disabled: true });
    }

    const question = buildQuestionWithContext(message, history);
    const planRaw = await gerarPlanoConsulta(question, providerConfig);
    const plan = normalizePlan(planRaw);
    let resolvedPlan = plan;
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
    const supabase = createServerClient();

    if (resolvedPlan.action === 'none') {
      const fallback = await tryFallbackCampaigns(supabase, question, history, 5);
      if (fallback) {
        const reply = buildReply(fallback.plan, fallback.data || []);
        return res.status(200).json({ success: true, reply, data: fallback.data || [] });
      }

      return res.status(200).json({
        success: true,
        reply: 'Posso ajudar com consultas de campanhas, agenda, liderancas, eleitores, atendimentos e solicitacoes. Descreva o que voce precisa.'
      });
    }

    const configTable = allowedTables[resolvedPlan.table];

    if (resolvedPlan.action === 'count') {
      let query = supabase
        .from(resolvedPlan.table)
        .select('id', { count: 'exact', head: true });

      query = applyFilters(query, resolvedPlan.table, resolvedPlan);
      const { count, error } = await query;

      if (error) {
        return res.status(400).json({ success: false, message: error.message });
      }

      return res.status(200).json({
        success: true,
        reply: buildReply(resolvedPlan, [], count),
        count
      });
    }

    let query = supabase
      .from(resolvedPlan.table)
      .select(configTable.fields)
      .limit(resolvedPlan.limit);

    query = applyFilters(query, resolvedPlan.table, resolvedPlan);

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    let rows = data || [];
    if (rows.length === 0) {
      const fallback = await tryFallbackCampaigns(supabase, question, history, resolvedPlan.limit);
      if (fallback) {
        resolvedPlan = fallback.plan;
        rows = fallback.data || [];
      }
    }

    if (rows.length === 0 && resolvedPlan.action === 'list') {
      const fallbackAll = await tryFallbackListAll(supabase, resolvedPlan.table, resolvedPlan.limit);
      if (fallbackAll) {
        resolvedPlan = fallbackAll.plan;
        rows = fallbackAll.data || [];
      }
    }

    const reply = buildReply(resolvedPlan, rows);
    return res.status(200).json({ success: true, reply, data: rows });
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
        disabled: true
      });
    }

    return res.status(500).json({ success: false, message: error.message });
  }
}
