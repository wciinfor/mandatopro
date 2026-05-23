const MS_POR_DIA = 24 * 60 * 60 * 1000;

const STATUS_ATIVO = 'ATIVO';

const CAMPOS_DATA_NASCIMENTO = ['data_nascimento', 'dataNascimento', 'datanascimento'];
const CAMPOS_NOME = ['nome', 'nome_completo'];
const CAMPOS_EMAIL = ['email'];
const CAMPOS_FOTO = ['foto', 'avatar', 'imagem'];
const CAMPOS_CPF = ['cpf'];
const CAMPOS_ELEITOR_ID = ['eleitor_id'];

function inicioDoDia(data = new Date()) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function primeiroValor(obj, campos = []) {
  for (const campo of campos) {
    const valor = obj?.[campo];
    if (valor !== undefined && valor !== null && String(valor).trim() !== '') {
      return valor;
    }
  }

  return null;
}

function parseDataNascimento(valor) {
  if (!valor) {
    return null;
  }

  const texto = String(valor).trim();
  const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return null;
  }

  const ano = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);

  if (!ano || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return null;
  }

  const dataTeste = new Date(ano, mes - 1, dia);
  if (
    dataTeste.getFullYear() !== ano
    || dataTeste.getMonth() !== mes - 1
    || dataTeste.getDate() !== dia
  ) {
    return null;
  }

  return { ano, mes, dia };
}

function normalizarStatus(status) {
  if (status === undefined || status === null || String(status).trim() === '') {
    return STATUS_ATIVO;
  }

  return String(status).trim().toUpperCase();
}

function fotoSegura(foto) {
  if (!foto) {
    return null;
  }

  const valor = String(foto).trim();
  if (valor.startsWith('data:')) {
    return null;
  }

  return valor;
}

function normalizarCpf(valor) {
  if (!valor) {
    return '';
  }

  const digits = String(valor).replace(/\D+/g, '');
  if (digits.length !== 11) {
    return '';
  }

  return digits;
}

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function calcularDetalhesAniversario(dataNascimento, dataBase = new Date()) {
  const { ano, mes, dia } = dataNascimento;
  const hoje = inicioDoDia(dataBase);

  const aniversarioEsteAno = new Date(hoje.getFullYear(), mes - 1, dia);
  const proximoAniversario = new Date(aniversarioEsteAno);

  if (proximoAniversario < hoje) {
    proximoAniversario.setFullYear(hoje.getFullYear() + 1);
  }

  const diasAte = Math.round((proximoAniversario - hoje) / MS_POR_DIA);

  const idade = Number.isFinite(ano)
    ? (hoje.getFullYear() - ano + (aniversarioEsteAno < hoje ? 1 : 0))
    : null;

  return {
    dia,
    mes,
    anoNascimento: ano,
    idade,
    diasAte,
    proximoAniversario: proximoAniversario.toISOString().slice(0, 10)
  };
}

function limitar(valor, minimo, maximo, padrao) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    return padrao;
  }

  return Math.min(Math.max(Math.floor(numero), minimo), maximo);
}

function compararAniversariantes(a, b) {
  if (a.diasAte !== b.diasAte) {
    return a.diasAte - b.diasAte;
  }

  if (a.mes !== b.mes) {
    return a.mes - b.mes;
  }

  if (a.dia !== b.dia) {
    return a.dia - b.dia;
  }

  return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
}

function inicializarInconsistencias() {
  return {
    eleitor: { semNome: 0, semDataNascimento: 0, inativoIgnorado: 0 },
    lideranca: { semNome: 0, semDataNascimento: 0, inativoIgnorado: 0 },
    funcionario: { semNome: 0, semDataNascimento: 0, inativoIgnorado: 0 },
    totais: { semNome: 0, semDataNascimento: 0, inativoIgnorado: 0 }
  };
}

function registrarInconsistencia(inconsistencias, tipo, chave) {
  inconsistencias[tipo][chave] += 1;
  inconsistencias.totais[chave] += 1;
}

