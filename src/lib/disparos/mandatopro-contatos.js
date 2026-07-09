import { contatoFromPessoa, deduplicarContatos, resumoContatos, toDisparoProContact } from './contatos';

const PAGE_SIZE = 1000;
const MAX_IMPORT_LIMIT = 50000;
const ID_CHUNK_SIZE = 500;

function sanitizeText(value) {
  return String(value || '').trim().replace(/[,()"']/g, '');
}

function clampLimit(value, fallback = 1000) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_IMPORT_LIMIT);
}

function aplicarFiltroCidade(query, cidade, columns = {}) {
  const value = sanitizeText(cidade);
  if (!value) return query;

  const filters = [];
  if (columns.cidade) filters.push(`${columns.cidade}.ilike.%${value}%`);
  if (columns.municipio) filters.push(`${columns.municipio}.ilike.%${value}%`);

  if (filters.length === 0) return query;
  if (filters.length === 1) {
    const [column] = filters[0].split('.ilike.');
    return query.ilike(column, `%${value}%`);
  }

  return query.or(filters.join(','));
}

function aplicarFiltrosComuns(query, { cidade, bairro, search }, columns = {}) {
  let next = aplicarFiltroCidade(query, cidade, columns);

  const bairroLimpo = sanitizeText(bairro);
  if (bairroLimpo && columns.bairro) next = next.ilike(columns.bairro, `%${bairroLimpo}%`);

  const termo = sanitizeText(search);
  if (termo) next = next.ilike('nome', `%${termo}%`);

  return next;
}

function normalizarPresencaCampanha(value) {
  const presenca = sanitizeText(value).toLowerCase();
  if (presenca === 'presentes' || presenca === 'presente') return 'presentes';
  if (presenca === 'ausentes' || presenca === 'ausente') return 'ausentes';
  return '';
}

async function buscarEleitoresPorCampanha(supabase, campanhaId, limit, presencaCampanha = '') {
  const id = sanitizeText(campanhaId);
  if (!id) return null;

  const eleitorIds = [];
  const vistos = new Set();
  const presenca = normalizarPresencaCampanha(presencaCampanha);

  for (let from = 0; eleitorIds.length < limit; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from('atendimentos')
      .select('eleitor_id')
      .eq('campanha_id', id)
      .not('eleitor_id', 'is', null)
      .range(from, to);

    if (presenca === 'presentes') {
      query = query.eq('ausente_acao_campanha', false);
    } else if (presenca === 'ausentes') {
      query = query.eq('ausente_acao_campanha', true);
    }

    const { data, error } = await query;

    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      if (!row.eleitor_id || vistos.has(row.eleitor_id)) continue;
      vistos.add(row.eleitor_id);
      eleitorIds.push(row.eleitor_id);
      if (eleitorIds.length >= limit) break;
    }

    if (data.length < PAGE_SIZE) break;
  }

  return eleitorIds;
}

function criarQueryEleitores(supabase, filtros, options = {}) {
  let query = supabase
    .from('eleitores')
    .select(
      options.select || 'id, nome, telefone, celular, whatsapp, email, cidade, municipio, bairro, status, statusCadastro',
      options.selectOptions
    );

  if (Array.isArray(options.eleitorIds)) {
    query = query.in('id', options.eleitorIds);
  }

  const status = sanitizeText(filtros.status || 'ATIVO');
  if (status) {
    const pattern = `%${status}%`;
    if (status.toUpperCase() === 'ATIVO') {
      query = query.or(`status.ilike.${pattern},statusCadastro.ilike.${pattern},and(status.is.null,statusCadastro.is.null)`);
    } else {
      query = query.or(`status.ilike.${pattern},statusCadastro.ilike.${pattern}`);
    }
  }

  query = aplicarFiltrosComuns(query, filtros, {
    cidade: 'cidade',
    municipio: 'municipio',
    bairro: 'bairro'
  });

  if (options.order !== false) query = query.order('nome', { ascending: true });

  return query;
}

async function fetchPaginated(buildQuery, limit) {
  const rows = [];

  for (let from = 0; rows.length < limit; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE - 1, limit - 1);
    const { data, error } = await buildQuery().range(from, to);

    if (error) throw error;
    if (!data?.length) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  return rows;
}

async function buscarEleitores(supabase, filtros, limit) {
  const eleitorIds = await buscarEleitoresPorCampanha(supabase, filtros.campanhaId, limit, filtros.presencaCampanha);
  if (Array.isArray(eleitorIds) && eleitorIds.length === 0) return [];

  let rows = [];

  if (Array.isArray(eleitorIds)) {
    for (let i = 0; i < eleitorIds.length && rows.length < limit; i += ID_CHUNK_SIZE) {
      const chunk = eleitorIds.slice(i, i + ID_CHUNK_SIZE);
      const remaining = limit - rows.length;
      const data = await fetchPaginated(
        () => criarQueryEleitores(supabase, filtros, { eleitorIds: chunk }),
        Math.min(remaining, chunk.length)
      );
      rows.push(...data);
    }
  } else {
    rows = await fetchPaginated(() => criarQueryEleitores(supabase, filtros), limit);
  }

  return rows.map((row) => contatoFromPessoa(row, 'eleitor'));
}

