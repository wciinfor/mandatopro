import { contatoFromPessoa, deduplicarContatos, resumoContatos, toDisparoProContact } from './contatos';

function sanitizeText(value) {
  return String(value || '').trim().replace(/[,()"']/g, '');
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

async function buscarEleitoresPorCampanha(supabase, campanhaId, limit) {
  const id = sanitizeText(campanhaId);
  if (!id) return null;

  const { data, error } = await supabase
    .from('atendimentos')
    .select('eleitor_id')
    .eq('campanha_id', id)
    .not('eleitor_id', 'is', null)
    .limit(limit);

  if (error) throw error;

  return [...new Set((data || []).map((row) => row.eleitor_id).filter(Boolean))];
}

async function buscarEleitores(supabase, filtros, limit) {
  const eleitorIds = await buscarEleitoresPorCampanha(supabase, filtros.campanhaId, limit);
  if (Array.isArray(eleitorIds) && eleitorIds.length === 0) return [];

  let query = supabase
    .from('eleitores')
    .select('id, nome, telefone, celular, whatsapp, email, cidade, municipio, bairro, status, statusCadastro')
    .limit(limit)
    .order('nome', { ascending: true });

  if (Array.isArray(eleitorIds)) {
    query = query.in('id', eleitorIds);
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

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => contatoFromPessoa(row, 'eleitor'));
}

async function buscarLiderancas(supabase, filtros, limit) {
  let query = supabase
    .from('liderancas')
    .select('id, nome, telefone, email, municipio, bairro, status')
    .limit(limit)
    .order('nome', { ascending: true });

  const status = sanitizeText(filtros.status || 'ATIVO');
  if (status) query = query.ilike('status', `%${status}%`);

  query = aplicarFiltrosComuns(query, filtros, {
    municipio: 'municipio',
    bairro: 'bairro'
  });

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => contatoFromPessoa(row, 'lideranca'));
}

async function buscarFuncionarios(supabase, filtros, limit) {
  let query = supabase
    .from('funcionarios')
    .select('id, nome, telefone, email, cidade, bairro, cargo, departamento, status')
    .limit(limit)
    .order('nome', { ascending: true });

  const status = sanitizeText(filtros.status || 'ATIVO');
  if (status) query = query.ilike('status', `%${status}%`);

  const termo = sanitizeText(filtros.search);
  if (termo) query = query.ilike('nome', `%${termo}%`);

  query = aplicarFiltroCidade(query, filtros.cidade, { cidade: 'cidade' });
  const bairroLimpo = sanitizeText(filtros.bairro);
  if (bairroLimpo) query = query.ilike('bairro', `%${bairroLimpo}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => contatoFromPessoa(row, 'funcionario'));
}

export async function buscarContatosMandatoPro(supabase, filtros = {}) {
  const origem = String(filtros.origem || 'eleitores');
  const limit = Math.min(Math.max(Number(filtros.limit || 200), 1), 5000);
  const params = {
    cidade: filtros.cidade,
    bairro: filtros.bairro,
    status: filtros.status,
    search: filtros.search,
    campanhaId: filtros.campanhaId
  };

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
