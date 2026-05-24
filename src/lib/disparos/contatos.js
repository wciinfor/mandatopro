export function normalizarTelefone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';

  let phone = digits;
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (phone.startsWith('55') && phone.length > 11) phone = phone.slice(2);
  if (phone.length === 10 || phone.length === 11) return `55${phone}`;
  if (phone.length >= 12 && phone.length <= 13) return phone;
  return '';
}

export function melhorTelefone(row = {}) {
  return row.whatsapp || row.celular || row.telefone || row.phone || row.mobile || '';
}

export function contatoFromPessoa(row = {}, origem = 'eleitor') {
  const telefoneOriginal = melhorTelefone(row);
  const telefoneNormalizado = normalizarTelefone(telefoneOriginal);
  const cidade = row.municipio || row.cidade || '';

  return {
    origem,
    origemId: row.id || null,
    nome: row.nome || '',
    telefoneOriginal,
    telefoneNormalizado,
    email: row.email || '',
    cidade,
    bairro: row.bairro || '',
    valido: Boolean(telefoneNormalizado),
    motivoInvalido: telefoneNormalizado ? '' : 'Telefone ausente ou incompleto',
    duplicado: false,
    metadata: {
      cargo: row.cargo || '',
      departamento: row.departamento || '',
      status: row.status || row.statusCadastro || ''
    }
  };
}

export function deduplicarContatos(contatos = []) {
  const vistos = new Set();

  return contatos.map((contato) => {
    const key = contato.telefoneNormalizado || '';
    const duplicado = Boolean(key && vistos.has(key));
    if (key && !duplicado) vistos.add(key);
    return {
      ...contato,
      duplicado,
      valido: Boolean(contato.valido && !duplicado),
      motivoInvalido: duplicado ? 'Telefone duplicado' : contato.motivoInvalido
    };
  });
}

export function resumoContatos(contatos = []) {
  return contatos.reduce((acc, contato) => {
    acc.total += 1;
    if (contato.valido) acc.validos += 1;
    if (!contato.valido) acc.invalidos += 1;
    if (contato.duplicado) acc.duplicados += 1;
    return acc;
  }, { total: 0, validos: 0, invalidos: 0, duplicados: 0 });
}

export function toDbContato(campanhaId, contato) {
  return {
    campanha_id: campanhaId,
    origem: contato.origem || 'manual',
    origem_id: contato.origemId || null,
    nome: contato.nome || null,
    telefone_original: contato.telefoneOriginal || null,
    telefone_normalizado: contato.telefoneNormalizado || null,
    cidade: contato.cidade || null,
    bairro: contato.bairro || null,
    valido: Boolean(contato.valido),
    motivo_invalido: contato.motivoInvalido || null,
    duplicado: Boolean(contato.duplicado),
    metadata: contato.metadata || {}
  };
}

export function toDisparoProContact(contato = {}) {
  return {
    name: contato.nome || '',
    phone: contato.telefoneNormalizado || contato.telefoneOriginal || '',
    email: contato.email || '',
    source: contato.origem || 'manual',
    sourceId: contato.origemId || null,
    city: contato.cidade || '',
    neighborhood: contato.bairro || '',
    metadata: contato.metadata || {}
  };
}

export function fromDbContato(row = {}) {
  return {
    id: row.id,
    campanhaId: row.campanha_id,
    origem: row.origem,
    origemId: row.origem_id,
    nome: row.nome || '',
    telefoneOriginal: row.telefone_original || '',
    telefoneNormalizado: row.telefone_normalizado || '',
    cidade: row.cidade || '',
    bairro: row.bairro || '',
    valido: Boolean(row.valido),
    motivoInvalido: row.motivo_invalido || '',
    duplicado: Boolean(row.duplicado),
    metadata: row.metadata || {}
  };
}
