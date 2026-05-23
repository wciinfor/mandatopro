import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

const CIDADES_CACHE_TTL_MS = 10 * 60 * 1000;
const cidadesCache = new Map();

function aplicarFiltrosBase(query, { status, liderancaFiltro, excludeLiderancas }) {
  let next = query;

  // CORREÇÃO: usar ilike (case-insensitive) em vez de eq.
  // Após importação de CSV grande, muitos registros chegam com:
  //   - status null (não preenchido na importação)
  //   - casing diferente: 'ativo', 'Ativo' etc.
  // Para o filtro ATIVO incluímos também registros onde AMBAS as colunas são null
  // (tratados como ATIVO por padrão, igual ao DEFAULT da tabela).
  if (status) {
    const s = String(status).toUpperCase();
    const pattern = `%${s}%`;
    if (s === 'ATIVO') {
      next = next.or(
        `status.ilike.${pattern},statusCadastro.ilike.${pattern},and(status.is.null,statusCadastro.is.null)`
      );
    } else {
      next = next.or(`status.ilike.${pattern},statusCadastro.ilike.${pattern}`);
    }
  }

  if (excludeLiderancas === 'true' || excludeLiderancas === true) {
    next = next.is('lideranca_id', null);
  }

  if (liderancaFiltro) {
    next = next.eq('lideranca_id', liderancaFiltro);
  }

  return next;
}

function tentarCorrigirLatin1ParaUtf8(value) {
  const texto = String(value || '');
  if (!/[ÃÂ]/.test(texto)) {
    return texto;
  }

  try {
    return Buffer.from(texto, 'latin1').toString('utf8');
  } catch {
    return texto;
  }
}