function criarQueryLiderancas(supabase, filtros, options = {}) {
  let query = supabase
    .from('liderancas')
    .select(options.select || 'id, nome, telefone, email, municipio, bairro, status', options.selectOptions);

  const status = sanitizeText(filtros.status || 'ATIVO');
  if (status) query = query.ilike('status', `%${status}%`);

  query = aplicarFiltrosComuns(query, filtros, {
    municipio: 'municipio',
    bairro: 'bairro'
  });

  if (options.order !== false) query = query.order('nome', { ascending: true });

  return query;
}

async function buscarLiderancas(supabase, filtros, limit) {
  const rows = await fetchPaginated(() => criarQueryLiderancas(supabase, filtros), limit);
  return rows.map((row) => contatoFromPessoa(row, 'lideranca'));
}

function criarQueryFuncionarios(supabase, filtros, options = {}) {
  let query = supabase
    .from('funcionarios')
    .select(options.select || 'id, nome, telefone, email, cidade, bairro, cargo, departamento, status', options.selectOptions);

  const status = sanitizeText(filtros.status || 'ATIVO');
  if (status) query = query.ilike('status', `%${status}%`);

  const termo = sanitizeText(filtros.search);
  if (termo) query = query.ilike('nome', `%${termo}%`);

  query = aplicarFiltroCidade(query, filtros.cidade, { cidade: 'cidade' });
  const bairroLimpo = sanitizeText(filtros.bairro);
  if (bairroLimpo) query = query.ilike('bairro', `%${bairroLimpo}%`);

  if (options.order !== false) query = query.order('nome', { ascending: true });

  return query;
}

async function buscarFuncionarios(supabase, filtros, limit) {
  const rows = await fetchPaginated(() => criarQueryFuncionarios(supabase, filtros), limit);
  return rows.map((row) => contatoFromPessoa(row, 'funcionario'));
}

async function countQuery(query) {
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function contarEleitores(supabase, filtros, limit) {
  const eleitorIds = await buscarEleitoresPorCampanha(supabase, filtros.campanhaId, limit, filtros.presencaCampanha);
  if (Array.isArray(eleitorIds) && eleitorIds.length === 0) return 0;

  if (Array.isArray(eleitorIds)) {
    let total = 0;
    for (let i = 0; i < eleitorIds.length; i += ID_CHUNK_SIZE) {
      const chunk = eleitorIds.slice(i, i + ID_CHUNK_SIZE);
      total += await countQuery(criarQueryEleitores(supabase, filtros, {
        eleitorIds: chunk,
        select: 'id',
        selectOptions: { count: 'exact', head: true },
        order: false
      }));
    }
    return total;
  }

  return countQuery(criarQueryEleitores(supabase, filtros, {
    select: 'id',
    selectOptions: { count: 'exact', head: true },
    order: false
  }));
}

function normalizarFiltros(filtros = {}) {
  const origem = String(filtros.origem || 'eleitores');
  const params = {
    cidade: filtros.cidade,
    bairro: filtros.bairro,
    status: filtros.status,
    search: filtros.search,
    campanhaId: filtros.campanhaId,
    presencaCampanha: filtros.presencaCampanha
  };

  return { origem, params };
}

export async function contarContatosMandatoPro(supabase, filtros = {}) {
  const { origem, params } = normalizarFiltros(filtros);
  const limit = clampLimit(filtros.limit || MAX_IMPORT_LIMIT, MAX_IMPORT_LIMIT);

  let total;
  if (origem === 'liderancas') {
    total = await countQuery(criarQueryLiderancas(supabase, params, {
      select: 'id',
      selectOptions: { count: 'exact', head: true },
      order: false
    }));
  } else if (origem === 'funcionarios') {
    total = await countQuery(criarQueryFuncionarios(supabase, params, {
      select: 'id',
      selectOptions: { count: 'exact', head: true },
      order: false
    }));
  } else {
    total = await contarEleitores(supabase, params, limit);
  }

  return {
    total,
    validos: null,
    invalidos: null,
    duplicados: null
  };
}

export async function buscarContatosMandatoPro(supabase, filtros = {}) {
  const { origem, params } = normalizarFiltros(filtros);
  const limit = clampLimit(filtros.limit || 200, 200);

  let contatosRaw;
  if (origem === 'liderancas') {
    contatosRaw = await buscarLiderancas(supabase, params, limit);
  } else if (origem === 'funcionarios') {
    contatosRaw = await buscarFuncionarios(supabase, params, limit);
  } else {
    contatosRaw = await buscarEleitores(supabase, params, limit);
  }

  const contatos = deduplicarContatos(contatosRaw);

  return {
    contatos,
    resumo: resumoContatos(contatos),
    disparoPro: contatos.filter((contato) => contato.valido).map(toDisparoProContact)
  };
}
