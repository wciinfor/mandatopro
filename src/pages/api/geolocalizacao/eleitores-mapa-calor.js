import fs from 'fs/promises';
import path from 'path';
import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

const UF_ALVO = 'PA';
const MATCH_APROX_MAX_DISTANCIA = 2;
const MUNICIPIOS_EXCLUIDOS_TEMPERATURA_IBGE = new Set(['1501402']); // Belem
const MUNICIPIOS_EXCLUIDOS_TEMPERATURA_NOME = new Set(['BELEM']);
const MANUAL_ALIAS = {
  'BELEM PA': 'BELEM',
  'ANANINDEUA PA': 'ANANINDEUA',
  'SANTAREM PA': 'SANTAREM',
  'ITAITUBA PA': 'ITAITUBA',
  'PARAUAPEBAS PA': 'PARAUAPEBAS',
  'VITORIA XINGU': 'VITORIA DO XINGU',
  'VITORIA DO XINGU PA': 'VITORIA DO XINGU',
  'MUNICIPIO DE VITORIA DO XINGU': 'VITORIA DO XINGU',
  'SAO FELIX XINGU': 'SAO FELIX DO XINGU',
  'SAO FELIX DO XINGU PA': 'SAO FELIX DO XINGU',
};

let geoCache = null;
const HEATMAP_CACHE_TTL_MS = 5 * 60 * 1000;
const heatmapCache = new Map();

function cacheKey({ isPreview, rankingLimit }) {
  return `${isPreview ? '1' : '0'}:${rankingLimit}`;
}

// Função exportável para limpar cache de geolocalização
export function limparCacheGeolocaliza() {
  console.log('[GEOLOCALIZACAO] Limpando caches de geolocalização...');
  geoCache = null;
  heatmapCache.clear();
}

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return code === '42703' || code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
}

function tentarCorrigirLatin1ParaUtf8(value) {
  const texto = String(value || '');

  // Corrige casos comuns de mojibake (ex.: BelÃ©m -> Belém).
  if (!/[ÃÂ]/.test(texto)) {
    return texto;
  }

  try {
    return Buffer.from(texto, 'latin1').toString('utf8');
  } catch {
    return texto;
  }
}

