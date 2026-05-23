import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const HEATMAP_CACHE_TTL_MS = 5 * 60 * 1000;
const heatmapCache = new Map();

const MUNICIPIOS_ALVO_POR_IBGE = {
  '1501402': 'Belém',
  '1500800': 'Ananindeua',
};

const MUNICIPIOS_ALVO_NOME = ['BELEM', 'ANANINDEUA'];

const CENTRO_POR_MUNICIPIO = {
  BELEM: { lat: -1.4558, lng: -48.5039 },
  ANANINDEUA: { lat: -1.3656, lng: -48.372 },
};

function cacheKey({ isPreview, rankingLimit }) {
  return `${isPreview ? '1' : '0'}:${rankingLimit}`;
}

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return code === '42703' || code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
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

function normalizeIbgeCode(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const digits = String(value).replace(/\D/g, '');
  return digits || '';
}

function normalizeBairro(value) {
  return normalizeText(value)
    .replace(/\bBAIRRO\b/g, '')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function parseCoordinate(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function resolveMunicipioAlvo(eleitor) {
  const codigoIbge = normalizeIbgeCode(eleitor?.id_municipio);
  if (codigoIbge && MUNICIPIOS_ALVO_POR_IBGE[codigoIbge]) {
    return MUNICIPIOS_ALVO_POR_IBGE[codigoIbge];
  }

  const municipioNormalizado = normalizeText(eleitor?.municipio || eleitor?.cidade || '');
  if (!municipioNormalizado) {
    return null;
  }

  if (municipioNormalizado.includes('ANANINDEUA')) {
    return 'Ananindeua';
  }

  if (municipioNormalizado.includes('BELEM')) {
    return 'Belém';
  }

  return null;
}

function calcularNivelIntensidade(intensidade) {
  if (intensidade >= 0.8) return 'muito_alta';
  if (intensidade >= 0.6) return 'alta';
  if (intensidade >= 0.4) return 'media';
  if (intensidade > 0) return 'baixa';
  return 'zero';
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

async function paginarQuery(supabase, { select, orFilter, isPreview, pageSize = 1000, previewMax = 5000 }) {
  const acumulado = [];
  let pagina = 0;

  while (true) {
    const from = pagina * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('eleitores')
      .select(select)
      .or(orFilter)
      .order('id', { ascending: true })
      .range(from, to);

    if (error) throw error;

    const lote = Array.isArray(data) ? data : [];
    acumulado.push(...lote);

    if (isPreview && acumulado.length >= previewMax) return acumulado.slice(0, previewMax);
    if (lote.length < pageSize) break;

    pagina += 1;
  }

  return acumulado;
}

async function carregarBaseBairros(supabase, { isPreview }) {
  // Estratégia 1: filtro só por id_municipio — usa índice, muito rápido.
  // Misturar ILIKE no mesmo OR faz o PostgreSQL ignorar o índice e
  // varrer os 315k registros inteiros.
  try {
    const resultado = await paginarQuery(supabase, {
      select: 'id, id_municipio, municipio, cidade, bairro, latitude, longitude, uf, estado',
      orFilter: 'id_municipio.eq.1501402,id_municipio.eq.1500800',
      isPreview,
    });
    if (resultado.length > 0) return resultado;
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    // coluna id_municipio não existe → cai na estratégia com ILIKE
  }

  // Estratégia 2 (fallback): ILIKE — lento, só usado se id_municipio não existir.
  const filtrosSemIbge = [
    'municipio.ilike.*belem*',
    'municipio.ilike.*belém*',
    'municipio.ilike.*ananindeua*',
    'cidade.ilike.*belem*',
    'cidade.ilike.*belém*',
    'cidade.ilike.*ananindeua*',
  ].join(',');

  const tentativasIlike = [
    { select: 'id, municipio, cidade, bairro, latitude, longitude, uf, estado' },
    { select: '*' },
  ];

  for (const tentativa of tentativasIlike) {
    try {
      return await paginarQuery(supabase, { select: tentativa.select, orFilter: filtrosSemIbge, isPreview });
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
    }
  }

  return [];
}

function calcularCentro(bairros) {
  if (!Array.isArray(bairros) || bairros.length === 0) {
    return { lat: -1.39, lng: -48.48 };
  }

  let somaLat = 0;
  let somaLng = 0;
  let pesoTotal = 0;

  bairros.forEach((item) => {
    const peso = Number(item?.quantidade || 0);
    const lat = Number(item?.latitude);
    const lng = Number(item?.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || peso <= 0) {
      return;
    }

    somaLat += lat * peso;
    somaLng += lng * peso;
    pesoTotal += peso;
  });

  if (!pesoTotal) {
    return { lat: -1.39, lng: -48.48 };
  }

  return {
    lat: somaLat / pesoTotal,
    lng: somaLng / pesoTotal,
  };
}

function hashString(value) {
  let hash = 0;
  const texto = String(value || '');

  for (let i = 0; i < texto.length; i += 1) {
    hash = ((hash << 5) - hash) + texto.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

function coordenadaEstimativaBairro(municipio, bairroNormalizado) {
  const municipioKey = normalizeText(municipio);
  const centro = CENTRO_POR_MUNICIPIO[municipioKey] || { lat: -1.39, lng: -48.48 };
  const baseHash = hashString(`${municipioKey}:${bairroNormalizado}`);

  const angulo = (baseHash % 360) * (Math.PI / 180);
  const raioKm = 0.35 + ((baseHash % 800) / 800) * 7.5;
  const latOffset = (raioKm / 111) * Math.cos(angulo);
  const lngOffset = (raioKm / (111 * Math.max(Math.cos(centro.lat * Math.PI / 180), 0.2))) * Math.sin(angulo);

  return {
    lat: centro.lat + latOffset,
    lng: centro.lng + lngOffset,
  };
}

// Chama a função RPC que faz GROUP BY + SUM de coordenadas no Postgres.
// Retorna null se a função ainda não existir no banco (fallback para paginação).
async function carregarAgregadosBairros(supabase) {
  const { data, error } = await supabase.rpc('fn_eleitores_agrupados_bairros_belem');
  if (error) {
    const msg = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toUpperCase();
    if (code === 'PGRST202' || msg.includes('could not find function') || msg.includes('does not exist')) {
      console.log('[MAPA-BAIRROS] RPC fn_eleitores_agrupados_bairros_belem não encontrada, usando paginação.');
      return null;
    }
    throw error;
  }
  return (Array.isArray(data) ? data : []).map((r) => ({
    id_municipio:  r._id_municipio,
    cidade:        r._cidade,
    bairro:        r._bairro,
    _total:        Number(r._total || 1),
    _total_coord:  Number(r._total_coord || 0),
    _lat_soma:     Number(r._lat_soma || 0),
    _lng_soma:     Number(r._lng_soma || 0),
  }));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
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

    if (cache && cache.expireAt > agora) {
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.status(200).json(cache.data);
    }

    const supabase = createServerClient();
    const agregadosRPC = await carregarAgregadosBairros(supabase);
    const usandoRPC = agregadosRPC !== null;
    const base = usandoRPC
      ? agregadosRPC
      : await carregarBaseBairros(supabase, { isPreview });

    const agregador = new Map();
    const semBairro = [];
    const semCoordenadas = [];
    const foraDoRecorte = [];

    let totalConsiderados = 0;
    let semBairroTotal = 0;
    let semCoordenadasTotal = 0;
    let foraDoRecorteTotal = 0;

    for (const eleitor of base) {
      const peso = usandoRPC ? Number(eleitor._total || 1) : 1;
      const municipio = resolveMunicipioAlvo(eleitor);
      if (!municipio || !MUNICIPIOS_ALVO_NOME.includes(normalizeText(municipio))) {
        foraDoRecorte.push({
          id: eleitor?.id || null,
          municipioInformado: eleitor?.municipio || eleitor?.cidade || null,
          codigoIbge: normalizeIbgeCode(eleitor?.id_municipio) || null,
        });
        foraDoRecorteTotal += peso;
        continue;
      }

      const bairroOriginal = String(eleitor?.bairro || '').trim();
      const bairroNormalizado = normalizeBairro(bairroOriginal);

      if (!bairroNormalizado) {
        semBairro.push({
          id: eleitor?.id || null,
          municipio,
        });
        semBairroTotal += peso;
        continue;
      }

      const chave = `${municipio}::${bairroNormalizado}`;
      const atual = agregador.get(chave) || {
        municipio,
        bairro: toTitleCase(bairroOriginal),
        bairroNormalizado,
        quantidade: 0,
        quantidadeComCoordenadas: 0,
        somaLatitude: 0,
        somaLongitude: 0,
      };

      atual.quantidade += peso;
      totalConsiderados += peso;

      if (usandoRPC) {
        const totalCoord = Number(eleitor._total_coord || 0);
        atual.quantidadeComCoordenadas += totalCoord;
        atual.somaLatitude += Number(eleitor._lat_soma || 0);
        atual.somaLongitude += Number(eleitor._lng_soma || 0);
        semCoordenadasTotal += (peso - totalCoord);
      } else {
        const latitude = parseCoordinate(eleitor?.latitude);
        const longitude = parseCoordinate(eleitor?.longitude);
        const coordenadasValidas = Number.isFinite(latitude) && Number.isFinite(longitude);

        if (coordenadasValidas) {
          atual.quantidadeComCoordenadas += 1;
          atual.somaLatitude += latitude;
          atual.somaLongitude += longitude;
        } else {
          semCoordenadas.push({
            id: eleitor?.id || null,
            municipio,
            bairro: toTitleCase(bairroOriginal),
          });
          semCoordenadasTotal += 1;
        }
      }

      agregador.set(chave, atual);
    }

    const rankingCompleto = Array.from(agregador.values())
      .sort((a, b) => {
        if (b.quantidade !== a.quantidade) {
          return b.quantidade - a.quantidade;
        }

        if (a.municipio !== b.municipio) {
          return a.municipio.localeCompare(b.municipio, 'pt-BR');
        }

        return a.bairro.localeCompare(b.bairro, 'pt-BR');
      });

    const maximoQuantidade = rankingCompleto.reduce((maxAtual, item) => {
      return Math.max(maxAtual, item.quantidade);
    }, 0);

    const rankingEnriquecido = rankingCompleto.map((item, index) => {
      const intensidade = maximoQuantidade > 0 ? item.quantidade / maximoQuantidade : 0;
      const temCoordenadasReais = item.quantidadeComCoordenadas > 0;
      const posicaoEstimativa = coordenadaEstimativaBairro(item.municipio, item.bairroNormalizado);
      const latitude = temCoordenadasReais ? item.somaLatitude / item.quantidadeComCoordenadas : posicaoEstimativa.lat;
      const longitude = temCoordenadasReais ? item.somaLongitude / item.quantidadeComCoordenadas : posicaoEstimativa.lng;

      return {
        posicao: index + 1,
        municipio: item.municipio,
        bairro: item.bairro,
        bairroNormalizado: item.bairroNormalizado,
        quantidade: item.quantidade,
        quantidadeComCoordenadas: item.quantidadeComCoordenadas,
        intensidade,
        nivelIntensidade: calcularNivelIntensidade(intensidade),
        temCoordenadas: true,
        temCoordenadasReais,
        coordenadaOrigem: temCoordenadasReais ? 'real' : 'estimada',
        latitude,
        longitude,
      };
    });

    const bairrosMapa = rankingEnriquecido.filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
    const rankingLimitado = rankingEnriquecido.slice(0, rankingLimit);
    const totalBairrosComCoordenadasReais = rankingEnriquecido.filter((item) => item.temCoordenadasReais).length;
    const totalBairrosEstimados = rankingEnriquecido.length - totalBairrosComCoordenadasReais;

    const resposta = {
      resumo: {
        totalEleitoresLidos: usandoRPC ? (totalConsiderados + semBairroTotal + foraDoRecorteTotal) : base.length,
        totalEleitoresConsiderados: totalConsiderados,
        totalBairrosLista: rankingEnriquecido.length,
        totalBairrosMapa: bairrosMapa.length,
        totalBairrosComCoordenadasReais,
        totalBairrosEstimados,
        maximoQuantidade,
      },
      mapa: {
        centro: calcularCentro(bairrosMapa),
        bairros: bairrosMapa,
        legenda: criarLegenda(maximoQuantidade),
      },
      lista: {
        ranking: rankingLimitado,
        total: rankingEnriquecido.length,
      },
      inconsistencias: {
        semBairro: semBairro.slice(0, 50),
        semBairroTotal: semBairroTotal,
        semCoordenadas: semCoordenadas.slice(0, 50),
        semCoordenadasTotal: semCoordenadasTotal,
        foraDoRecorte: foraDoRecorte.slice(0, 50),
        foraDoRecorteTotal: foraDoRecorteTotal,
      },
      atualizadoEm: new Date().toISOString(),
      filtros: {
        municipios: ['Belém', 'Ananindeua'],
      },
    };

    heatmapCache.set(chaveCache, {
      expireAt: agora + HEATMAP_CACHE_TTL_MS,
      data: resposta,
    });

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.status(200).json(resposta);
  } catch (erro) {
    console.error('Erro no endpoint de mapa de bairros:', erro);
    return res.status(500).json({
      error: 'Erro interno ao montar mapa de bairros',
      detalhes: erro?.message || 'Erro desconhecido',
    });
  }
}
