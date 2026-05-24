import { contatoFromPessoa, deduplicarContatos, resumoContatos, toDisparoProContact } from './contatos';

function sanitizeText(value) {
  return String(value || '').trim().replace(/[,()"']/g, '');
}

function aplicarFiltroCidade(query, cidade) {
  const value = sanitizeText(cidade);
  if (!value) return query;
  return query.or(`cidade.ilike.%${value}%,municipio.ilike.%${value}%`);
}

function aplicarFiltrosComuns(query, { cidade, bairro, search }) {
  let next = aplicarFiltroCidade(query, cidade);

  const bairroLimpo = sanitizeText(bairro);
  if (bairroLimpo) next = next.ilike('bairro', `%${bairroLimpo}%`);

  const termo = sanitizeText(search);
  if (termo) next = next.ilike('nome', `%${termo}%`);

  return next;
}

async function buscarEleitores(supabase, filtros, limit) {
  let query = supabase
    .from('eleitores')
    .select('id, nome, telefone, celular, whatsapp, email, cidade, municipio, bairro, status, statusCadastro')
    .limit(limit)
    .order('nome', { ascending: true });

  const status = sanitizeText(filtros.status || 'ATIVO');
  if (status) {
    const pattern = `%${status}%`;
    if (status.toUpperCase() === 'ATIVO') {
      query = query.or(`status.ilike.${pattern},statusCadastro.ilike.${pattern},and(status.is.null,statusCadastro.is.null)`);
    } else {
      query = query.or(`status.ilike.${pattern},statusCadastro.ilike.${pattern}`);
    }
  }

  query = aplicarFiltrosComuns(query, filtros);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => contatoFromPessoa(row, 'eleitor'));
}

async function buscarLiderancas(supabase, filtros, limit) {
  let query = supabase
    .from('liderancas')
    .select('id, nome, telefone, email, cidade, municipio, bairro, status')
    .limit(limit)
    .order('nome', { ascending: true });

  const status = sanitizeText(filtros.status || 'ATIVO');
  if (status) query = query.ilike('status', `%${status}%`);

  query = aplicarFiltrosComuns(query, filtros);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => contatoFromPessoa(row, 'lideranca'));
}

async function buscarFuncionarios(supabase, filtros, limit) {
  let query = supabase
    .from('funcionarios')
    .select('id, nome, telefone, email, cargo, departamento, status')
    .limit(limit)
    .order('nome', { ascending: true });

  const status = sanitizeText(filtros.status || 'ATIVO');
  if (status) query = query.ilike('status', `%${status}%`);

  const termo = sanitizeText(filtros.search);
  if (termo) query = query.ilike('nome', `%${termo}%`);

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
    search: filtros.search
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