function normalizeText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return tentarCorrigirLatin1ParaUtf8(String(value))
    .replace(/\uFFFD/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function compactMunicipioKey(value) {
  const normalizado = normalizeText(value)
    .replace(/\bMUNICIPIO DE\b/g, '')
    .replace(/\bCIDADE DE\b/g, '')
    .replace(/\bSEDE\b/g, '')
    .replace(/\bPA\b/g, '')
    .replace(/\bPARA\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalizado.replace(/[^A-Z0-9]/g, '');
}

function normalizeMunicipio(value) {
  const base = normalizeText(value)
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return MANUAL_ALIAS[base] || base;
}

function normalizeIbgeCode(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const digits = String(value).replace(/\D/g, '');
  return digits || '';
}

function toTitleCase(value) {
  return tentarCorrigirLatin1ParaUtf8(String(value || ''))
    .replace(/\uFFFD/g, '')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ');
}

function distanciaLevenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + custo,
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

function encontrarGeoPorAproximacao(geoReferencia, municipioNormalizado) {
  const chaveCompacta = compactMunicipioKey(municipioNormalizado);
  if (!chaveCompacta || chaveCompacta.length < 4) {
    return null;
  }

  const direto = geoReferencia.porChaveCompacta.get(chaveCompacta);
  if (direto) {
    return direto;
  }

  // Casos com sufixos/prefixos: aceita contenção entre chave do dado e chave oficial.
  for (const chaveGeo of geoReferencia.chavesCompactas) {
    if (chaveGeo.length < 5) continue;

    if (chaveCompacta.includes(chaveGeo) || chaveGeo.includes(chaveCompacta)) {
      const hit = geoReferencia.porChaveCompacta.get(chaveGeo);
      if (hit) {
        return hit;
      }
    }
  }

  let melhor = null;

  for (const chaveGeo of geoReferencia.chavesCompactas) {
    if (Math.abs(chaveGeo.length - chaveCompacta.length) > MATCH_APROX_MAX_DISTANCIA) {
      continue;
    }

    const distancia = distanciaLevenshtein(chaveCompacta, chaveGeo);
    if (distancia > MATCH_APROX_MAX_DISTANCIA) {
      continue;
    }

    if (!melhor || distancia < melhor.distancia) {
      melhor = { chaveGeo, distancia };
    }
  }

  if (!melhor) {
    return null;
  }

  return geoReferencia.porChaveCompacta.get(melhor.chaveGeo) || null;
}

function isUfPara(rawUf) {
  const ufNormalizada = normalizeText(rawUf).replace(/[^A-Z]/g, '');

  if (!ufNormalizada) {
    return null;
  }

  return ufNormalizada === 'PA' || ufNormalizada === 'PARA';
}

function calcularNivelIntensidade(intensidade) {
  if (intensidade >= 0.8) return 'muito_alta';
  if (intensidade >= 0.6) return 'alta';
  if (intensidade >= 0.4) return 'media';
  if (intensidade > 0) return 'baixa';
  return 'zero';
}

function isMunicipioExcluidoDaTemperatura(item) {
  const codigoIbge = normalizeIbgeCode(item?.codigoIbge);
  if (codigoIbge && MUNICIPIOS_EXCLUIDOS_TEMPERATURA_IBGE.has(codigoIbge)) {
    return true;
  }

  const municipioNormalizado = normalizeText(item?.municipioNormalizado || item?.municipio || '');
  return MUNICIPIOS_EXCLUIDOS_TEMPERATURA_NOME.has(municipioNormalizado);
}

function criarLegenda(maximo) {
  if (!maximo || maximo <= 0) {
    return [
      { nivel: 'zero', minimo: 0, maximo: 0, label: 'Sem eleitores', cor: '#E5E7EB' },
    ];
  }

  const thresholds = [0.2, 0.4, 0.6, 0.8, 1];
  const labels = ['Baixa', 'Média', 'Média-alta', 'Alta', 'Muito alta'];
  const cores = ['#CCFBF1', '#99F6E4', '#5EEAD4', '#14B8A6', '#0F766E'];

  let minimoAnterior = 1;

  return thresholds.map((threshold, index) => {
    const maxFaixa = Math.max(1, Math.ceil(maximo * threshold));
    const faixa = {
      nivel: `faixa_${index + 1}`,
      minimo: minimoAnterior,
      maximo: maxFaixa,
      label: labels[index],
      cor: cores[index],
    };

    minimoAnterior = maxFaixa + 1;
    return faixa;
  });
}

async function carregarGeoReferencia() {
  if (geoCache) {
    return geoCache;
  }

  const arquivoGeo = path.join(process.cwd(), 'public', 'data', 'geo', 'pa-municipios.geojson');
  const conteudo = await fs.readFile(arquivoGeo, 'utf8');
  const geojson = JSON.parse(conteudo);

  const porCodigoIbge = new Map();
  const porNomeNormalizado = new Map();
  const porChaveCompacta = new Map();

  (geojson.features || []).forEach((feature) => {
    const props = feature.properties || {};
    const codigoIbge = String(props.id || '').trim();
    const nome = String(props.name || '').trim();
    const nomeNormalizado = normalizeMunicipio(nome);
    const chaveCompacta = compactMunicipioKey(nomeNormalizado);

    if (codigoIbge) {
      porCodigoIbge.set(codigoIbge, { codigoIbge, nome, nomeNormalizado });
    }

    if (nomeNormalizado) {
      porNomeNormalizado.set(nomeNormalizado, { codigoIbge, nome, nomeNormalizado });
    }

    if (chaveCompacta && !porChaveCompacta.has(chaveCompacta)) {
      porChaveCompacta.set(chaveCompacta, { codigoIbge, nome, nomeNormalizado });
    }
  });

  geoCache = {
    totalFeatures: (geojson.features || []).length,
    porCodigoIbge,
    porNomeNormalizado,
    porChaveCompacta,
    chavesCompactas: Array.from(porChaveCompacta.keys()),
  };

  return geoCache;
}

async function carregarEleitoresMapa(supabase, { isPreview, totalEleitoresBase = 0 }) {
  const tentativas = [
    'id, id_municipio, municipio, cidade, bairro, uf, estado',
    'id, cidade, bairro, uf, estado',
    'id, municipio, bairro, uf, estado',
    '*'
  ];

  const pageSize = 1000;
  const previewMax = 5000;
  const concurrency = isPreview ? 5 : 12;

  const totalAlvo = isPreview
    ? Math.min(Math.max(Number(totalEleitoresBase || 0), 0), previewMax)
    : Math.max(Number(totalEleitoresBase || 0), 0);

  console.log('[CARREGA-ELEITORES-MAPA] Iniciando:', {
    isPreview,
    totalEleitoresBase,
    totalAlvo,
    pageSize,
    concurrency
  });

  if (totalAlvo === 0) {
    console.log('[CARREGA-ELEITORES-MAPA] Nenhum eleitor para buscar!');
    return [];
  }

  async function buscarPagina(selectClause, inicio, fim) {
    const { data, error } = await supabase
      .from('eleitores')
      .select(selectClause)
      .order('id', { ascending: true })
      .range(inicio, fim);

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data : [];
  }

  for (const selectClause of tentativas) {
    try {
      const totalPaginas = Math.ceil(totalAlvo / pageSize);
      const acumulado = [];
      let paginaAtual = 0;

      while (paginaAtual < totalPaginas) {
        const tarefas = [];

        for (let i = 0; i < concurrency && paginaAtual < totalPaginas; i += 1, paginaAtual += 1) {
          const inicio = paginaAtual * pageSize;
          const fim = Math.min(inicio + pageSize - 1, totalAlvo - 1);
          tarefas.push(buscarPagina(selectClause, inicio, fim));
        }

        const lotes = await Promise.all(tarefas);

        for (const lote of lotes) {
          acumulado.push(...lote);

          if (isPreview && acumulado.length >= previewMax) {
            return acumulado.slice(0, previewMax);
          }
        }
      }

      console.log('[CARREGA-ELEITORES-MAPA] Tentativa com selectClause sucedeu! Retornando', acumulado.length, 'registros');
      return acumulado;
    } catch (error) {
      console.log('[CARREGA-ELEITORES-MAPA] Tentativa falhou:', error.message);
      if (!isMissingColumnError(error)) {
        throw error;
      }
    }
  }

  console.log('[CARREGA-ELEITORES-MAPA] Nenhuma tentativa funcionou! Retornando vazio');
  return [];
}

async function contarEleitoresBase(supabase) {
  const { count, error } = await supabase
    .from('eleitores')
    .select('id', { count: 'exact', head: true });

  if (error) {
    throw error;
  }

  return Number(count || 0);
}

// Chama a função RPC que faz GROUP BY no Postgres e devolve ~200 linhas
// em vez de buscar todos os 300k+ registros.
// Retorna null se a função ainda não existir no banco (fallback para paginação).
async function carregarAgregadosMunicipio(supabase) {
  const { data, error } = await supabase.rpc('fn_eleitores_agrupados_municipio');
  if (error) {
    const msg = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toUpperCase();
    if (code === 'PGRST202' || msg.includes('could not find function') || msg.includes('does not exist')) {
      console.log('[MAPA-CALOR] RPC fn_eleitores_agrupados_municipio não encontrada, usando paginação.');
      return null;
    }
    throw error;
  }
  return (Array.isArray(data) ? data : []).map((r) => ({
    id_municipio: r._id_municipio,
    cidade:       r._cidade,
    estado:       r._estado,
    _total:       Number(r._total || 1),
  }));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const previewRaw = String(req.query.preview || '').toLowerCase();
    const isPreview = previewRaw === '1' || previewRaw === 'true' || previewRaw === 'yes';

    const rankingLimitRaw = parseInt(String(req.query.rankingLimit || '200'), 10);
    const rankingLimit = Number.isFinite(rankingLimitRaw) && rankingLimitRaw > 0
      ? Math.min(rankingLimitRaw, 500)
      : 200;

    const chaveCache = cacheKey({ isPreview, rankingLimit });
    const agora = Date.now();
    const cache = heatmapCache.get(chaveCache);

    console.log('[MAPA-CALOR] Requisição recebida:', {
      isPreview,
      rankingLimit,
      cacheValido: cache && cache.expireAt > agora,
      timestamp: new Date().toISOString()
    });

    if (cache && cache.expireAt > agora) {
      console.log('[MAPA-CALOR] Usando CACHE');
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.status(200).json(cache.data);
    }

    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const geoReferencia = await carregarGeoReferencia();

    console.log('[MAPA-CALOR] Contando eleitores base...');
    const totalEleitoresBase = await contarEleitoresBase(supabase);
    console.log('[MAPA-CALOR] Total de eleitores no banco:', totalEleitoresBase);

    const agregadosRPC = await carregarAgregadosMunicipio(supabase);
    const usandoRPC = agregadosRPC !== null;
    const base = usandoRPC
      ? agregadosRPC
      : await carregarEleitoresMapa(supabase, { isPreview, totalEleitoresBase });

    console.log('[MAPA-CALOR] Dados carregados:', base.length, usandoRPC ? 'grupos agregados (RPC)' : 'registros individuais');

    if (base.length === 0) {
      const respostaVazia = {
        resumo: {
          totalEleitoresLidos: 0,
          totalEleitoresConsiderados: 0,
          totalEleitoresBase,
          totalMunicipiosLista: 0,
          totalMunicipiosMapa: 0,
          maximoQuantidade: 0,
          geoFeatures: geoReferencia.totalFeatures,
        },
        mapa: {
          geojsonPath: '/api/geolocalizacao/geojson-pa?tolerance=0.0022',
          municipios: [],
          legenda: criarLegenda(0),
        },
        lista: {
          ranking: [],
          total: 0,
        },
        inconsistencias: {
          semMunicipio: [],
          semMunicipioTotal: 0,
          foraDoPA: [],
          foraDoPATotal: 0,
          semUF: [],
          semUFTotal: 0,
          semCorrespondenciaGeo: [],
          semCorrespondenciaGeoTotal: 0,
        },
      };

      heatmapCache.set(chaveCache, {
        expireAt: agora + HEATMAP_CACHE_TTL_MS,
        data: respostaVazia,
      });

      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.status(200).json(respostaVazia);
    }

    const agregador = new Map();
    const semCorrespondenciaMap = new Map();

    const semMunicipio = [];
    const semUF = [];
    const foraDoPA = [];
    const codigosIbgeEncontrados = new Set();
    const codigosIbgeNaoEncontrados = new Set();

    let totalConsiderados = 0;
    let contComIdMunicipio = 0;
    let contSemIdMunicipio = 0;
    let semMunicipioTotal = 0;
    let foraDoPATotal = 0;
    let semUFTotal = 0;

    for (const eleitor of base) {
      const peso = usandoRPC ? Number(eleitor._total || 1) : 1;
      const municipioBruto = String(eleitor?.municipio || eleitor?.cidade || '').trim();
      const ufBruta = eleitor?.uf || eleitor?.estado || null;
      const ehPA = isUfPara(ufBruta);
      const codigoIbgeInformado = normalizeIbgeCode(eleitor?.id_municipio);

      if (codigoIbgeInformado) {
        contComIdMunicipio += peso;
      } else {
        contSemIdMunicipio += peso;
      }

      // Prioriza id_municipio (IBGE) quando informado.
      if (codigoIbgeInformado) {
        const geoPorCodigo = geoReferencia.porCodigoIbge.get(codigoIbgeInformado);

        if (!geoPorCodigo) {
          codigosIbgeNaoEncontrados.add(codigoIbgeInformado);
          foraDoPA.push({
            id: eleitor?.id ?? null,
            municipio: municipioBruto || null,
            uf: ufBruta,
            codigoIbge: codigoIbgeInformado,
          });
          foraDoPATotal += peso;
          continue;
        }

        codigosIbgeEncontrados.add(codigoIbgeInformado);

        const chave = `IBGE:${geoPorCodigo.codigoIbge}`;
        const atual = agregador.get(chave) || {
          municipio: geoPorCodigo.nome,
          municipioNormalizado: geoPorCodigo.nomeNormalizado,
          codigoIbge: geoPorCodigo.codigoIbge,
          quantidade: 0,
          matchedGeo: true,
        };

        atual.quantidade += peso;
        atual.municipio = geoPorCodigo.nome;
        atual.codigoIbge = geoPorCodigo.codigoIbge;
        atual.matchedGeo = true;

        agregador.set(chave, atual);
        totalConsiderados += peso;
        continue;
      }

      if (!municipioBruto) {
        semMunicipio.push({
          id: eleitor?.id ?? null,
          uf: ufBruta,
          bairro: eleitor?.bairro || null,
        });
        semMunicipioTotal += peso;
        continue;
      }

      if (ehPA === false) {
        foraDoPA.push({
          id: eleitor?.id ?? null,
          municipio: municipioBruto,
          uf: ufBruta,
        });
        foraDoPATotal += peso;
        continue;
      }

      if (ehPA === null) {
        semUF.push({
          id: eleitor?.id ?? null,
          municipio: municipioBruto,
        });
        semUFTotal += peso;
      }

      const municipioNormalizado = normalizeMunicipio(municipioBruto);
      const geoMatch = geoReferencia.porNomeNormalizado.get(municipioNormalizado)
        || encontrarGeoPorAproximacao(geoReferencia, municipioNormalizado);

      let chave = '';
      let nomeMunicipio = '';
      let codigoIbge = null;
      let matchedGeo = false;

      if (geoMatch) {
        chave = `IBGE:${geoMatch.codigoIbge}`;
        nomeMunicipio = geoMatch.nome;
        codigoIbge = geoMatch.codigoIbge;
        matchedGeo = true;
      } else {
        chave = `NOGEO:${municipioNormalizado}`;
        nomeMunicipio = toTitleCase(municipioBruto);

        const atualSemGeo = semCorrespondenciaMap.get(municipioNormalizado) || {
          municipioInformado: nomeMunicipio,
          municipioNormalizado,
          quantidade: 0,
        };

        atualSemGeo.quantidade += peso;
        semCorrespondenciaMap.set(municipioNormalizado, atualSemGeo);
      }

      const atual = agregador.get(chave) || {
        municipio: nomeMunicipio,
        municipioNormalizado,
        codigoIbge,
        quantidade: 0,
        matchedGeo,
      };

      atual.quantidade += peso;
      atual.municipio = nomeMunicipio;
      atual.codigoIbge = codigoIbge;
      atual.matchedGeo = matchedGeo;

      agregador.set(chave, atual);
      totalConsiderados += peso;
    }

    const rankingCompleto = Array.from(agregador.values())
      .sort((a, b) => {
        if (b.quantidade !== a.quantidade) {
          return b.quantidade - a.quantidade;
        }

        return a.municipio.localeCompare(b.municipio, 'pt-BR');
      });

    console.log('[MAPA-CALOR] Processamento concluído:', {
      totalLoadados: base.length,
      totalConsiderados,
      totalMunicipios: rankingCompleto.length,
      semMunicipio: semMunicipio.length,
      semUF: semUF.length,
      foraDoPA: foraDoPA.length,
      semCorrespondencia: semCorrespondenciaMap.size,
      comIdMunicipio: contComIdMunicipio,
      semIdMunicipio: contSemIdMunicipio,
      percentualComId: Math.round((contComIdMunicipio / base.length) * 100) + '%'
    });

    // Log detalhado dos códigos IBGE
    console.log('[MAPA-CALOR] Codigos IBGE encontrados no geojson:', Array.from(codigosIbgeEncontrados).sort().slice(0, 20));
    console.log('[MAPA-CALOR] Codigos IBGE NAO encontrados no geojson (primeiros 20):', Array.from(codigosIbgeNaoEncontrados).sort().slice(0, 20));
    console.log('[MAPA-CALOR] Total de codigos IBGE unicos encontrados:', codigosIbgeEncontrados.size);
    console.log('[MAPA-CALOR] Total de codigos IBGE unicos nao encontrados:', codigosIbgeNaoEncontrados.size);

    const rankingParaEscalaTermica = rankingCompleto.filter((item) => !isMunicipioExcluidoDaTemperatura(item));

    const maximoQuantidade = rankingParaEscalaTermica.reduce((maxAtual, item) => {
      return Math.max(maxAtual, item.quantidade);
    }, 0);

    const rankingEnriquecido = rankingCompleto.map((item, index) => {
      const excluidoTemperatura = isMunicipioExcluidoDaTemperatura(item);
      const intensidade = excluidoTemperatura
        ? null
        : (maximoQuantidade > 0 ? item.quantidade / maximoQuantidade : 0);

      return {
        posicao: index + 1,
        municipio: item.municipio,
        municipioNormalizado: item.municipioNormalizado,
        codigoIbge: item.codigoIbge,
        quantidade: item.quantidade,
        intensidade,
        nivelIntensidade: excluidoTemperatura ? 'excluido' : calcularNivelIntensidade(intensidade),
        excluidoTemperatura,
        matchedGeo: item.matchedGeo,
      };
    });

    const mapaMunicipios = rankingEnriquecido.filter((item) => item.matchedGeo && item.codigoIbge);
    const rankingLimitado = rankingEnriquecido.slice(0, rankingLimit);

    const semCorrespondenciaGeo = Array.from(semCorrespondenciaMap.values())
      .sort((a, b) => b.quantidade - a.quantidade);

    const inconsistenciasLimite = isPreview ? 10 : 50;
    const semCorrespondenciaLimitado = isPreview
      ? semCorrespondenciaGeo.slice(0, 20)
      : semCorrespondenciaGeo;

    const resposta = {
      resumo: {
        totalEleitoresLidos: usandoRPC ? totalEleitoresBase : base.length,
        totalEleitoresConsiderados: totalConsiderados,
        totalEleitoresBase,
        totalMunicipiosLista: rankingEnriquecido.length,
        totalMunicipiosMapa: mapaMunicipios.length,
        maximoQuantidade,
        totalMunicipiosExcluidosTemperatura: rankingEnriquecido.filter((item) => item.excluidoTemperatura).length,
        geoFeatures: geoReferencia.totalFeatures,
      },
      mapa: {
        geojsonPath: '/api/geolocalizacao/geojson-pa?tolerance=0.0022',
        municipios: mapaMunicipios,
        legenda: criarLegenda(maximoQuantidade),
      },
      lista: {
        ranking: rankingLimitado,
        total: rankingEnriquecido.length,
      },
      inconsistencias: {
        semMunicipio: semMunicipio.slice(0, inconsistenciasLimite),
        semMunicipioTotal: semMunicipioTotal,
        foraDoPA: foraDoPA.slice(0, inconsistenciasLimite),
        foraDoPATotal: foraDoPATotal,
        semUF: semUF.slice(0, inconsistenciasLimite),
        semUFTotal: semUFTotal,
        semCorrespondenciaGeo: semCorrespondenciaLimitado,
        semCorrespondenciaGeoTotal: semCorrespondenciaGeo.reduce((soma, item) => soma + item.quantidade, 0),
      },
      atualizadoEm: new Date().toISOString(),
      filtros: {
        ufAlvo: UF_ALVO,
      },
    };

    heatmapCache.set(chaveCache, {
      expireAt: agora + HEATMAP_CACHE_TTL_MS,
      data: resposta,
    });

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.status(200).json(resposta);
  } catch (erro) {
    console.error('Erro no endpoint de mapa de calor de eleitores:', erro);
    return res.status(500).json({
      error: 'Erro interno ao montar mapa de calor',
      detalhes: erro?.message || 'Erro desconhecido',
    });
  }
}
