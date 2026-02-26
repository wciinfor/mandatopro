import { useState, useEffect } from 'react';
import { useJsApiLoader, GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMapMarkedAlt, faFilter, faPrint, faUsers, faMapMarkerAlt, faSearch, faPhone, faEnvelope
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import supabase from '@/lib/supabaseClient';

const containerStyle = {
  width: '100%',
  height: '600px'
};

const DEFAULT_CENTER = {
  lat: -1.4558,
  lng: -48.4902
};

const MAP_OPTIONS = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
};

const libraries = ['places'];

export default function Geolocalizacao() {
  const { modalState, closeModal, showSuccess, showError } = useModal();
  
  // Carregar Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: 'AIzaSyBc30k7GJW3UvC2RGKx4RY8XyxJDJStcWg',
    libraries: libraries,
    language: 'pt-BR',
    region: 'BR'
  });
  
  const [filtroLideranca, setFiltroLideranca] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroBairro, setFiltroBairro] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('ATIVO');
  const [tipoMarcador, setTipoMarcador] = useState('TODOS');
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [map, setMap] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [autoCarregamento, setAutoCarregamento] = useState(true); // Auto-carregamento ativado
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState(null);

  // Marcadores carregados do Supabase
  const [marcadores, setMarcadores] = useState([]);

  const carregarMarcadores = async () => {
    try {
      const { data, error } = await supabase
        .from('geolocalizacao')
        .select('id, tipo, nome, descricao, cidade, bairro, endereco, latitude, longitude, status, nivel_influencia, eleitor_id, lideranca_id, eleitores(telefone,celular,whatsapp,email), liderancas(telefone,email,influencia)')
        .order('id', { ascending: false });

      if (error) {
        throw error;
      }

      const normalizados = (data || []).map(item => {
        const telefoneEleitor = item.eleitores?.celular || item.eleitores?.telefone || item.eleitores?.whatsapp || null;
        const telefoneLideranca = item.liderancas?.telefone || null;

        return {
          id: item.id,
          tipo: item.tipo,
          nome: item.nome,
          cidade: item.cidade,
          bairro: item.bairro,
          endereco: item.endereco,
          latitude: item.latitude,
          longitude: item.longitude,
          status: item.status || 'ATIVO',
          telefone: telefoneEleitor || telefoneLideranca,
          influencia: item.liderancas?.influencia || item.nivel_influencia || null,
        };
      });

      setMarcadores(normalizados);
    } catch (err) {
      console.error('Erro ao carregar marcadores:', err);
      showError('Erro ao carregar marcadores do mapa.');
    }
  };

  useEffect(() => {
    carregarMarcadores();
  }, []);

  // Auto-carregamento a cada 30 segundos
  useEffect(() => {
    if (!autoCarregamento) return;

    const intervalo = setInterval(() => {
      carregarMarcadores();
    }, 30000); // 30 segundos

    return () => clearInterval(intervalo);
  }, [autoCarregamento]);

  const handleSincronizar = async () => {
    setSincronizando(true);
    try {
      const response = await fetch('/api/geolocalizacao/sincronizar', {
        method: 'POST',
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Erro ao sincronizar');
      }

      const result = await response.json();
      setUltimaSincronizacao(new Date());
      
      let mensagem = 'Sincronização concluída!';
      if (result.added > 0 || result.updated > 0) {
        mensagem = `✅ Sincronização: ${result.added} adicionado(s), ${result.updated} atualizado(s).`;
      } else {
        mensagem = 'ℹ️ Marcadores já estão atualizados.';
      }
      
      showSuccess(mensagem);
      await carregarMarcadores();
    } catch (err) {
      console.error('Erro ao sincronizar marcadores:', err);
      showError('Erro ao sincronizar marcadores do mapa.');
    } finally {
      setSincronizando(false);
    }
  };

  const marcadoresFiltrados = marcadores.filter(m => {
    const matchLideranca = filtroLideranca === '' || m.nome.toLowerCase().includes(filtroLideranca.toLowerCase());
    const matchCidade = filtroCidade === '' || m.cidade === filtroCidade;
    const matchBairro = filtroBairro === '' || m.bairro.toLowerCase().includes(filtroBairro.toLowerCase());
    const matchStatus = m.status === filtroStatus;
    const matchTipo = tipoMarcador === 'TODOS' || m.tipo === tipoMarcador;
    return matchLideranca && matchCidade && matchBairro && matchStatus && matchTipo;
  });

  const totalEleitores = marcadoresFiltrados.filter(m => m.tipo === 'ELEITOR').length;
  const totalLiderancas = marcadoresFiltrados.filter(m => m.tipo === 'LIDERANCA').length;
  const totalAtivos = marcadoresFiltrados.filter(m => m.status === 'ATIVO').length;

  const cidades = [...new Set(marcadores.map(m => m.cidade))].sort();

  const handleImprimirMapa = () => {
    if (!map) {
      showSuccess('Aguarde o carregamento do mapa');
      return;
    }

    // Abrir janela de impressão
    window.print();
  };

  const handleExportarKML = () => {
    if (marcadoresFiltrados.length === 0) {
      showSuccess('Nenhum marcador para exportar!');
      return;
    }

    // Gerar XML KML
    let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>MandatoPro - Geolocalização</name>
    <description>Exportação de Eleitores e Lideranças</description>
    
    <!-- Estilos para Eleitores -->
    <Style id="eleitor">
      <IconStyle>
        <color>ffff0000</color>
        <scale>1.1</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/ms/icons/blue-dot.png</href>
        </Icon>
      </IconStyle>
    </Style>
    
    <!-- Estilos para Lideranças -->
    <Style id="lideranca">
      <IconStyle>
        <color>ff800080</color>
        <scale>1.2</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/ms/icons/purple-dot.png</href>
        </Icon>
      </IconStyle>
    </Style>
    
    <Folder>
      <name>Marcadores</name>
`;

    // Adicionar cada marcador
    marcadoresFiltrados.forEach(marcador => {
      if (marcador.latitude && marcador.longitude) {
        kmlContent += `
      <Placemark>
        <name>${marcador.nome}</name>
        <description><![CDATA[
          <b>Tipo:</b> ${marcador.tipo}<br/>
          <b>Endereço:</b> ${marcador.endereco}<br/>
          <b>Bairro:</b> ${marcador.bairro}<br/>
          <b>Cidade:</b> ${marcador.cidade}<br/>
          <b>Status:</b> ${marcador.status}<br/>
          ${marcador.telefone ? `<b>Telefone:</b> ${marcador.telefone}<br/>` : ''}
          ${marcador.influencia ? `<b>Influência:</b> ${marcador.influencia}<br/>` : ''}
        ]]></description>
        <styleUrl>#${marcador.tipo === 'LIDERANCA' ? 'lideranca' : 'eleitor'}</styleUrl>
        <Point>
          <coordinates>${marcador.longitude},${marcador.latitude},0</coordinates>
        </Point>
      </Placemark>`;
      }
    });

    kmlContent += `
    </Folder>
  </Document>
</kml>`;

    // Criar arquivo para download
    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Nome do arquivo com data/hora
    const dataHora = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    link.download = `mandatopro-geolocalizacao-${dataHora}.kml`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    showSuccess(`Arquivo KML exportado com sucesso! ${marcadoresFiltrados.length} marcador(es)`);
  };

  const onLoad = (map) => {
    setMap(map);
    // Ajustar o zoom para mostrar todos os marcadores
    if (marcadoresFiltrados.length > 0 && window.google && window.google.maps) {
      const bounds = new window.google.maps.LatLngBounds();
      marcadoresFiltrados.forEach(m => {
        if (m.latitude && m.longitude) {
          bounds.extend({ lat: parseFloat(m.latitude), lng: parseFloat(m.longitude) });
        }
      });
      map.fitBounds(bounds);
    }
  };

  const onUnmount = () => {
    setMap(null);
  };

  const handleMarkerClick = (marcador) => {
    setSelectedMarker(marcador);
  };

  const getMarkerIcon = (tipo, status) => {
    if (!isLoaded || !window.google) return null;
    
    // Cores baseadas em TIPO (eleitor vs liderança) + STATUS
    let iconUrl;
    
    if (status === 'INATIVO') {
      // Inativos = Cinza
      iconUrl = 'http://maps.google.com/mapfiles/ms/icons/gray-dot.png';
    } else {
      // Ativos por tipo
      if (tipo === 'LIDERANCA') {
        iconUrl = 'http://maps.google.com/mapfiles/ms/icons/purple-dot.png'; // Liderança Ativa = Roxo
      } else {
        iconUrl = 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'; // Eleitor Ativo = Azul
      }
    }
    
    return {
      url: iconUrl,
      scaledSize: new window.google.maps.Size(40, 40),
      origin: new window.google.maps.Point(0, 0),
      anchor: new window.google.maps.Point(20, 40)
    };
  };

  if (!isLoaded) {
    return (
      <Layout titulo="Área de Geolocalização">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <FontAwesomeIcon icon={faMapMarkedAlt} className="text-6xl text-teal-400 mb-4 animate-pulse" />
              <h4 className="text-xl font-semibold text-gray-700">Carregando Google Maps...</h4>
              <p className="text-gray-500 mt-2">Por favor, aguarde</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout titulo="Área de Geolocalização">
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body * {
            visibility: hidden;
          }
          .print-map, .print-map * {
            visibility: visible;
          }
          .print-map {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
        .print-only {
          display: none;
        }
      `}</style>

      <Modal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        showCancel={modalState.showCancel}
      />

      {/* Cards Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 no-print">
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Quantidade de Eleitores</p>
              <p className="text-2xl font-bold text-blue-600">{totalEleitores}</p>
            </div>
            <FontAwesomeIcon icon={faUsers} className="text-3xl text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Lideranças</p>
              <p className="text-2xl font-bold text-purple-600">{totalLiderancas}</p>
            </div>
            <FontAwesomeIcon icon={faMapMarkerAlt} className="text-3xl text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ativos / Inativos</p>
              <p className="text-2xl font-bold text-green-600">{totalAtivos} / {marcadoresFiltrados.length - totalAtivos}</p>
            </div>
            <FontAwesomeIcon icon={faUsers} className="text-3xl text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-teal-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total no Mapa</p>
              <p className="text-2xl font-bold text-teal-600">{marcadoresFiltrados.length}</p>
            </div>
            <FontAwesomeIcon icon={faMapMarkedAlt} className="text-3xl text-teal-500" />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4 no-print">
        <div className="flex items-center gap-2 mb-4">
          <FontAwesomeIcon icon={faFilter} className="text-teal-600" />
          <h3 className="text-lg font-semibold text-gray-800">Filtro de Busca</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 uppercase">Liderança</label>
            <div className="relative">
              <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-gray-400" />
              <select
                value={filtroLideranca}
                onChange={(e) => setFiltroLideranca(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-gray-50"
              >
                <option value="">- Definir Liderança -</option>
                {marcadores.filter(m => m.tipo === 'LIDERANCA').map(l => (
                  <option key={l.id} value={l.nome}>{l.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 uppercase">Cidade</label>
            <select
              value={filtroCidade}
              onChange={(e) => setFiltroCidade(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-gray-50"
            >
              <option value="">- Definir Cidade -</option>
              {cidades.map(cidade => (
                <option key={cidade} value={cidade}>{cidade}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 uppercase">Bairro</label>
            <input
              type="text"
              value={filtroBairro}
              onChange={(e) => setFiltroBairro(e.target.value)}
              placeholder="- Definir Bairro -"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 uppercase">Status</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-gray-50"
            >
              <option value="ATIVO">ATIVO</option>
              <option value="INATIVO">INATIVO</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 uppercase">Tipo</label>
            <select
              value={tipoMarcador}
              onChange={(e) => setTipoMarcador(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-gray-50"
            >
              <option value="TODOS">Todos</option>
              <option value="ELEITOR">Eleitores</option>
              <option value="LIDERANCA">Lideranças</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-4 flex-wrap items-center">
          <button
            onClick={handleSincronizar}
            disabled={sincronizando}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${sincronizando ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
          >
            <FontAwesomeIcon icon={faUsers} />
            {sincronizando ? 'Sincronizando...' : 'Sincronizar'}
          </button>
          <button
            onClick={handleImprimirMapa}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <FontAwesomeIcon icon={faPrint} />
            Imprimir Mapa
          </button>
          <button
            onClick={handleExportarKML}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FontAwesomeIcon icon={faMapMarkedAlt} />
            Exportar KML
          </button>

          {/* Toggle Auto-Carregamento */}
          <div className="ml-auto flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-lg border border-gray-300">
            <label className="text-sm font-medium text-gray-700">Auto-carregamento (30s)</label>
            <button
              onClick={() => setAutoCarregamento(!autoCarregamento)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoCarregamento ? 'bg-teal-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoCarregamento ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Último carregamento */}
          {ultimaSincronizacao && (
            <div className="text-xs text-gray-500 ml-2">
              Último: {ultimaSincronizacao.toLocaleTimeString('pt-BR')}
            </div>
          )}
        </div>
      </div>

      {/* Mapa */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden print-map">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faMapMarkedAlt} className="text-teal-600 text-xl" />
            <h3 className="text-lg font-semibold text-gray-800">Mapa Geral de Eleitores</h3>
          </div>
          <div className="bg-white px-3 py-2 rounded-lg border border-gray-300">
            <span className="text-sm font-medium text-gray-700">Quantidade de Eleitores: </span>
            <span className="text-lg font-bold text-teal-600">{marcadoresFiltrados.length}</span>
          </div>
        </div>

        {/* Legenda dos Marcadores */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-200 no-print">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-5 rounded-full" style={{ backgroundColor: '#4285F4', clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 50% 85%, 18% 100%, 0% 38%)' }}></div>
              <span className="font-medium text-gray-700">Eleitores</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-5 rounded-full" style={{ backgroundColor: '#9C27B0', clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 50% 85%, 18% 100%, 0% 38%)' }}></div>
              <span className="font-medium text-gray-700">Lideranças</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-5 rounded-full" style={{ backgroundColor: '#9E9E9E', clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 50% 85%, 18% 100%, 0% 38%)' }}></div>
              <span className="font-medium text-gray-700">Inativos</span>
            </div>
          </div>
        </div>

        {/* Container do Mapa - Google Maps Real */}
        <div className="relative" style={{ height: '600px' }}>
          {!isLoaded ? (
            <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center">
              <div className="text-center">
                <FontAwesomeIcon icon={faMapMarkedAlt} className="text-6xl text-teal-400 mb-4 animate-pulse" />
                <h4 className="text-xl font-semibold text-gray-700">Carregando mapa...</h4>
              </div>
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={DEFAULT_CENTER}
              zoom={11}
              onLoad={onLoad}
              onUnmount={onUnmount}
              options={MAP_OPTIONS}
            >
              {marcadoresFiltrados.map((marcador) => {
                if (!marcador.latitude || !marcador.longitude) return null;
                
                return (
                  <Marker
                    key={marcador.id}
                    position={{
                      lat: parseFloat(marcador.latitude),
                      lng: parseFloat(marcador.longitude)
                    }}
                    icon={getMarkerIcon(marcador.tipo, marcador.status)}
                    onClick={() => handleMarkerClick(marcador)}
                    title={marcador.nome}
                  />
                );
              })}

              {selectedMarker && (
                <InfoWindow
                  position={{
                    lat: parseFloat(selectedMarker.latitude),
                    lng: parseFloat(selectedMarker.longitude)
                  }}
                  onCloseClick={() => setSelectedMarker(null)}
                >
                  <div className="p-2 max-w-xs">
                    <h3 className="font-bold text-gray-800 mb-2">
                      {selectedMarker.nome}
                    </h3>
                    <div className="space-y-1 text-sm">
                      <p className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-teal-600" />
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          selectedMarker.tipo === 'LIDERANCA' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {selectedMarker.tipo}
                        </span>
                      </p>
                      <p className="text-gray-600">
                        {selectedMarker.endereco}
                      </p>
                      <p className="text-gray-600">
                        {selectedMarker.bairro}, {selectedMarker.cidade}
                      </p>
                      {selectedMarker.telefone && (
                        <p className="flex items-center gap-2 text-gray-700">
                          <FontAwesomeIcon icon={faPhone} className="text-teal-600" />
                          {selectedMarker.telefone}
                        </p>
                      )}
                      {selectedMarker.influencia && (
                        <p className="text-xs mt-2">
                          <span className="font-semibold">Influência:</span>{' '}
                          <span className={`px-2 py-0.5 rounded ${
                            selectedMarker.influencia === 'ALTA' ? 'bg-red-100 text-red-800' :
                            selectedMarker.influencia === 'MÉDIA' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {selectedMarker.influencia}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          )}
        </div>
      </div>

      {/* Legenda */}
      <div className="bg-white rounded-lg shadow-sm p-4 mt-4 no-print">
        <h4 className="font-semibold text-gray-800 mb-3">Legenda dos Marcadores:</h4>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-gray-700">Eleitores</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
            <span className="text-sm text-gray-700">Lideranças</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
            <span className="text-sm text-gray-700">Inativos</span>
          </div>
        </div>
      </div>
    </Layout>
  );
}
