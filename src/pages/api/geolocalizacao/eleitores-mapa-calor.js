import fs from 'fs/promises';
import path from 'path';
import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const UF_ALVO = 'PA';
const MANUAL_ALIAS = {
  'BELEM PA': 'BELEM',
  'ANANINDEUA PA': 'ANANINDEUA',
  'SANTAREM PA': 'SANTAREM',
  'ITAITUBA PA': 'ITAITUBA',
  'PARAUAPEBAS PA': 'PARAUAPEBAS',
};

let geoCache = null;

function normalizeText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeMunicipio(value) {
  const base = normalizeText(value)
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return MANUAL_ALIAS[base] || base;
}

function toTitleCase(value) {
  return String(value || '')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ');
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

function criarLegenda(maximo) {
  if (!maximo || maximo <= 0) {
    return [
      { nivel: 'zero', minimo: 0, maximo: 0, label: 'Sem eleitores', cor: '#E5E7EB' },
    ];
  }

  const thresholds = [0.2, 0.4, 0.6, 0.8, 1];
  const labels = ['Baixa', 'Media', 'Media-alta', 'Alta', 'Muito alta'];
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

  (geojson.features || []).forEach((feature) => {
    const props = feature.properties || {};
    const codigoIbge = String(props.id || '').trim();
    const nome = String(props.name || '').trim();
    const nomeNormalizado = normalizeMunicipio(nome);

    if (codigoIbge) {
      porCodigoIbge.set(codigoIbge, { codigoIbge, nome, nomeNormalizado });
    }

    if (nomeNormalizado) {
      porNomeNormalizado.set(nomeNormalizado, { codigoIbge, nome, nomeNormalizado });
    }
  });

  geoCache = {
    totalFeatures: (geojson.features || []).length,
    porCodigoIbge,
    porNomeNormalizado,
  };

  return geoCache;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  try {
    const rankingLimitRaw = parseInt(String(req.query.rankingLimit || '200'), 10);
    const rankingLimit = Number.isFinite(rankingLimitRaw) && rankingLimitRaw > 0
      ? Math.min(rankingLimitRaw, 500)
      : 200;

    const supabase = createServerClient();
    const geoReferencia = await carregarGeoReferencia();

    const { data: eleitores, error } = await supabase
      .from('eleitores')
      .select('id, municipio, cidade, bairro, uf, estado, status, statusCadastro');

    if (error) {
      return res.status(500).json({
        error: 'Erro ao consultar eleitores no Supabase',
        detalhes: error.message,
      });
    }

    const base = Array.isArray(eleitores) ? eleitores : [];

    if (base.length === 0) {
      return res.status(200).json({
        resumo: {
          totalEleitoresLidos: 0,
          totalEleitoresConsiderados: 0,
          totalMunicipiosLista: 0,
          totalMunicipiosMapa: 0,
          maximoQuantidade: 0,
          geoFeatures: geoReferencia.totalFeatures,
        },
        mapa: {
          geojsonPath: '/data/geo/pa-municipios.geojson',
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
      });
    }

    const agregador = new Map();
    const semCorrespondenciaMap = new Map();

    const semMunicipio = [];
    const semUF = [];
    const foraDoPA = [];

    let totalConsiderados = 0;

    for (const eleitor of base) {
      const municipioBruto = String(eleitor?.municipio || eleitor?.cidade || '').trim();
      const ufBruta = eleitor?.uf || eleitor?.estado || null;
      const ehPA = isUfPara(ufBruta);

      if (!municipioBruto) {
        semMunicipio.push({
          id: eleitor.id,
          uf: ufBruta,
          bairro: eleitor?.bairro || null,
        });
        continue;
      }

      if (ehPA === false) {
        foraDoPA.push({
          id: eleitor.id,
          municipio: municipioBruto,
          uf: ufBruta,
        });
        continue;
      }

      if (ehPA === null) {
        semUF.push({
          id: eleitor.id,
          municipio: municipioBruto,
        });
      }

      const municipioNormalizado = normalizeMunicipio(municipioBruto);
      const geoMatch = geoReferencia.porNomeNormalizado.get(municipioNormalizado);

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

        atualSemGeo.quantidade += 1;
        semCorrespondenciaMap.set(municipioNormalizado, atualSemGeo);
      }

      const atual = agregador.get(chave) || {
        municipio: nomeMunicipio,
        municipioNormalizado,
        codigoIbge,
        quantidade: 0,
        matchedGeo,
      };

      atual.quantidade += 1;
      atual.municipio = nomeMunicipio;
      atual.codigoIbge = codigoIbge;
      atual.matchedGeo = matchedGeo;

      agregador.set(chave, atual);
      totalConsiderados += 1;
    }

    const rankingCompleto = Array.from(agregador.values())
      .sort((a, b) => {
        if (b.quantidade !== a.quantidade) {
          return b.quantidade - a.quantidade;
        }

        return a.municipio.localeCompare(b.municipio, 'pt-BR');
      });

    const maximoQuantidade = rankingCompleto.reduce((maxAtual, item) => {
      return Math.max(maxAtual, item.quantidade);
    }, 0);

    const rankingEnriquecido = rankingCompleto.map((item, index) => {
      const intensidade = maximoQuantidade > 0 ? item.quantidade / maximoQuantidade : 0;

      return {
        posicao: index + 1,
        municipio: item.municipio,
        municipioNormalizado: item.municipioNormalizado,
        codigoIbge: item.codigoIbge,
        quantidade: item.quantidade,
        intensidade,
        nivelIntensidade: calcularNivelIntensidade(intensidade),
        matchedGeo: item.matchedGeo,
      };
    });

    const mapaMunicipios = rankingEnriquecido.filter((item) => item.matchedGeo && item.codigoIbge);
    const rankingLimitado = rankingEnriquecido.slice(0, rankingLimit);

    const semCorrespondenciaGeo = Array.from(semCorrespondenciaMap.values())
      .sort((a, b) => b.quantidade - a.quantidade);

    return res.status(200).json({
      resumo: {
        totalEleitoresLidos: base.length,
        totalEleitoresConsiderados: totalConsiderados,
        totalMunicipiosLista: rankingEnriquecido.length,
        totalMunicipiosMapa: mapaMunicipios.length,
        maximoQuantidade,
        geoFeatures: geoReferencia.totalFeatures,
      },
      mapa: {
        geojsonPath: '/data/geo/pa-municipios.geojson',
        municipios: mapaMunicipios,
        legenda: criarLegenda(maximoQuantidade),
      },
      lista: {
        ranking: rankingLimitado,
        total: rankingEnriquecido.length,
      },
      inconsistencias: {
        semMunicipio: semMunicipio.slice(0, 50),
        semMunicipioTotal: semMunicipio.length,
        foraDoPA: foraDoPA.slice(0, 50),
        foraDoPATotal: foraDoPA.length,
        semUF: semUF.slice(0, 50),
        semUFTotal: semUF.length,
        semCorrespondenciaGeo,
        semCorrespondenciaGeoTotal: semCorrespondenciaGeo.reduce((soma, item) => soma + item.quantidade, 0),
      },
      atualizadoEm: new Date().toISOString(),
      filtros: {
        ufAlvo: UF_ALVO,
      },
    });
  } catch (erro) {
    console.error('Erro no endpoint de mapa de calor de eleitores:', erro);
    return res.status(500).json({
      error: 'Erro interno ao montar mapa de calor',
      detalhes: erro?.message || 'Erro desconhecido',
    });
  }
}
