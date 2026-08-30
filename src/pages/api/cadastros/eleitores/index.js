import fs from 'fs';
import path from 'path';
import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterContextoMandato, aplicarFiltroPertencimentoEleitor } from '@/lib/mandato-auth';

export const runtime = 'nodejs';

const CIDADES_CACHE_TTL_MS = 10 * 60 * 1000;
const cidadesCache = new Map();

function aplicarFiltrosBase(query, { status, liderancaFiltro, excludeLiderancas }) {
  let next = query;

  if (status) {
    const s = String(status).trim().toUpperCase();
    if (s === 'ATIVO') {
      // Otimização: comparação exata indexada com suporte a nulos sem ILIKE para evitar Seq Scan
      next = next.or('status.eq.ATIVO,status.is.null');
    } else if (s === 'INATIVO') {
      next = next.eq('status', 'INATIVO');
    } else {
      next = next.eq('status', s);
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

const COLUNAS_LISTAGEM_ELEITORES = [
  'id',
  'nome',
  'cpf',
  'rg',
  'email',
  'tituloEleitoral',
  'tituloeleitoral',
  'secao',
  'zona',
  'situacaoTSE',
  'situacaotse',
  'dataNascimento',
  'data_nascimento',
  'datanascimento',
  'telefone',
  'celular',
  'whatsapp',
  'municipio',
  'cidade',
  'bairro',
  'endereco',
  'logradouro',
  'numero',
  'complemento',
  'estado',
  'uf',
  'cep',
  'status',
  'statusCadastro',
  'statuscadastro',
  'pertencimento',
  'lideranca_id',
  'created_at',
  'updated_at',
  'usuario_id'
].join(', ');

async function carregarCidadesDisponiveis(supabase, { status, liderancaFiltro, excludeLiderancas, pertencimentosPermitidos } = {}) {
  const pertKey = pertencimentosPermitidos ? pertencimentosPermitidos.join(',') : 'ALL';
  const chaveCache = `v5|status:${status || 'ALL'}|lideranca:${liderancaFiltro || 'ALL'}|exclude:${excludeLiderancas ? '1' : '0'}|mandato:${pertKey}`;
  const cache = cidadesCache.get(chaveCache);
  if (cache && cache.expireAt > Date.now() && Array.isArray(cache.data) && cache.data.length > 0) {
    return cache.data;
  }

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
    atual.values.add(label);
    atual.values.add(keyBase);
    cidadesMap.set(key, atual);
  };

  // 1. Carrega catálogo base oficial de municípios do Pará (via geojson local de alta performance)
  try {
    const arquivoGeo = path.join(process.cwd(), 'public', 'data', 'geo', 'pa-municipios.geojson');
    if (fs.existsSync(arquivoGeo)) {
      const conteudo = fs.readFileSync(arquivoGeo, 'utf8');
      const geojson = JSON.parse(conteudo);
      if (Array.isArray(geojson?.features)) {
        geojson.features.forEach(f => {
          const nomeMun = f.properties?.name || f.properties?.description;
          if (nomeMun) processarCidade(nomeMun);
        });
      }
    }
  } catch (errGeo) {
    console.warn('[Eleitores API] Aviso ao ler pa-municipios.geojson:', errGeo?.message);
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
    // 1. Carregamento resiliente e instantâneo de catálogo de cidades (GeoJSON local)
    if (req.method === 'GET' && String(req.query.onlyCities || '').toLowerCase() === 'true') {
      const cidades = await carregarCidadesDisponiveis(null, {
        status: req.query.status,
        liderancaFiltro: req.query.liderancaId || req.query.lideranca_id,
        excludeLiderancas: req.query.excludeLiderancas,
      });

      return res.status(200).json({ data: cidades });
    }

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
        limit = 100,
        offset = 0,
        excludeLiderancas = false,
        ordem = 'recentes'
      } = req.query;

      // Resolver mandato ativo ANTES de qualquer consulta
      const contextoMandato = await obterContextoMandato(req, usuario, supabase);
      const liderancaFiltro = liderancaId || lideranca_id;

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

      let query = aplicarFiltroPertencimentoEleitor(
        aplicarFiltrosBase(
          supabase.from('eleitores').select(COLUNAS_LISTAGEM_ELEITORES, { count: 'estimated' }),
          { status, liderancaFiltro, excludeLiderancas }
        ),
        contextoMandato
      );

      // Busca inteligente e otimizada por termos
      if (search && search.trim().length > 0) {
        // Sanitização: vírgulas quebrariam o parser de .or(); aspas e parênteses
        // também causam problemas — removemos todos esses caracteres.
        const q = search.trim().replace(/[,()"']/g, '');
        const qDigitos = q.replace(/\D/g, '');
        const ehPuramenteNumerico = /^\d+$/.test(q.replace(/[\s.\-/]/g, '')) && qDigitos.length >= 3;

        if (ehPuramenteNumerico) {
          // Termo puramente numérico (CPF, RG ou Título Eleitoral):
          // Prioriza operadores eq e prefixo (like 'XYZ%') para utilizar os índices B-Tree existentes (idx_eleitores_cpf, idx_eleitores_rg)
          const filtrosNumericos = [
            `cpf.eq.${qDigitos}`,
            `rg.eq.${qDigitos}`,
            `tituloEleitoral.eq.${qDigitos}`,
            `cpf.like.${qDigitos}%`,
            `rg.like.${qDigitos}%`,
            `tituloEleitoral.like.${qDigitos}%`,
            `cpf.ilike.%${qDigitos}%`,
            `rg.ilike.%${qDigitos}%`,
          ];
          query = query.or(filtrosNumericos.join(','));
        } else if (q.length > 0) {
          // Termo textual (Nome, Bairro, Município):
          // Foca nas colunas de texto reais, evitando scans inúteis de ILIKE sobre colunas numéricas (CPF/RG)
          const filtrosTexto = [
            `nome.ilike.%${q}%`,
            `municipio.ilike.%${q}%`,
            `bairro.ilike.%${q}%`,
            `cidade.ilike.%${q}%`,
          ];
          if (qDigitos.length >= 3) {
            filtrosTexto.push(`cpf.eq.${qDigitos}`, `rg.eq.${qDigitos}`);
          }
          query = query.or(filtrosTexto.join(','));
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

      // Ordenação dinâmica: por padrão coloca os últimos eleitores registrados primeiro ('recentes' -> id desc)
      let orderCol = 'id';
      let ascending = false;

      if (ordem === 'nome_asc' || ordem === 'alfabetica') {
        orderCol = 'nome';
        ascending = true;
      } else if (ordem === 'nome_desc') {
        orderCol = 'nome';
        ascending = false;
      } else if (ordem === 'antigos') {
        orderCol = 'id';
        ascending = true;
      } else {
        // 'recentes' (Padrão: mais recentes / últimos registrados primeiro)
        orderCol = 'id';
        ascending = false;
      }

      const { data: eleitores, count, error } = await query
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
        .order(orderCol, { ascending });

      if (error) {
        return res.status(400).json({
          message: 'Erro ao listar eleitores',
          error: error.message
        });
      }

      return res.status(200).json({
        data: eleitores || [],
        total: count !== null && count !== undefined ? Number(count) : (Array.isArray(eleitores) ? eleitores.length : 0),
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    }

    // POST - Criar novo eleitor
    if (req.method === 'POST') {
      const body = req.body || {};
      const normalizar = (value) => (value === '' ? null : value);

      const rawLiderancaId = body.lideranca_id || body.liderancaId;
      let liderancaIdFinal = rawLiderancaId && !isNaN(parseInt(rawLiderancaId)) ? parseInt(rawLiderancaId) : null;

      if (!liderancaIdFinal && body.lideranca) {
        const liderancaStr = String(body.lideranca).trim();
        if (liderancaStr && !isNaN(parseInt(liderancaStr))) {
          liderancaIdFinal = parseInt(liderancaStr);
        } else if (liderancaStr) {
          const { data: lidFound } = await supabase
            .from('liderancas')
            .select('id')
            .ilike('nome', liderancaStr)
            .limit(1)
            .maybeSingle();
          if (lidFound?.id) {
            liderancaIdFinal = lidFound.id;
          }
        }
      }

      // Validar pertencimento e autorização do usuário
      let userMandates = usuario.mandatos || [];
      if (usuario.nivel === 'ADMINISTRADOR') {
        userMandates = [1, 2];
      } else if (!userMandates.length) {
        const { data: vinculosUser } = await supabase
          .from('usuarios_mandatos')
          .select('mandato_id')
          .eq('usuario_id', usuario.id);
        userMandates = (vinculosUser || []).map(v => v.mandato_id);
      }

      let pertencimentoSolicitado = String(body.pertencimento || '').toUpperCase();
      if (!['ESTADUAL', 'FEDERAL', 'AMBOS', 'NAO_CLASSIFICADO'].includes(pertencimentoSolicitado)) {
        pertencimentoSolicitado = 'ESTADUAL'; // Fallback seguro para novos
      }

      const temEstadual = userMandates.includes(1);
      const temFederal = userMandates.includes(2);

      if (pertencimentoSolicitado === 'ESTADUAL' && !temEstadual) {
        return res.status(403).json({ message: 'Você não possui permissão para cadastrar eleitores no mandato Estadual' });
      }
      if (pertencimentoSolicitado === 'FEDERAL' && !temFederal) {
        return res.status(403).json({ message: 'Você não possui permissão para cadastrar eleitores no mandato Federal' });
      }
      if (pertencimentoSolicitado === 'AMBOS' && (!temEstadual || !temFederal)) {
        return res.status(403).json({ message: 'Você não possui permissão para vincular eleitores a ambos os mandatos' });
      }

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
        pertencimento: pertencimentoSolicitado,
        // Rastreabilidade de Autoria: vincula estritamente o usuario.id da sessão autenticada (ignora qualquer valor do body)
        usuario_id: usuario?.id ? Number(usuario.id) : null,
        // Colunas base (snake_case)
        endereco: normalizar(body.logradouro || body.endereco),
        estado: normalizar(body.uf || body.estado),
        data_nascimento: normalizar(body.dataNascimento || body.data_nascimento),
        sexo: normalizar(body.sexo) ?? 'MASCULINO',
        profissao: normalizar(body.profissao),
        lideranca_id: liderancaIdFinal,
        lideranca: normalizar(body.lideranca),
        status: normalizar(body.statusCadastro || body.status)
      };

      let { data: eleitor, error } = await supabase
        .from('eleitores')
        .insert([payload])
        .select()
        .single();

      // Compatibilidade com bancos em transição de schema (colunas lideranca ou usuario_id)
      const erroColunaCompat =
        error &&
        (String(error.message || '').toLowerCase().includes('lideranca') ||
          String(error.message || '').toLowerCase().includes('usuario_id') ||
          String(error.details || '').toLowerCase().includes('lideranca') ||
          String(error.details || '').toLowerCase().includes('usuario_id'));

      if (erroColunaCompat) {
        const payloadCompat = { ...payload };
        if (String(error.message || '').toLowerCase().includes('lideranca')) {
          delete payloadCompat.lideranca;
        }
        if (String(error.message || '').toLowerCase().includes('usuario_id')) {
          delete payloadCompat.usuario_id;
        }
        const retry = await supabase
          .from('eleitores')
          .insert([payloadCompat])
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

      // Sincronizar Lideranças por Mandato na Criação (Sprint P2.9)
      const lidEstadual = body.liderancaEstadualId ? parseInt(body.liderancaEstadualId) : null;
      const lidFederal = body.liderancaFederalId ? parseInt(body.liderancaFederalId) : null;

      if (lidEstadual && temEstadual) {
        const { data: lidM1 } = await supabase
          .from('liderancas_mandatos')
          .select('lideranca_id')
          .eq('lideranca_id', lidEstadual)
          .eq('mandato_id', 1)
          .maybeSingle();

        if (lidM1) {
          await supabase
            .from('eleitores_liderancas_mandatos')
            .insert([{ eleitor_id: eleitor.id, mandato_id: 1, lideranca_id: lidEstadual }]);
        }
      }

      if (lidFederal && temFederal) {
        const { data: lidM2 } = await supabase
          .from('liderancas_mandatos')
          .select('lideranca_id')
          .eq('lideranca_id', lidFederal)
          .eq('mandato_id', 2)
          .maybeSingle();

        if (lidM2) {
          await supabase
            .from('eleitores_liderancas_mandatos')
            .insert([{ eleitor_id: eleitor.id, mandato_id: 2, lideranca_id: lidFederal }]);
        }
      }

      return res.status(201).json(eleitor);
    }

  } catch (error) {
    console.error('Erro:', error);
    const statusCode = error.statusCode || error.status || 500;
    return res.status(statusCode).json({
      message: error.message || 'Erro interno do servidor',
      error: error.message
    });
  }
}