function montarAniversariante({
  registro,
  tipo,
  incluirInativos,
  dataBase,
  inconsistencias,
  chaveRelacionamento = ''
}) {
  const nome = primeiroValor(registro, CAMPOS_NOME);
  if (!nome) {
    registrarInconsistencia(inconsistencias, tipo, 'semNome');
    return null;
  }

  const status = normalizarStatus(registro?.status);
  if (!incluirInativos && status !== STATUS_ATIVO) {
    registrarInconsistencia(inconsistencias, tipo, 'inativoIgnorado');
    return null;
  }

  const valorDataNascimento = primeiroValor(registro, CAMPOS_DATA_NASCIMENTO);
  const dataNascimento = parseDataNascimento(valorDataNascimento);

  if (!dataNascimento) {
    registrarInconsistencia(inconsistencias, tipo, 'semDataNascimento');
    return null;
  }

  const detalhes = calcularDetalhesAniversario(dataNascimento, dataBase);
  const cpfNormalizado = normalizarCpf(primeiroValor(registro, CAMPOS_CPF));
  const email = primeiroValor(registro, CAMPOS_EMAIL) || '';

  const nomeNormalizado = normalizarTexto(nome);
  const emailNormalizado = normalizarTexto(email);
  const eleitorId = Number(primeiroValor(registro, CAMPOS_ELEITOR_ID) || 0) || null;
  const chaveDeduplicacao =
    (cpfNormalizado ? `cpf:${cpfNormalizado}` : '')
    || (emailNormalizado ? `email:${emailNormalizado}` : `nome:${nomeNormalizado}|${detalhes.mes}|${detalhes.dia}`);
  const chaveFinal =
    chaveDeduplicacao
    || (chaveRelacionamento ? String(chaveRelacionamento) : '')
    || (eleitorId ? `eleitor:${eleitorId}` : '');

  return {
    id: registro?.id,
    tipo,
    nome: String(nome).trim(),
    email,
    status,
    foto: fotoSegura(primeiroValor(registro, CAMPOS_FOTO)),
    eleitorId,
    cpfNormalizado,
    chaveDeduplicacao: chaveFinal,
    tiposRelacionados: [tipo],
    statusPorTipo: {
      [tipo]: status
    },
    ...detalhes
  };
}

function scoreTipo(tipo) {
  if (tipo === 'lideranca') return 3;
  if (tipo === 'funcionario') return 2;
  return 1;
}

function scoreQualidade(item) {
  let score = 0;
  if (item?.email) score += 2;
  if (item?.foto) score += 1;
  if (item?.cpfNormalizado) score += 2;
  if (Number.isFinite(item?.idade)) score += 1;
  return score + scoreTipo(item?.tipo);
}

function deduplicarLista(lista) {
  const mapa = new Map();

  for (const item of lista) {
    const chave = item?.chaveDeduplicacao
      || `${item?.tipo || 'x'}:${item?.id || 'sem-id'}:${normalizarTexto(item?.nome)}:${item?.mes || 0}:${item?.dia || 0}`;
    const atual = mapa.get(chave);

    if (!atual) {
      mapa.set(chave, item);
      continue;
    }

    const baseTipos = new Set([...(atual.tiposRelacionados || [atual.tipo]), ...(item.tiposRelacionados || [item.tipo])]);
    const statusPorTipo = {
      ...(atual.statusPorTipo || {}),
      ...(item.statusPorTipo || {})
    };

    const scoreAtual = scoreQualidade(atual);
    const scoreNovo = scoreQualidade(item);

    const candidatoMelhor = scoreNovo > scoreAtual ? item : atual;

    mapa.set(chave, {
      ...candidatoMelhor,
      tiposRelacionados: Array.from(baseTipos),
      statusPorTipo
    });
  }

  return Array.from(mapa.values());
}

function limparCamposInternos(lista) {
  return lista.map((itemOriginal) => {
    const item = { ...itemOriginal };

    const tipos = Array.isArray(item.tiposRelacionados) ? item.tiposRelacionados : [item.tipo];
    const prioridade = ['lideranca', 'funcionario', 'eleitor'];
    const tipoPrincipal = prioridade.find((tipo) => tipos.includes(tipo)) || item.tipo || 'eleitor';

    item.tipo = tipoPrincipal;
    item.hierarquia = tipoPrincipal.toUpperCase();
    item.statusHierarquia = item.statusPorTipo?.[tipoPrincipal] || item.status || STATUS_ATIVO;
    item.statusCadastro = item.statusPorTipo?.eleitor || item.status || STATUS_ATIVO;

    const { cpfNormalizado, chaveDeduplicacao, statusPorTipo, ...publico } = item;
    return publico;
  });
}