function limparCidadeDisplay(value) {
  return tentarCorrigirLatin1ParaUtf8(value)
    .replace(/\uFFFD/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarCidadeKey(value) {
  return limparCidadeDisplay(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calcularQualidadeTexto(value) {
  const texto = String(value || '');
  let score = 0;
  if (!texto.includes('�')) score += 2;
  if (!/[ÃÂ]/.test(texto)) score += 2;
  if (/[A-Za-z]/.test(texto)) score += 1;
  if (texto.trim().length >= 4) score += 1;
  return score;
}

async function carregarCidadesDisponiveis(supabase, { status, liderancaFiltro, excludeLiderancas }) {
  const chaveCache = `status:${status || 'ALL'}|lideranca:${liderancaFiltro || 'ALL'}|exclude:${excludeLiderancas ? '1' : '0'}`;
  const cache = cidadesCache.get(chaveCache);
  if (cache && Array.isArray(cache.data) && cache.data.length > 0) {
    return cache.data;
  }

  // Carga paginada sem depender de count/head, que pode retornar zero/nulo
  // dependendo de permissao, cache ou inconsistencias temporarias.
  const pageSize = 1000;
  const MAX_PAGINAS_CIDADES = 300; // processa até 300k registros para cidades
  const MAX_PAGINAS_SEM_NOVAS_CIDADES = 6;
  const cidadesMap = new Map();

  const processarCidade = (cidadeRaw) => {
    const value = String(cidadeRaw || '').trim();
    if (!value) return;

    const labelBase = limparCidadeDisplay(value);
    const keyBase = normalizarCidadeKey(labelBase || value);
    if (!keyBase) return;

    const key = keyBase;
    const label = labelBase || value;

    const atual = cidadesMap.get(key) || {
      key,
      label,
      qualidade: -1,
      values: new Set(),
    };

    const qualidadeAtual = calcularQualidadeTexto(label);
    if (qualidadeAtual > atual.qualidade) {
      atual.label = label;
      atual.qualidade = qualidadeAtual;
    }

    atual.values.add(value);
    cidadesMap.set(key, atual);
  };

  const coletarCidades = async (filtros) => {
    let ultimoId = 0;
    let paginasSemNovasCidades = 0;

    for (let pagina = 0; pagina < MAX_PAGINAS_CIDADES; pagina += 1) {
      const pageQuery = aplicarFiltrosBase(
        supabase
          .from('eleitores')
          .select('cidade,municipio,id')
          .gt('id', ultimoId)
          .order('id', { ascending: true })
          .limit(pageSize),
        filtros
      );

      const lote = await pageQuery;
      if (lote.error) {
        throw lote.error;
      }

      const rows = Array.isArray(lote.data) ? lote.data : [];
      if (rows.length === 0) {
        break;
      }

      const totalAntes = cidadesMap.size;

      for (const row of rows) {
        processarCidade(row?.cidade);
        processarCidade(row?.municipio);
      }

      if (cidadesMap.size === totalAntes) {
        paginasSemNovasCidades += 1;
      } else {
        paginasSemNovasCidades = 0;
      }

      if (paginasSemNovasCidades >= MAX_PAGINAS_SEM_NOVAS_CIDADES) {
        break;
      }

      const ultimoRegistro = rows[rows.length - 1];
      const proximoUltimoId = Number(ultimoRegistro?.id || 0);
      if (!proximoUltimoId || proximoUltimoId <= ultimoId) {
        break;
      }
      ultimoId = proximoUltimoId;

      if (rows.length < pageSize) {
        break;
      }
    }
  };

  await coletarCidades({ status, liderancaFiltro, excludeLiderancas });

  // Fallback: se nao encontrou cidade com status filtrado, tenta sem status.
  if (cidadesMap.size === 0 && status) {
    await coletarCidades({ status: undefined, liderancaFiltro, excludeLiderancas });
  }

  const data = Array.from(cidadesMap.values())
    .map((item) => ({
      key: item.key,
      label: item.label,
      values: Array.from(item.values),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  const agora = Date.now();
  cidadesCache.set(chaveCache, {
    expireAt: agora + CIDADES_CACHE_TTL_MS,
    data,
  });

  return data;
}

export default async function handler(req, res) {
  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    // GET - Listar eleitores
    if (req.method === 'GET') {
      const {
        status,
        search,
        liderancaId,
        lideranca_id,
        cidade,
        cidadeValues,
        onlyCities,
        limit = 100,
        offset = 0,
        excludeLiderancas = false
      } = req.query;

      const liderancaFiltro = liderancaId || lideranca_id;

      if (String(onlyCities || '').toLowerCase() === 'true') {
        const cidades = await carregarCidadesDisponiveis(supabase, {
          status,
          liderancaFiltro,
          excludeLiderancas,
        });

        return res.status(200).json({ data: cidades });
      }

      const cidadeValuesArr = Array.isArray(cidadeValues)
        ? cidadeValues
        : cidadeValues
          ? [cidadeValues]
          : [];
      let cidadeValuesLimpos = cidadeValuesArr
        .map((v) => String(v || '').trim())
        .filter(Boolean);

      // Quando o frontend envia apenas a chave normalizada da cidade,
      // converte a chave para os valores reais mapeados (cidade/municipio)
      // para garantir filtro correto mesmo com acentos/casing diferentes.
      if (cidadeValuesLimpos.length === 0 && cidade) {
        const cidadeParam = String(cidade || '').trim();
        const cidadeKeyParam = normalizarCidadeKey(cidadeParam);

        if (cidadeKeyParam) {
          const cidadesDisponiveis = await carregarCidadesDisponiveis(supabase, {
            status,
            liderancaFiltro,
            excludeLiderancas,
          });

          const cidadeOpcao = cidadesDisponiveis.find(
            (item) => item.key === cidadeKeyParam || normalizarCidadeKey(item.label) === cidadeKeyParam
          );

          if (cidadeOpcao?.values?.length) {
            cidadeValuesLimpos = cidadeOpcao.values
              .map((v) => String(v || '').trim())
              .filter(Boolean);
          }
        }
      }

      let query = aplicarFiltrosBase(
        supabase.from('eleitores').select('*', { count: 'exact' }),
        { status, liderancaFiltro, excludeLiderancas }
      );

      // Busca por nome, CPF, RG ou título eleitoral.
      // CORREÇÃO: sanitizar o termo de busca (remover vírgulas que quebram o
      // parser do PostgREST) e adicionar variante apenas com dígitos para
      // encontrar CPF/RG tanto formatado quanto sem formatação.
      if (search && search.trim().length > 0) {
        // Sanitização: vírgulas quebrariam o parser de .or(); aspas e parênteses
        // também causam problemas — removemos todos esses caracteres.
        const q = search.trim().replace(/[,()"']/g, '');
        if (q.length > 0) {
          const filtrosBase = [
            `nome.ilike.%${q}%`,
            `cpf.ilike.%${q}%`,
            `rg.ilike.%${q}%`,
            `tituloEleitoral.ilike.%${q}%`,
            `municipio.ilike.%${q}%`,
          ];
          // Se o termo contém caracteres não-dígito (ex: formatação de CPF
          // "123.456.789-00"), também busca pela versão sem formatação.
          const qDigitos = q.replace(/\D/g, '');
          if (qDigitos.length >= 3 && qDigitos !== q) {
            filtrosBase.push(`cpf.ilike.%${qDigitos}%`, `rg.ilike.%${qDigitos}%`);
          }
          query = query.or(filtrosBase.join(','));
        }
      }

      if (cidadeValuesLimpos.length > 0) {
        const filtrosCidade = cidadeValuesLimpos
          .map((v) => `cidade.eq.${v}`)
          .concat(cidadeValuesLimpos.map((v) => `municipio.eq.${v}`));
        query = query.or(filtrosCidade.join(','));
      } else if (cidade) {
        query = query.or(`cidade.eq.${cidade},municipio.eq.${cidade}`);
      }

      const { data: eleitores, count, error } = await query
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
        .order('nome', { ascending: true });

      if (error) {
        return res.status(400).json({
          message: 'Erro ao listar eleitores',
          error: error.message
        });
      }

      return res.status(200).json({
        data: eleitores,
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    }

    // POST - Criar novo eleitor
    if (req.method === 'POST') {
      const body = req.body || {};
      const normalizar = (value) => (value === '' ? null : value);

      const payload = {
        nome: normalizar(body.nome),
        cpf: normalizar(body.cpf),
        email: normalizar(body.email),
        telefone: normalizar(body.telefone),
        celular: normalizar(body.celular),
        whatsapp: normalizar(body.whatsapp),
        tituloEleitoral: normalizar(body.tituloEleitoral),
        tituloeleitoral: normalizar(body.tituloEleitoral),
        secao: normalizar(body.secao),
        zona: normalizar(body.zona),
        municipio: normalizar(body.municipio),
        id_municipio: body.id_municipio ? parseInt(body.id_municipio) : null,
        localVotacao: normalizar(body.localVotacao),
        localvotacao: normalizar(body.localVotacao),
        situacaoTSE: normalizar(body.situacaoTSE),
        situacaotse: normalizar(body.situacaoTSE),
        biometria: normalizar(body.biometria),
        nomeSocial: normalizar(body.nomeSocial),
        nomesocial: normalizar(body.nomeSocial),
        rg: normalizar(body.rg),
        nomePai: normalizar(body.nomePai),
        nomepai: normalizar(body.nomePai),
        nomeMae: normalizar(body.nomeMae),
        nomemae: normalizar(body.nomeMae),
        naturalidade: normalizar(body.naturalidade),
        estadoCivil: normalizar(body.estadoCivil),
        estadocivil: normalizar(body.estadoCivil),
        localTrabalho: normalizar(body.localTrabalho),
        localtrabalho: normalizar(body.localTrabalho),
        observacoes: normalizar(body.observacoes),
        logradouro: normalizar(body.logradouro),
        numero: normalizar(body.numero),
        complemento: normalizar(body.complemento),
        bairro: normalizar(body.bairro),
        cidade: normalizar(body.cidade),
        uf: normalizar(body.uf),
        cep: normalizar(body.cep),
        dataNascimento: normalizar(body.dataNascimento),
        datanascimento: normalizar(body.dataNascimento),
        statusCadastro: normalizar(body.statusCadastro),
        statuscadastro: normalizar(body.statusCadastro),
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        // Colunas base (snake_case)
        endereco: normalizar(body.logradouro || body.endereco),
        estado: normalizar(body.uf || body.estado),
        data_nascimento: normalizar(body.dataNascimento || body.data_nascimento),
        sexo: normalizar(body.sexo) ?? 'MASCULINO',
        profissao: normalizar(body.profissao),
        lideranca: normalizar(body.lideranca),
        status: normalizar(body.statusCadastro || body.status)
      };

      let { data: eleitor, error } = await supabase
        .from('eleitores')
        .insert([payload])
        .select()
        .single();

      // Compatibilidade com bancos que ainda nao possuem a coluna lideranca
      const erroColunaLideranca =
        error &&
        (String(error.message || '').toLowerCase().includes('lideranca') ||
          String(error.details || '').toLowerCase().includes('lideranca'));

      if (erroColunaLideranca) {
        const payloadSemLideranca = { ...payload };
        delete payloadSemLideranca.lideranca;
        const retry = await supabase
          .from('eleitores')
          .insert([payloadSemLideranca])
          .select()
          .single();
        eleitor = retry.data;
        error = retry.error;
      }

      if (error) {
        // Código 23505 = violação de chave única (unique_violation)
        // Ocorre quando a sequence do PostgreSQL está dessincronizada com os dados existentes
        if (error.code === '23505' && error.message?.includes('eleitores_pkey')) {
          console.error('[ELEITORES] Sequence dessincronizada! Execute no Supabase SQL Editor:',
            "SELECT setval('eleitores_id_seq', (SELECT MAX(id) FROM eleitores));");
          return res.status(409).json({
            message: 'Erro interno de banco de dados: a sequência de IDs da tabela de eleitores está dessincronizada. Contate o administrador do sistema.',
            error: error.message,
            code: error.code,
            fix: "SELECT setval('eleitores_id_seq', (SELECT MAX(id) FROM eleitores));"
          });
        }
        return res.status(400).json({
          message: error.message || 'Erro ao criar eleitor',
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      }

      // Criar/atualizar marcador de geolocalizacao
      if (eleitor?.latitude && eleitor?.longitude) {
        const enderecoBase = eleitor.logradouro || eleitor.endereco || '';
        const numero = eleitor.numero ? `, ${eleitor.numero}` : '';
        const complemento = eleitor.complemento ? ` ${eleitor.complemento}` : '';
        const endereco = `${enderecoBase}${numero}${complemento}`.trim();

        await supabase
          .from('geolocalizacao')
          .delete()
          .eq('tipo', 'ELEITOR')
          .eq('eleitor_id', eleitor.id);

        await supabase
          .from('geolocalizacao')
          .insert([{
            tipo: 'ELEITOR',
            nome: eleitor.nome,
            descricao: 'Eleitor',
            cidade: eleitor.cidade || null,
            bairro: eleitor.bairro || null,
            endereco: endereco || null,
            latitude: eleitor.latitude,
            longitude: eleitor.longitude,
            icon_color: '#14b8a6',
            icon_type: 'ELEITOR',
            eleitor_id: eleitor.id,
            status: eleitor.statusCadastro || eleitor.status || 'ATIVO',
            data_criacao: new Date().toISOString()
          }]);
      }

      return res.status(201).json(eleitor);
    }

    return res.status(405).json({ message: 'Método não permitido' });
  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
}
