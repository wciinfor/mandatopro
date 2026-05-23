import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import chroma from 'chroma-js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartBar,
  faExclamationTriangle,
  faListOl,
  faMap,
  faRotate,
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';

const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '560px',
  background: '#EFF6FF',
};

const BELEM_CONTAINER_STYLE = {
  width: '100%',
  height: '560px',
  background: '#EFF6FF',
};

// Bounds pré-calculados — mapa já abre no tamanho certo do card sem salto
const PA_BOUNDS = [[-9.85, -58.9], [2.6, -46.0]];
const BELEM_BOUNDS = [[-1.555, -48.565], [-1.235, -48.33]];

const ITENS_POR_PAGINA_BAIRROS = 20;

// Paleta profissional teal — 6 degraus do mais claro ao mais escuro
const ESCALA_CORES = ['#CCFBF1', '#99F6E4', '#5EEAD4', '#14B8A6', '#0D9488', '#0F766E'];
const COR_SEM_DADO = '#E5E7EB';
const COR_EXCLUIDO = '#CBD5E1';

/**
 * Cria uma função de cor baseada em quebras quantis reais dos dados.
 * Retorna (quantidade) => cor hex.
 */
function criarEscalaQuantil(quantidades) {
  const valoresPositivos = quantidades.filter((v) => v > 0).sort((a, b) => a - b);
  if (valoresPositivos.length === 0) {
    return () => COR_SEM_DADO;
  }
  const escala = chroma.scale(ESCALA_CORES).classes(
    chroma.limits(valoresPositivos, 'q', ESCALA_CORES.length - 1)
  );
  return (qtd) => {
    if (!qtd || qtd <= 0) return COR_SEM_DADO;
    return escala(qtd).hex();
  };
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

export default function MapaCalorEleitoresPage() {
  const [abaAtiva, setAbaAtiva] = useState('mapa');
  const [abaAtivaBelem, setAbaAtivaBelem] = useState('mapa');
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [dadosBairros, setDadosBairros] = useState(null);
  const [loadingBairros, setLoadingBairros] = useState(true);
  const [erroBairros, setErroBairros] = useState('');
  const [filtroMunicipioBairros, setFiltroMunicipioBairros] = useState('TODOS');
  const [filtroPosicaoBairros, setFiltroPosicaoBairros] = useState('TODOS');
  const [buscaBairro, setBuscaBairro] = useState('');
  const [paginaBairros, setPaginaBairros] = useState(1);

  const [info, setInfo] = useState(null);
  const [mapaErro, setMapaErro] = useState('');
  const [carregandoMapa, setCarregandoMapa] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const geoLayerRef = useRef(null);

  const belemMapContainerRef = useRef(null);
  const belemMapInstanceRef = useRef(null);
  const [infoBairro, setInfoBairro] = useState(null);

  const municipiosPorIbge = useMemo(() => {
    const mapa = new Map();
    const municipios = dados?.mapa?.municipios || [];

    municipios.forEach((item) => {
      if (item?.codigoIbge) {
        mapa.set(String(item.codigoIbge), item);
      }
    });

    return mapa;
  }, [dados]);

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      setErro('');
      setMapaErro('');

      const response = await fetch('/api/geolocalizacao/eleitores-mapa-calor?rankingLimit=500');
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.detalhes || body?.error || 'Falha ao carregar dados do mapa de calor');
      }

      setDados(body);
    } catch (error) {
      setErro(error.message || 'Erro inesperado na consulta');
      setDados(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarDadosBairros = useCallback(async () => {
    try {
      setLoadingBairros(true);
      setErroBairros('');

      const response = await fetch('/api/geolocalizacao/eleitores-mapa-bairros?rankingLimit=300');
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.detalhes || body?.error || 'Falha ao carregar dados do mapa por bairros');
      }

      setDadosBairros(body);
    } catch (error) {
      setErroBairros(error.message || 'Erro inesperado na consulta por bairros');
      setDadosBairros(null);
    } finally {
      setLoadingBairros(false);
    }
  }, []);

  const carregarTudo = useCallback(async () => {
    await Promise.allSettled([carregarDados(), carregarDadosBairros()]);
  }, [carregarDados, carregarDadosBairros]);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  useEffect(() => {
    if (
      loading ||
      erro ||
      abaAtiva !== 'mapa' ||
      !dados?.mapa?.geojsonPath ||
      !mapContainerRef.current
    ) {
      return;
    }

    let ativo = true;

    const montarMapa = async () => {
      setCarregandoMapa(true);
      setMapaErro('');

      const leafletModule = await import('leaflet');
      const L = leafletModule.default || leafletModule;

      if (!ativo) return;

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapContainerRef.current, {
          zoomControl: true,
          attributionControl: false,
          preferCanvas: true,
        });
      }

      // Garante que o Leaflet reconhece o tamanho real do card antes do fitBounds
      mapInstanceRef.current.invalidateSize();
      mapInstanceRef.current.fitBounds(PA_BOUNDS);

      const map = mapInstanceRef.current;

      if (geoLayerRef.current) {
        geoLayerRef.current.remove();
        geoLayerRef.current = null;
      }

      const response = await fetch(dados.mapa.geojsonPath);
      const geojson = await response.json();

      if (!response.ok) {
        throw new Error('Falha ao carregar a malha territorial do mapa');
      }

      if (!ativo) return;

      // Escala quantil baseada nos valores reais dos municípios do PA
      const quantidadesPA = Array.from(municipiosPorIbge.values())
        .filter((r) => !r.excluidoTemperatura)
        .map((r) => Number(r.quantidade || 0));
      const corPA = criarEscalaQuantil(quantidadesPA);

      const layer = L.geoJSON(geojson, {
        style: (feature) => {
          const codigoIbge = String(feature?.properties?.id || '');
          const registro = municipiosPorIbge.get(codigoIbge);
          const temRegistro = Boolean(registro);
          const excluidoTemperatura = Boolean(registro?.excluidoTemperatura);
          const qtd = Number(registro?.quantidade || 0);

          const fillColor = excluidoTemperatura
            ? COR_EXCLUIDO
            : temRegistro
              ? corPA(qtd)
              : COR_SEM_DADO;

          return {
            fillColor,
            fillOpacity: temRegistro ? 0.86 : 0.32,
            color: '#0F172A',
            weight: temRegistro ? 0.8 : 0.4,
          };
        },
        onEachFeature: (feature, camada) => {
          const criarInfo = (fixa = false) => {
            const codigoIbge = String(feature?.properties?.id || '');
            const nomeMunicipio = String(feature?.properties?.name || 'Município sem nome');
            const registro = municipiosPorIbge.get(codigoIbge);

            return {
              municipio: registro?.municipio || nomeMunicipio,
              codigoIbge,
              quantidade: registro?.quantidade || 0,
              excluidoTemperatura: Boolean(registro?.excluidoTemperatura),
              matchedGeo: Boolean(registro),
              fixa,
            };
          };

          camada.on('mouseover', (e) => {
            camada.setStyle({ weight: 2, color: '#0F172A' });
            setInfo((prev) => (prev?.fixa ? prev : criarInfo(false)));
          });

          camada.on('mouseout', () => {
            layer.resetStyle(camada);
            setInfo((prev) => (prev?.fixa ? prev : null));
          });

          camada.on('click', () => {
            setInfo(criarInfo(true));
          });
        },
      }).addTo(map);

      geoLayerRef.current = layer;

      // Não chama fitBounds novamente — o mapa já iniciou com PA_BOUNDS correto
      setCarregandoMapa(false);
    };

    montarMapa().catch((error) => {
      if (!ativo) return;
      console.error('Erro ao montar malha territorial:', error);
      setMapaErro(error?.message || 'Não foi possível carregar o mapa territorial.');
      setCarregandoMapa(false);
    });

    return () => {
      ativo = false;
    };
  }, [abaAtiva, loading, erro, dados?.mapa?.geojsonPath, municipiosPorIbge]);

  useEffect(() => {
    if (abaAtiva === 'mapa') return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      geoLayerRef.current = null;
    }
    setInfo(null);
  }, [abaAtiva]);

  useEffect(() => {
    if (abaAtivaBelem === 'mapa') return;
    if (belemMapInstanceRef.current) {
      belemMapInstanceRef.current.remove();
      belemMapInstanceRef.current = null;
    }
    setInfoBairro(null);
  }, [abaAtivaBelem]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      geoLayerRef.current = null;
      if (belemMapInstanceRef.current) {
        belemMapInstanceRef.current.remove();
        belemMapInstanceRef.current = null;
      }
    };
  }, []);

  const ranking = dados?.lista?.ranking || [];
  const inconsistencias = dados?.inconsistencias || {};
  const rankingBairros = useMemo(() => dadosBairros?.lista?.ranking || [], [dadosBairros]);
  const inconsistenciasBairros = dadosBairros?.inconsistencias || {};

  const municipiosBairros = useMemo(() => {
    return Array.from(new Set(
      rankingBairros
        .map((item) => String(item?.municipio || '').trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [rankingBairros]);

  const rankingBairrosFiltrado = useMemo(() => {
    const termoBusca = buscaBairro.trim().toLowerCase();

    return rankingBairros.filter((item) => {
      const municipio = String(item?.municipio || '');
      const bairro = String(item?.bairro || '');
      const origemPosicao = String(item?.coordenadaOrigem || '').toLowerCase();

      const matchMunicipio = filtroMunicipioBairros === 'TODOS' || municipio === filtroMunicipioBairros;
      const matchPosicao = filtroPosicaoBairros === 'TODOS' || origemPosicao === filtroPosicaoBairros;
      const matchBusca = !termoBusca || bairro.toLowerCase().includes(termoBusca);

      return matchMunicipio && matchPosicao && matchBusca;
    });
  }, [rankingBairros, filtroMunicipioBairros, filtroPosicaoBairros, buscaBairro]);

  const totalPaginasBairros = Math.max(1, Math.ceil(rankingBairrosFiltrado.length / ITENS_POR_PAGINA_BAIRROS));
  const paginaBairrosSegura = Math.min(paginaBairros, totalPaginasBairros);

  const rankingBairrosPaginado = useMemo(() => {
    const inicio = (paginaBairrosSegura - 1) * ITENS_POR_PAGINA_BAIRROS;
    return rankingBairrosFiltrado.slice(inicio, inicio + ITENS_POR_PAGINA_BAIRROS);
  }, [rankingBairrosFiltrado, paginaBairrosSegura]);

  useEffect(() => {
    setPaginaBairros(1);
  }, [filtroMunicipioBairros, filtroPosicaoBairros, buscaBairro]);

  useEffect(() => {
    if (paginaBairros > totalPaginasBairros) {
      setPaginaBairros(totalPaginasBairros);
    }
  }, [paginaBairros, totalPaginasBairros]);

  // ─── Mapa de Belém ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (abaAtivaBelem !== 'mapa') return;
    if (loadingBairros || erroBairros || rankingBairros.length === 0) return;
    if (!belemMapContainerRef.current) return;

    let ativo = true;
    let geoLayer = null;

    const norm = (v) =>
      String(v || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const porNome = new Map();
    rankingBairros.forEach((b) => {
      porNome.set(norm(b.bairro), b);
      if (b.bairroNormalizado) porNome.set(norm(b.bairroNormalizado), b);
    });

    const corBairro = criarEscalaQuantil(rankingBairros.map((b) => Number(b.quantidade || 0)));

    const montar = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default || leafletModule;
      if (!ativo) return;

      // Cria mapa uma única vez — nunca chamar .remove() pois limpa o CSS do container
      if (!belemMapInstanceRef.current) {
        belemMapInstanceRef.current = L.map(belemMapContainerRef.current, {
          zoomControl: true,
          attributionControl: false,
        });
      }

      const map = belemMapInstanceRef.current;

      // Remove camadas anteriores sem destruir o mapa
      if (belemMapInstanceRef._geoLayer) {
        belemMapInstanceRef._geoLayer.remove();
        belemMapInstanceRef._geoLayer = null;
      }
      if (belemMapInstanceRef._ilhasControl) {
        belemMapInstanceRef._ilhasControl.remove();
        belemMapInstanceRef._ilhasControl = null;
      }

      // Exatamente como o mapa do PA: invalidateSize + fitBounds ANTES do fetch
      // fitBounds chama setView internamente → seta _loaded=true
      map.invalidateSize({ animate: false });
      map.fitBounds(BELEM_BOUNDS, { animate: false });

      // Carrega GeoJSON
      const resp = await fetch('/data/geo/belem-bairros.geojson');
      const geojson = await resp.json();
      if (!ativo) return;

      const ILHAS_IDS = new Set([6458566, 6458567]); // Mosqueiro, Outeiro
      // osm_id 5995972 ("Rua Nova") tem coordenadas em Recife/PE — dado incorreto no GeoJSON
      const INVALIDOS_IDS = new Set([5995972]);

      const principais = geojson.features.filter(
        (f) => !ILHAS_IDS.has(f.properties.osm_id) && !INVALIDOS_IDS.has(f.properties.osm_id)
      );
      const ilhas = geojson.features.filter((f) => ILHAS_IDS.has(f.properties.osm_id));

      // Bordas brancas: cada polígono contribui com borda branca na divisa →
      // nunca acumula cor escura entre vizinhos, resultado limpo como no screenshot de referência
      const estiloFeature = (feature) => {
        const reg = porNome.get(norm(feature?.properties?.name || ''));
        const qtd = reg ? Number(reg.quantidade || 0) : 0;
        return {
          fillColor: qtd > 0 ? corBairro(qtd) : COR_SEM_DADO,
          fillOpacity: qtd > 0 ? 0.85 : 0.35,
          color: '#1e293b',
          weight: 0.8,
          opacity: 1,
        };
      };

      const estiloDestaque = { weight: 2.5, color: '#0f172a', fillOpacity: 0.95 };

      geoLayer = L.geoJSON(
        { type: 'FeatureCollection', features: principais },
        {
          style: estiloFeature,
          smoothFactor: 0,
          onEachFeature: (feature, layer) => {
            const reg = porNome.get(norm(feature?.properties?.name || ''));
            const nome = feature?.properties?.name || 'Bairro';
            const qtd = reg ? Number(reg.quantidade || 0) : 0;

            layer.on('mouseover', () => {
              layer.setStyle(estiloDestaque);
              layer.bringToFront();
              if (ativo) setInfoBairro({ bairro: nome, municipio: reg?.municipio || '', quantidade: qtd, fixa: false });
            });
            layer.on('mouseout', () => {
              geoLayer.resetStyle(layer);
              if (ativo) setInfoBairro((prev) => (prev?.fixa ? prev : null));
            });
            layer.on('click', () => {
              if (ativo) setInfoBairro({ bairro: nome, municipio: reg?.municipio || '', quantidade: qtd, fixa: true });
            });
          },
        }
      ).addTo(map);

      belemMapInstanceRef._geoLayer = geoLayer;

      // Usa BELEM_BOUNDS fixo — evita zoom-out causado por polígonos com coordenadas outlier no GeoJSON
      map.fitBounds(BELEM_BOUNDS, { animate: false });

      // Painel de ilhas no canto inferior esquerdo
      const IlhasControl = L.Control.extend({
        onAdd() {
          const div = L.DomUtil.create('div');
          div.style.cssText =
            'background:rgba(15,23,42,0.85);border-radius:8px;padding:6px 10px;color:#fff;font-size:12px;min-width:130px;box-shadow:0 2px 8px rgba(0,0,0,.4);';
          div.innerHTML =
            '<div style="font-weight:600;font-size:11px;letter-spacing:.5px;opacity:.7;margin-bottom:4px;text-transform:uppercase;">Ilhas</div>';

          ilhas.forEach((feature) => {
            const reg = porNome.get(norm(feature?.properties?.name || ''));
            const nome = feature?.properties?.name || 'Ilha';
            const qtd = reg ? Number(reg.quantidade || 0) : 0;
            const cor = qtd > 0 ? corBairro(qtd) : COR_SEM_DADO;

            const row = L.DomUtil.create('div', '', div);
            row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:3px;cursor:pointer;';
            row.title = qtd > 0 ? `${nome}: ${formatNumber(qtd)} eleitores` : `${nome}: sem dados`;

            const dot = L.DomUtil.create('span', '', row);
            dot.style.cssText = `display:inline-block;width:12px;height:12px;border-radius:50%;background:${cor};border:1px solid rgba(255,255,255,.4);flex-shrink:0;`;

            const lbl = L.DomUtil.create('span', '', row);
            lbl.innerHTML = `<strong style="display:block;line-height:1.3;font-size:12px;">${nome}</strong><span style="opacity:.7;font-size:11px;">${qtd > 0 ? formatNumber(qtd) : 'sem dados'}</span>`;

            row.addEventListener('click', () => {
              if (ativo) setInfoBairro({ bairro: nome, municipio: reg?.municipio || 'Belém', quantidade: qtd, fixa: true });
            });
          });

          L.DomEvent.disableClickPropagation(div);
          return div;
        },
        onRemove() {},
      });

      const ctrl = new IlhasControl({ position: 'bottomleft' });
      ctrl.addTo(map);
      belemMapInstanceRef._ilhasControl = ctrl;
    };

    montar().catch((err) => console.error('[BELEM MAP]', err));

    return () => { ativo = false; };
  }, [abaAtivaBelem, loadingBairros, erroBairros, rankingBairros]);

  return (
    <Layout titulo="Mapa de Calor de Eleitores (PA)">
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-lg border border-teal-100 p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-teal-800">Distribuição de Eleitores no Pará</h1>
              <p className="text-sm text-gray-600 mt-1">
                Mapa de calor e ranking por município com dados reais agregados do sistema.
              </p>
            </div>
            <button
              onClick={carregarTudo}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm"
            >
              <FontAwesomeIcon icon={faRotate} />
              Atualizar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
            <div className="rounded-lg bg-teal-50 border border-teal-100 p-3">
              <div className="text-xs text-gray-600">Eleitores considerados</div>
              <div className="text-2xl font-bold text-teal-700">{formatNumber(dados?.resumo?.totalEleitoresConsiderados)}</div>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
              <div className="text-xs text-gray-600">Municípios no mapa</div>
              <div className="text-2xl font-bold text-emerald-700">{formatNumber(dados?.resumo?.totalMunicipiosMapa)}</div>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
              <div className="text-xs text-gray-600">Municípios no ranking</div>
              <div className="text-2xl font-bold text-amber-700">{formatNumber(dados?.resumo?.totalMunicipiosLista)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div className="text-xs text-gray-600">Maior quantidade</div>
              <div className="text-2xl font-bold text-slate-700">{formatNumber(dados?.resumo?.maximoQuantidade)}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="bg-white rounded-xl shadow-lg border border-teal-100 p-4 lg:p-5">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setAbaAtiva('mapa')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                abaAtiva === 'mapa' ? 'bg-teal-600 text-white' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
              }`}
            >
              <FontAwesomeIcon icon={faMap} className="mr-2" />
              Mapa
            </button>
            <button
              onClick={() => setAbaAtiva('lista')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                abaAtiva === 'lista' ? 'bg-teal-600 text-white' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
              }`}
            >
              <FontAwesomeIcon icon={faListOl} className="mr-2" />
              Lista
            </button>
          </div>

          {loading && (
            <div className="py-12 text-center text-gray-500">Carregando dados reais do sistema...</div>
          )}

          {!loading && erro && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <div className="font-semibold mb-1">Falha na consulta</div>
              <div>{erro}</div>
            </div>
          )}

          {!loading && !erro && ranking.length === 0 && (
            <div className="p-5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
              Base vazia para os filtros atuais. Não há municípios para exibir no mapa/lista.
            </div>
          )}

          {!loading && !erro && ranking.length > 0 && abaAtiva === 'mapa' && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-slate-200">
                <div ref={mapContainerRef} style={MAP_CONTAINER_STYLE} />

                {carregandoMapa && (
                  <div className="absolute top-3 right-3 bg-white/90 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 shadow-sm">
                    Renderizando malha simplificada...
                  </div>
                )}

                {mapaErro && (
                  <div className="absolute bottom-3 left-3 right-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 shadow-sm">
                    {mapaErro}
                  </div>
                )}

                {info && (
                  <div className="absolute top-4 left-16 sm:left-20 bg-white rounded-lg shadow-lg p-4 border border-slate-200 text-sm z-[500] min-w-[200px] max-w-xs">
                    <button
                      onClick={() => setInfo(null)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-lg"
                    >
                      ✕
                    </button>
                    <div className="font-bold text-slate-800 pr-6">{info.municipio}</div>
                    <div className="text-slate-600 text-xs mt-1">IBGE: {info.codigoIbge || 'Não informado'}</div>
                    <div className="text-teal-700 font-semibold mt-2">
                      Quantidade: {formatNumber(info.quantidade)}
                    </div>
                    {info.excluidoTemperatura && (
                      <div className="text-slate-600 text-xs mt-2">
                        Este município foi excluído da escala térmica para não distorcer o mapa.
                      </div>
                    )}
                    {!info.matchedGeo && (
                      <div className="text-amber-700 text-xs mt-2">Sem correspondência agregada</div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {ESCALA_CORES.map((cor, i) => (
                  <div key={cor} className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: cor }} />
                    <span className="text-xs text-slate-700">{['Muito baixa', 'Baixa', 'Média-baixa', 'Média', 'Alta', 'Muito alta'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && !erro && ranking.length > 0 && abaAtiva === 'lista' && (
            <div className="overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3">#</th>
                    <th className="text-left px-4 py-3">Município</th>
                    <th className="text-left px-4 py-3">IBGE</th>
                    <th className="text-right px-4 py-3">Quantidade</th>
                    <th className="text-left px-4 py-3">Mapa</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((item) => (
                    <tr key={`${item.codigoIbge || item.municipioNormalizado}-${item.posicao}`} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-600">{item.posicao}</td>
                      <td className="px-4 py-2 font-semibold text-slate-800">{item.municipio}</td>
                      <td className="px-4 py-2 text-slate-600">{item.codigoIbge || '-'}</td>
                      <td className="px-4 py-2 text-right font-bold text-teal-700">{formatNumber(item.quantidade)}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${item.matchedGeo ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {item.matchedGeo ? 'Mapeado' : 'Sem geo'}
                          </span>
                          {item.excluidoTemperatura && (
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                              Fora da escala térmica
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Card: Mapa de Belém por Bairros ──────────────────────────── */}
        <div className="bg-white rounded-xl shadow-lg border border-cyan-100 p-4 lg:p-5">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setAbaAtivaBelem('mapa')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                abaAtivaBelem === 'mapa' ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
              }`}
            >
              <FontAwesomeIcon icon={faMap} className="mr-2" />
              Mapa
            </button>
            <button
              onClick={() => setAbaAtivaBelem('lista')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                abaAtivaBelem === 'lista' ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
              }`}
            >
              <FontAwesomeIcon icon={faListOl} className="mr-2" />
              Lista
            </button>
          </div>

          {loadingBairros && (
            <div className="py-12 text-center text-gray-500">Carregando dados de bairros...</div>
          )}

          {!loadingBairros && erroBairros && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <div className="font-semibold mb-1">Falha na consulta</div>
              <div>{erroBairros}</div>
            </div>
          )}

          {!loadingBairros && !erroBairros && rankingBairros.length === 0 && (
            <div className="p-5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
              Não há bairros suficientes para exibir.
            </div>
          )}

          {!loadingBairros && !erroBairros && rankingBairros.length > 0 && abaAtivaBelem === 'mapa' && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-slate-200">
                <div ref={belemMapContainerRef} style={{ width: '100%', height: '560px', background: '#e5e7eb' }}></div>

                {infoBairro && (
                  <div className="absolute top-4 left-4 z-[500] bg-white rounded-lg shadow-lg p-3 border border-slate-200 text-sm min-w-[180px]">
                    <button onClick={() => setInfoBairro(null)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600">✕</button>
                    <div className="font-bold text-slate-800 pr-6">{infoBairro.bairro}</div>
                    <div className="text-slate-500 text-xs">{infoBairro.municipio}</div>
                    <div className="text-cyan-700 font-semibold mt-1">{formatNumber(infoBairro.quantidade)} eleitores</div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {ESCALA_CORES.map((cor, i) => (
                  <div key={cor} className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: cor }} />
                    <span className="text-xs text-slate-700">{['Muito baixa', 'Baixa', 'Média-baixa', 'Média', 'Alta', 'Muito alta'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loadingBairros && !erroBairros && rankingBairros.length > 0 && abaAtivaBelem === 'lista' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-lg bg-cyan-50 border border-cyan-100 p-3">
                  <div className="text-xs text-gray-600">Eleitores considerados</div>
                  <div className="text-2xl font-bold text-cyan-700">{formatNumber(dadosBairros?.resumo?.totalEleitoresConsiderados)}</div>
                </div>
                <div className="rounded-lg bg-sky-50 border border-sky-100 p-3">
                  <div className="text-xs text-gray-600">Bairros com posição</div>
                  <div className="text-2xl font-bold text-sky-700">{formatNumber(dadosBairros?.resumo?.totalBairrosMapa)}</div>
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                  <div className="text-xs text-gray-600">Bairros no ranking</div>
                  <div className="text-2xl font-bold text-blue-700">{formatNumber(dadosBairros?.resumo?.totalBairrosLista)}</div>
                </div>
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3">
                  <div className="text-xs text-gray-600">Maior concentração</div>
                  <div className="text-2xl font-bold text-indigo-700">{formatNumber(dadosBairros?.resumo?.maximoQuantidade)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                  <div className="text-xs text-gray-600">Bairros com posição real</div>
                  <div className="text-xl font-bold text-emerald-700">{formatNumber(dadosBairros?.resumo?.totalBairrosComCoordenadasReais)}</div>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                  <div className="text-xs text-gray-600">Bairros com posição estimada</div>
                  <div className="text-xl font-bold text-amber-700">{formatNumber(dadosBairros?.resumo?.totalBairrosEstimados)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Município</label>
                  <select
                    value={filtroMunicipioBairros}
                    onChange={(e) => setFiltroMunicipioBairros(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="TODOS">Todos</option>
                    {municipiosBairros.map((municipio) => (
                      <option key={municipio} value={municipio}>{municipio}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Posição</label>
                  <select
                    value={filtroPosicaoBairros}
                    onChange={(e) => setFiltroPosicaoBairros(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="TODOS">Todas</option>
                    <option value="real">Real</option>
                    <option value="estimada">Estimada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Buscar bairro</label>
                  <input
                    type="text"
                    value={buscaBairro}
                    onChange={(e) => setBuscaBairro(e.target.value)}
                    placeholder="Digite o nome do bairro"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="overflow-auto rounded-lg border border-slate-200">
                <h3 className="text-base font-bold text-cyan-800 px-4 pt-4 pb-2">Tabela de bairros</h3>
                <div className="px-4 pb-2 text-xs text-slate-600">
                  Exibindo {formatNumber(rankingBairrosFiltrado.length)} bairros filtrados.
                </div>
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="text-left px-4 py-3">#</th>
                      <th className="text-left px-4 py-3">Município</th>
                      <th className="text-left px-4 py-3">Bairro</th>
                      <th className="text-left px-4 py-3">Posição</th>
                      <th className="text-right px-4 py-3">Quantidade</th>
                      <th className="text-right px-4 py-3">Com coordenadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingBairrosPaginado.map((item) => (
                      <tr key={`${item.municipio}-${item.bairroNormalizado}-${item.posicao}`} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-600">{item.posicao}</td>
                        <td className="px-4 py-2 text-slate-700">{item.municipio}</td>
                        <td className="px-4 py-2 font-semibold text-slate-800">{item.bairro}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${item.coordenadaOrigem === 'real' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {item.coordenadaOrigem === 'real' ? 'Real' : 'Estimada'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-cyan-700">{formatNumber(item.quantidade)}</td>
                        <td className="px-4 py-2 text-right text-slate-700">{formatNumber(item.quantidadeComCoordenadas)}</td>
                      </tr>
                    ))}
                    {rankingBairrosPaginado.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                          Nenhum bairro encontrado para os filtros aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {rankingBairrosFiltrado.length > 0 && (
                  <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50">
                    <div className="text-xs text-slate-600">
                      Página {paginaBairrosSegura} de {totalPaginasBairros}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPaginaBairros((prev) => Math.max(1, prev - 1))}
                        disabled={paginaBairrosSegura <= 1}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaginaBairros((prev) => Math.min(totalPaginasBairros, prev + 1))}
                        disabled={paginaBairrosSegura >= totalPaginasBairros}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Próxima
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                  <div className="text-xs text-gray-600">Sem bairro</div>
                  <div className="text-2xl font-bold text-amber-700">{formatNumber(inconsistenciasBairros.semBairroTotal)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <div className="text-xs text-gray-600">Sem coordenadas</div>
                  <div className="text-2xl font-bold text-slate-700">{formatNumber(inconsistenciasBairros.semCoordenadasTotal)}</div>
                </div>
                <div className="rounded-lg bg-rose-50 border border-rose-100 p-3">
                  <div className="text-xs text-gray-600">Fora do recorte</div>
                  <div className="text-2xl font-bold text-rose-700">{formatNumber(inconsistenciasBairros.foraDoRecorteTotal)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>{/* fim grid PA+Belém */}

        {!loading && !erro && (
          <div className="bg-white rounded-xl shadow-lg border border-amber-100 p-4 lg:p-5">
            <h2 className="text-lg font-bold text-amber-800 flex items-center gap-2">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              Relatório de inconsistências
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                <div className="text-xs text-gray-600">Sem município/cidade</div>
                <div className="text-2xl font-bold text-amber-700">{formatNumber(inconsistencias.semMunicipioTotal)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <div className="text-xs text-gray-600">UF ausente</div>
                <div className="text-2xl font-bold text-slate-700">{formatNumber(inconsistencias.semUFTotal)}</div>
              </div>
              <div className="rounded-lg bg-rose-50 border border-rose-100 p-3">
                <div className="text-xs text-gray-600">Registros fora do PA</div>
                <div className="text-2xl font-bold text-rose-700">{formatNumber(inconsistencias.foraDoPATotal)}</div>
              </div>
              <div className="rounded-lg bg-orange-50 border border-orange-100 p-3">
                <div className="text-xs text-gray-600">Sem correspondência geográfica</div>
                <div className="text-2xl font-bold text-orange-700">{formatNumber(inconsistencias.semCorrespondenciaGeoTotal)}</div>
              </div>
            </div>

            {(inconsistencias.semCorrespondenciaGeo || []).length > 0 && (
              <div className="mt-4 overflow-auto rounded-lg border border-orange-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-orange-50 text-orange-800">
                    <tr>
                      <th className="text-left px-4 py-2">Município informado</th>
                      <th className="text-left px-4 py-2">Normalizado</th>
                      <th className="text-right px-4 py-2">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inconsistencias.semCorrespondenciaGeo.map((item) => (
                      <tr key={item.municipioNormalizado} className="border-t border-orange-100">
                        <td className="px-4 py-2">{item.municipioInformado}</td>
                        <td className="px-4 py-2 text-slate-600">{item.municipioNormalizado}</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatNumber(item.quantidade)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(inconsistencias.semCorrespondenciaGeo || []).length === 0 && (
              <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-700">
                Nenhuma divergência de município detectada entre os dados e a malha territorial.
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg border border-teal-100 p-4 lg:p-5">
          <h2 className="text-lg font-bold text-teal-800 flex items-center gap-2">
            <FontAwesomeIcon icon={faChartBar} />
            Conferência rápida
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
              <div className="text-xs text-gray-600">Soma da lista</div>
              <div className="text-xl font-bold text-slate-700">
                {formatNumber((ranking || []).reduce((soma, item) => soma + Number(item.quantidade || 0), 0))}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
              <div className="text-xs text-gray-600">Total considerado</div>
              <div className="text-xl font-bold text-slate-700">{formatNumber(dados?.resumo?.totalEleitoresConsiderados)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
              <div className="text-xs text-gray-600">Município líder</div>
              <div className="text-xl font-bold text-slate-700">{ranking[0]?.municipio || '-'}</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Os valores acima ajudam a validar se os números do mapa e da lista estão consistentes entre si.
          </p>
        </div>
      </div>
    </Layout>
  );
}
