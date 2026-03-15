import { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartBar,
  faExclamationTriangle,
  faListOl,
  faMap,
  faRotate,
} from '@fortawesome/free-solid-svg-icons';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import Layout from '@/components/Layout';
import { GOOGLE_MAPS_CONFIG } from '@/config/maps';

const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '620px',
};

const PA_CENTER = {
  lat: -3.6,
  lng: -52.2,
};

const MAP_OPTIONS = {
  disableDefaultUI: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  zoomControl: true,
  styles: [
    {
      featureType: 'administrative',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#334155' }],
    },
    {
      featureType: 'poi',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

const MAP_LIBRARIES = ['places'];

function getFillColor(intensidade, temRegistro) {
  if (!temRegistro) return '#E5E7EB';
  if (intensidade >= 0.8) return '#0F766E';
  if (intensidade >= 0.6) return '#0D9488';
  if (intensidade >= 0.4) return '#14B8A6';
  if (intensidade > 0) return '#5EEAD4';
  return '#CCFBF1';
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

export default function MapaCalorEleitoresPage() {
  const [abaAtiva, setAbaAtiva] = useState('mapa');
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [map, setMap] = useState(null);
  const [info, setInfo] = useState(null);
  const listenersRef = useRef([]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_CONFIG.apiKey;

  const { isLoaded: isMapsLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
    libraries: MAP_LIBRARIES,
    language: 'pt-BR',
    region: 'BR',
  });

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

  const carregarDados = async () => {
    try {
      setLoading(true);
      setErro('');

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
  };

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    if (!map || !isMapsLoaded || !dados?.mapa?.geojsonPath) {
      return;
    }

    let ativo = true;

    listenersRef.current.forEach((listener) => listener.remove());
    listenersRef.current = [];

    map.data.forEach((feature) => {
      map.data.remove(feature);
    });

    const carregarGeojson = async () => {
      const response = await fetch(dados.mapa.geojsonPath);
      const geojson = await response.json();

      if (!ativo) {
        return;
      }

      map.data.addGeoJson(geojson);

      map.data.setStyle((feature) => {
        const codigoIbge = String(feature.getProperty('id') || '');
        const registro = municipiosPorIbge.get(codigoIbge);
        const intensidade = registro?.intensidade || 0;
        const temRegistro = Boolean(registro);

        return {
          fillColor: getFillColor(intensidade, temRegistro),
          fillOpacity: temRegistro ? 0.86 : 0.32,
          strokeColor: '#0F172A',
          strokeWeight: temRegistro ? 0.8 : 0.4,
          clickable: true,
          zIndex: temRegistro ? 3 : 1,
        };
      });

      const criarInfo = (event, fixa = false) => {
        const feature = event.feature;
        const codigoIbge = String(feature.getProperty('id') || '');
        const nomeMunicipio = String(feature.getProperty('name') || 'Municipio sem nome');
        const registro = municipiosPorIbge.get(codigoIbge);

        return {
          municipio: registro?.municipio || nomeMunicipio,
          codigoIbge,
          quantidade: registro?.quantidade || 0,
          matchedGeo: Boolean(registro),
          fixa,
        };
      };

      listenersRef.current.push(
        map.data.addListener('mouseover', (event) => {
          setInfo((prev) => {
            if (prev?.fixa) {
              return prev;
            }

            return criarInfo(event, false);
          });
        })
      );

      listenersRef.current.push(
        map.data.addListener('click', (event) => {
          setInfo(criarInfo(event, true));
        })
      );

      listenersRef.current.push(
        map.data.addListener('mouseout', () => {
          setInfo((prev) => {
            if (prev?.fixa) {
              return prev;
            }
            return null;
          });
        })
      );
    };

    carregarGeojson().catch((error) => {
      console.error('Erro ao carregar geojson do mapa de calor:', error);
      setErro('Nao foi possivel carregar o arquivo geografico do Para.');
    });

    return () => {
      ativo = false;
      listenersRef.current.forEach((listener) => listener.remove());
      listenersRef.current = [];
    };
  }, [map, isMapsLoaded, dados?.mapa?.geojsonPath, municipiosPorIbge]);

  const ranking = dados?.lista?.ranking || [];
  const inconsistencias = dados?.inconsistencias || {};

  return (
    <Layout titulo="Mapa de Calor de Eleitores (PA)">
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-lg border border-teal-100 p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-teal-800">Distribuicao de Eleitores no Para</h1>
              <p className="text-sm text-gray-600 mt-1">
                Mapa de calor e ranking por municipio com dados reais agregados do Supabase.
              </p>
            </div>
            <button
              onClick={carregarDados}
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
              <div className="text-xs text-gray-600">Municipios no mapa</div>
              <div className="text-2xl font-bold text-emerald-700">{formatNumber(dados?.resumo?.totalMunicipiosMapa)}</div>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
              <div className="text-xs text-gray-600">Municipios no ranking</div>
              <div className="text-2xl font-bold text-amber-700">{formatNumber(dados?.resumo?.totalMunicipiosLista)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div className="text-xs text-gray-600">Maior quantidade</div>
              <div className="text-2xl font-bold text-slate-700">{formatNumber(dados?.resumo?.maximoQuantidade)}</div>
            </div>
          </div>
        </div>

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
            <div className="py-12 text-center text-gray-500">Carregando dados reais do Supabase...</div>
          )}

          {!loading && erro && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <div className="font-semibold mb-1">Falha na consulta</div>
              <div>{erro}</div>
            </div>
          )}

          {!loading && !erro && ranking.length === 0 && (
            <div className="p-5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
              Base vazia para os filtros atuais. Nao ha municipios para exibir no mapa/lista.
            </div>
          )}

          {!loading && !erro && ranking.length > 0 && abaAtiva === 'mapa' && (
            <div className="space-y-4">
              {!apiKey && (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                  A chave do Google Maps nao esta configurada. Defina NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para visualizar o mapa.
                </div>
              )}

              {loadError && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  Erro ao carregar Google Maps: {loadError.message}
                </div>
              )}

              {apiKey && isMapsLoaded && !loadError && (
                <div className="relative rounded-xl overflow-hidden border border-slate-200">
                  <GoogleMap
                    mapContainerStyle={MAP_CONTAINER_STYLE}
                    center={PA_CENTER}
                    zoom={6}
                    options={MAP_OPTIONS}
                    onLoad={(mapInstance) => setMap(mapInstance)}
                  />
                  
                  {/* Caixa de informações customizada no canto superior esquerdo */}
                  {info && (
                    <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 border border-slate-200 text-sm z-10 min-w-[200px] max-w-xs">
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
                      {!info.matchedGeo && (
                        <div className="text-amber-700 text-xs mt-2">Sem correspondência agregada</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-sm font-semibold text-slate-700 mb-2">Legenda de intensidade</div>
                <div className="flex flex-wrap gap-2">
                  {(dados?.mapa?.legenda || []).map((item) => (
                    <div key={item.nivel} className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: item.cor }} />
                      <span className="text-xs text-slate-700">
                        {item.label}: {formatNumber(item.minimo)} - {formatNumber(item.maximo)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loading && !erro && ranking.length > 0 && abaAtiva === 'lista' && (
            <div className="overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3">#</th>
                    <th className="text-left px-4 py-3">Municipio</th>
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
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${item.matchedGeo ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {item.matchedGeo ? 'Mapeado' : 'Sem geo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && !erro && (
          <div className="bg-white rounded-xl shadow-lg border border-amber-100 p-4 lg:p-5">
            <h2 className="text-lg font-bold text-amber-800 flex items-center gap-2">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              Relatorio de inconsistencias
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                <div className="text-xs text-gray-600">Sem municipio/cidade</div>
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
                <div className="text-xs text-gray-600">Sem correspondencia geografia</div>
                <div className="text-2xl font-bold text-orange-700">{formatNumber(inconsistencias.semCorrespondenciaGeoTotal)}</div>
              </div>
            </div>

            {(inconsistencias.semCorrespondenciaGeo || []).length > 0 && (
              <div className="mt-4 overflow-auto rounded-lg border border-orange-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-orange-50 text-orange-800">
                    <tr>
                      <th className="text-left px-4 py-2">Municipio informado</th>
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
                Nenhuma divergencia de municipio detectada entre base e GeoJSON.
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg border border-teal-100 p-4 lg:p-5">
          <h2 className="text-lg font-bold text-teal-800 flex items-center gap-2">
            <FontAwesomeIcon icon={faChartBar} />
            Conferencia rapida
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
              <div className="text-xs text-gray-600">Municipio lider</div>
              <div className="text-xl font-bold text-slate-700">{ranking[0]?.municipio || '-'}</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Os valores acima ajudam a validar se os numeros do mapa e da lista estao consistentes entre si.
          </p>
        </div>
      </div>
    </Layout>
  );
}