function resumoPorTipo(lista) {
  return {
    eleitor: lista.filter((item) => item.tipo === 'eleitor').length,
    lideranca: lista.filter((item) => item.tipo === 'lideranca').length,
    funcionario: lista.filter((item) => item.tipo === 'funcionario').length
  };
}

export async function carregarSnapshotAniversariantes(supabase, opcoes = {}) {
  const incluirInativos = Boolean(opcoes.incluirInativos);
  const deduplicar = opcoes.deduplicar === undefined ? true : Boolean(opcoes.deduplicar);
  const limite = limitar(opcoes.limite, 1, 5000, 500);
  const dataBase = opcoes.dataBase ? new Date(opcoes.dataBase) : new Date();

  const inconsistencias = inicializarInconsistencias();

  const [eleitoresResp, liderancasResp, funcionariosResp] = await Promise.all([
    supabase.from('eleitores').select('*'),
    supabase.from('liderancas').select('*'),
    supabase.from('funcionarios').select('*')
  ]);

  if (eleitoresResp.error) throw eleitoresResp.error;
  if (liderancasResp.error) throw liderancasResp.error;
  if (funcionariosResp.error) throw funcionariosResp.error;

  const eleitores = Array.isArray(eleitoresResp.data) ? eleitoresResp.data : [];
  const liderancas = Array.isArray(liderancasResp.data) ? liderancasResp.data : [];
  const funcionarios = Array.isArray(funcionariosResp.data) ? funcionariosResp.data : [];

  const eleitoresPorId = new Map(
    eleitores
      .filter((item) => item?.id !== undefined && item?.id !== null)
      .map((item) => [Number(item.id), item])
  );

  const lista = [];

  for (const eleitor of eleitores) {
    const item = montarAniversariante({
      registro: eleitor,
      tipo: 'eleitor',
      incluirInativos,
      dataBase,
      inconsistencias
    });

    if (item) {
      lista.push(item);
    }
  }

  for (const lideranca of liderancas) {
    const cpfLideranca = normalizarCpf(primeiroValor(lideranca, CAMPOS_CPF));
    const emailLideranca = normalizarTexto(primeiroValor(lideranca, CAMPOS_EMAIL) || '');
    const chaveRelacionamento =
      (cpfLideranca ? `cpf:${cpfLideranca}` : '')
      || (emailLideranca ? `email:${emailLideranca}` : '');

    const item = montarAniversariante({
      registro: lideranca,
      tipo: 'lideranca',
      incluirInativos,
      dataBase,
      inconsistencias,
      chaveRelacionamento
    });

    if (item) {
      lista.push(item);
    }
  }

  for (const funcionario of funcionarios) {
    const eleitorVinculado = Number.isFinite(Number(funcionario?.eleitor_id))
      ? eleitoresPorId.get(Number(funcionario.eleitor_id))
      : null;

    const registroMesclado = {
      ...(eleitorVinculado || {}),
      ...(funcionario || {}),
      status: funcionario?.status ?? eleitorVinculado?.status
    };

    const item = montarAniversariante({
      registro: registroMesclado,
      tipo: 'funcionario',
      incluirInativos,
      dataBase,
      inconsistencias,
      chaveRelacionamento: funcionario?.eleitor_id ? `eleitor:${Number(funcionario.eleitor_id)}` : ''
    });

    if (item) {
      lista.push(item);
    }
  }

  lista.sort(compararAniversariantes);

  const totalAntesDeduplicacao = lista.length;
  const listaPosDeduplicacao = deduplicar ? deduplicarLista(lista) : lista;

  listaPosDeduplicacao.sort(compararAniversariantes);
  const listaPublica = limparCamposInternos(listaPosDeduplicacao);

  const resumo = {
    totalAniversariantes: listaPublica.length,
    aniversariantesHoje: listaPublica.filter((item) => item.diasAte === 0).length,
    aniversariantesSemana: listaPublica.filter((item) => item.diasAte <= 7).length,
    aniversariantesMes: listaPublica.filter((item) => item.diasAte <= 30).length,
    totalPorTipo: resumoPorTipo(listaPublica),
    deduplicacao: {
      habilitada: deduplicar,
      totalOriginal: totalAntesDeduplicacao,
      totalRemovido: Math.max(totalAntesDeduplicacao - listaPublica.length, 0)
    }
  };

  return {
    resumo,
    listaCompleta: listaPublica,
    proximosAniversariantes: listaPublica.slice(0, limite),
    inconsistencias
  };
}
