import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUniversity, faUsers, faExclamationTriangle, faBullhorn, faCalendarAlt, faBirthdayCake, faTrophy, faEye, faCheckCircle, faTimesCircle, faClock, faMapMarkerAlt
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useRegistrarAcesso } from '@/hooks/useRegistrarAcesso';

export default function Dashboard() {
  const { user } = useAuth();
  const [usuario, setUsuario] = useState(null);
  const [stats, setStats] = useState({
    totalEleitores: 0,
    eleitoresAtivos: 0,
    eleitoresInativos: 0,
    totalLiderancas: 0,
    campanhasAtivas: 0,
    totalAtendimentos: 0,
    aniversariantesHoje: 0,
    aniversariantesSemana: 0,
    aniversariantesMes: 0,
    proximosAniversariantes: []
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [charts, setCharts] = useState({
    eleitoresSeries: [],
    campanhasSeries: []
  });
  const [chartsLoading, setChartsLoading] = useState(true);
  const [agendaEventos, setAgendaEventos] = useState([]);
  const [agendaLoading, setAgendaLoading] = useState(true);
  const [heatmapPreview, setHeatmapPreview] = useState({
    loading: true,
    error: '',
    ranking: [],
    totalConsiderados: 0
  });
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [solicitacoesLoading, setSolicitacoesLoading] = useState(false);
  const [topLideres, setTopLideres] = useState([]);
  const [topLideresLoading, setTopLideresLoading] = useState(true);
  
  // Carrega usuário do localStorage e busca nome atualizado do Supabase
  useEffect(() => {
    const usuarioData = JSON.parse(localStorage.getItem('usuario') || '{}');
    setUsuario(usuarioData);

    if (usuarioData?.id || usuarioData?.email) {
      fetch('/api/usuarios/me', {
        headers: { usuario: JSON.stringify(usuarioData) }
      })
        .then(r => r.ok ? r.json() : null)
        .then(body => {
          if (body?.data?.nome) {
            setUsuario(prev => ({ ...prev, nome: body.data.nome }));
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const carregarStats = async () => {
      try {
        setStatsLoading(true);
        const response = await fetch('/api/dashboard/stats');
        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }
        const data = await response.json();
        setStats({
          totalEleitores: data.totalEleitores || 0,
          eleitoresAtivos: data.eleitoresAtivos || 0,
          eleitoresInativos: data.eleitoresInativos || 0,
          totalLiderancas: data.totalLiderancas || 0,
          campanhasAtivas: data.campanhasAtivas || 0,
          totalAtendimentos: data.totalAtendimentos || 0,
          aniversariantesHoje: data.aniversariantesHoje || 0,
          aniversariantesSemana: data.aniversariantesSemana || 0,
          aniversariantesMes: data.aniversariantesMes || 0,
          proximosAniversariantes: Array.isArray(data.proximosAniversariantes)
            ? data.proximosAniversariantes
            : []
        });
      } catch (error) {
        console.error('Erro ao carregar estatisticas do dashboard:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    carregarStats();
  }, []);

  useEffect(() => {
    const carregarGraficos = async () => {
      try {
        setChartsLoading(true);
        const response = await fetch('/api/dashboard/charts?days=15');
        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }
        const data = await response.json();
        setCharts({
          eleitoresSeries: Array.isArray(data.eleitoresSeries) ? data.eleitoresSeries : [],
          campanhasSeries: Array.isArray(data.campanhasSeries) ? data.campanhasSeries : []
        });
      } catch (error) {
        console.error('Erro ao carregar graficos do dashboard:', error);
      } finally {
        setChartsLoading(false);
      }
    };

    carregarGraficos();
  }, []);

  useEffect(() => {
    let ativo = true;
    const carregarAgenda = async () => {
      try {
        setAgendaLoading(true);
        if (!user?.id || !user?.nivel) {
          if (ativo) {
            setAgendaEventos([]);
          }
          return;
        }

        const params = new URLSearchParams({
          userId: String(user.id),
          nivel: String(user.nivel),
          limit: '10'
        });

        const response = await fetch(`/api/dashboard/agenda?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Erro ao carregar agenda: ${response.status}`);
        }

        const { data } = await response.json();

        const normalizados = (data || []).map((evento) => ({
          ...evento,
          horaInicio: evento.horaInicio || evento.hora_inicio || '',
          horaFim: evento.horaFim || evento.hora_fim || '',
          confirmados: evento.confirmados ?? 0,
          participantes: evento.participantes ?? 0,
          criado_por_id: evento.criado_por_id ?? null
        }));

        if (ativo) {
          setAgendaEventos(normalizados);
        }
      } catch (error) {
        console.error('Erro ao carregar eventos da agenda:', error);
        if (ativo) {
          setAgendaEventos([]);
        }
      } finally {
        if (ativo) {
          setAgendaLoading(false);
        }
      }
    };

    if (user) {
      carregarAgenda();
    } else {
      setAgendaEventos([]);
      setAgendaLoading(false);
    }

    return () => {
      ativo = false;
    };
  }, [user?.id, user?.nivel]);

  useEffect(() => {
    let ativo = true;

    const carregarPreviewMapaCalor = async () => {
      try {
        setHeatmapPreview((prev) => ({
          ...prev,
          loading: true,
          error: ''
        }));

        const response = await fetch('/api/geolocalizacao/eleitores-mapa-calor?rankingLimit=5');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.detalhes || data?.error || `Erro HTTP: ${response.status}`);
        }

        if (!ativo) {
          return;
        }

        setHeatmapPreview({
          loading: false,
          error: '',
          ranking: Array.isArray(data?.lista?.ranking) ? data.lista.ranking.slice(0, 5) : [],
          totalConsiderados: Number(data?.resumo?.totalEleitoresConsiderados || 0)
        });
      } catch (error) {
        console.error('Erro ao carregar preview do mapa de calor:', error);
        if (!ativo) {
          return;
        }

        setHeatmapPreview({
          loading: false,
          error: error.message || 'Falha ao carregar preview',
          ranking: [],
          totalConsiderados: 0
        });
      }
    };

    carregarPreviewMapaCalor();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    const carregarTopLideres = async () => {
      try {
        setTopLideresLoading(true);
        const response = await fetch('/api/dashboard/top-lideres');
        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }
        const data = await response.json();
        if (ativo) {
          setTopLideres(Array.isArray(data.data) ? data.data : []);
        }
      } catch (error) {
        console.error('Erro ao carregar top líderes:', error);
        if (ativo) {
          setTopLideres([]);
        }
      } finally {
        if (ativo) {
          setTopLideresLoading(false);
        }
      }
    };
    carregarTopLideres();
    return () => { ativo = false; };
  }, []);

  const BarChart = ({
    series,
    fill,
    width = 520,
    height = 120,
    paddingX = 6,
    paddingTop = 6,
    paddingBottom = 18,
    barGap = 4,
    minBarWidth = 4,
    labelInterval = 1
  }) => {
    const values = series.map((item) => item.value || 0);
    const max = Math.max(...values, 1);
    const chartWidth = width - paddingX * 2;
    const chartHeight = height - paddingTop - paddingBottom;
    const barWidth = values.length > 0
      ? Math.max((chartWidth - barGap * (values.length - 1)) / values.length, minBarWidth)
      : 0;

    if (values.length === 0) {
      return (
        <div className="h-[120px] flex items-center justify-center text-sm text-gray-400">
          Sem dados
        </div>
      );
    }

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[120px]"
        role="img"
        aria-label="Grafico"
      >
        {values.map((value, index) => {
          const barHeight = (value / max) * chartHeight;
          const x = paddingX + index * (barWidth + barGap);
          const y = height - paddingBottom - barHeight;
          const isLast = index === values.length - 1;
          return (
            <g key={`bar-${index}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                rx={2}
                fill={isLast ? fill : `${fill}B3`}
              />
              <text
                x={x + barWidth / 2}
                y={Math.max(y - 6, 10)}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="#0f172a"
              >
                {value}
              </text>
            </g>
          );
        })}
        {series.map((item, index) => {
          if (index % labelInterval !== 0) return null;
          const raw = String(item.label || '');
          const parts = raw.split('-');
          const label = parts.length === 3 ? parts[2] : raw;
          const x = paddingX + index * (barWidth + barGap) + barWidth / 2;
          return (
            <text
              key={`label-${index}`}
              x={x}
              y={height - 4}
              textAnchor="middle"
              fontSize="9"
              fill="#94a3b8"
            >
              {label}
            </text>
          );
        })}
      </svg>
    );
  };
  
  // Registra acesso ao dashboard
  useRegistrarAcesso(usuario, 'DASHBOARD', 'Dashboard');

  // Carregar últimas solicitações do Supabase
  useEffect(() => {
    if (!user || user?.nivel === 'OPERADOR') return;
    let ativo = true;
    const carregarSolicitacoes = async () => {
      try {
        setSolicitacoesLoading(true);
        const response = await fetch('/api/solicitacoes?limit=4&offset=0', {
          headers: { usuario: JSON.stringify(user) }
        });
        if (!response.ok) return;
        const data = await response.json();
        if (ativo) setSolicitacoes(Array.isArray(data.data) ? data.data : []);
      } catch (error) {
        console.error('Erro ao carregar solicitações:', error);
      } finally {
        if (ativo) setSolicitacoesLoading(false);
      }
    };
    carregarSolicitacoes();
    return () => { ativo = false; };
  }, [user?.id, user?.nivel]);

  // Filtrar solicitações baseado no perfil
  const solicitacoesFiltradas = solicitacoes;

  const mostrarSolicitacoes = user?.nivel !== 'OPERADOR';
  
  // Filtrar eventos baseado no perfil
  const eventosFiltrados = agendaEventos.filter((evento) => {
    if (!user) return false;
    if (user?.nivel === 'ADMINISTRADOR') return true;
    if (evento.tipo === 'LOCAL' && evento.criado_por_id !== user?.id) return false;
    return true;
  });

  return (
    <Layout titulo={`Bem-vindo, ${usuario?.nome || ''}!`}>
      {/* Grid Principal */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border-b-4 border-teal-400">
          <FontAwesomeIcon icon={faUsers} className="text-2xl lg:text-3xl text-teal-700 mb-2" />
          <div className="text-gray-700 text-sm lg:text-base">Eleitores Cadastrados</div>
          <div className="text-3xl lg:text-4xl font-bold text-teal-800 mt-2">
            {statsLoading ? (
              <span className="inline-block h-8 w-16 lg:h-10 lg:w-20 bg-teal-100 rounded animate-pulse" />
            ) : (
              stats.totalEleitores
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border-b-4 border-yellow-400">
          <FontAwesomeIcon icon={faUsers} className="text-2xl lg:text-3xl text-yellow-700 mb-2" />
          <div className="text-gray-700 text-sm lg:text-base">Lideranças Cadastradas</div>
          <div className="text-3xl lg:text-4xl font-bold text-yellow-800 mt-2">
            {statsLoading ? (
              <span className="inline-block h-8 w-16 lg:h-10 lg:w-20 bg-yellow-100 rounded animate-pulse" />
            ) : (
              stats.totalLiderancas
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border-b-4 border-green-400">
          <FontAwesomeIcon icon={faBullhorn} className="text-2xl lg:text-3xl text-green-700 mb-2" />
          <div className="text-gray-700 text-sm lg:text-base">Campanhas Ativas</div>
          <div className="text-3xl lg:text-4xl font-bold text-green-800 mt-2">
            {statsLoading ? (
              <span className="inline-block h-8 w-16 lg:h-10 lg:w-20 bg-green-100 rounded animate-pulse" />
            ) : (
              stats.campanhasAtivas
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border-b-4 border-red-400">
          <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl lg:text-3xl text-red-700 mb-2" />
          <div className="text-gray-700 text-sm lg:text-base">Atendimentos Registrados</div>
          <div className="text-3xl lg:text-4xl font-bold text-red-800 mt-2">
            {statsLoading ? (
              <span className="inline-block h-8 w-16 lg:h-10 lg:w-20 bg-red-100 rounded animate-pulse" />
            ) : (
              stats.totalAtendimentos
            )}
          </div>
        </div>
      </div>

      {/* Graficos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div className="bg-white rounded-2xl shadow-lg p-5 lg:p-6 border border-teal-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Eleitores cadastrados por dia</h3>
              <p className="text-xs text-gray-500">Ultimos 15 dias</p>
            </div>
            <span className="text-sm font-semibold text-teal-700">
              Total: {charts.eleitoresSeries.reduce((acc, item) => acc + (item.value || 0), 0)}
            </span>
          </div>
          {chartsLoading ? (
            <div className="h-[120px] rounded-lg bg-teal-50 animate-pulse" />
          ) : (
            <>
              <BarChart
                series={charts.eleitoresSeries}
                fill="#14b8a6"
                width={700}
                barGap={8}
                minBarWidth={2}
                labelInterval={1}
              />
            </>
          )}
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-5 lg:p-6 border border-amber-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Campanhas abertas no mes</h3>
              <p className="text-xs text-gray-500">Status: Planejamento e Execucao</p>
            </div>
            <span className="text-sm font-semibold text-amber-700">
              Total: {charts.campanhasSeries.reduce((acc, item) => acc + (item.value || 0), 0)}
            </span>
          </div>
          {chartsLoading ? (
            <div className="h-[120px] rounded-lg bg-amber-50 animate-pulse" />
          ) : (
            <>
              <BarChart
                series={charts.campanhasSeries}
                fill="#f59e0b"
                width={700}
                barGap={4}
                minBarWidth={3}
                labelInterval={1}
              />
            </>
          )}
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6 mt-6 lg:mt-8">
        {/* Próximos Eventos - Design Calendário */}
        <div className="bg-gradient-to-br from-teal-50 via-white to-blue-50 rounded-2xl shadow-xl p-5 lg:p-6 border-2 border-teal-200">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <FontAwesomeIcon icon={faCalendarAlt} className="text-white text-lg" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Próximos Eventos</h3>
                <p className="text-xs text-gray-500">Sua agenda esta semana</p>
              </div>
            </div>
            <button 
              onClick={() => window.location.href = '/agenda'}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
            >
              Ver Agenda
            </button>
          </div>
          
          <div className="space-y-3">
            {agendaLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={`agenda-skeleton-${item}`} className="bg-white rounded-xl shadow-md p-3 border-l-4 border-gray-200">
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-16 bg-gray-100 rounded-lg animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-gray-100 rounded w-24 animate-pulse" />
                        <div className="h-4 bg-gray-100 rounded w-48 animate-pulse" />
                        <div className="h-3 bg-gray-100 rounded w-32 animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!agendaLoading && eventosFiltrados.slice(0, 3).map((evento) => {
              const dataEvento = new Date(evento.data + 'T00:00:00');
              const hoje = new Date();
              hoje.setHours(0, 0, 0, 0);
              const diffTime = dataEvento - hoje;
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const dia = dataEvento.getDate();
              const mes = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'][dataEvento.getMonth()];
              const diaSemana = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][dataEvento.getDay()];
              
              let urgenciaLabel = '';
              let urgenciaColor = '';
              if (diffDays === 0) {
                urgenciaLabel = 'HOJE';
                urgenciaColor = 'bg-red-500 text-white';
              } else if (diffDays === 1) {
                urgenciaLabel = 'AMANHÃ';
                urgenciaColor = 'bg-orange-500 text-white';
              } else if (diffDays <= 3) {
                urgenciaLabel = `${diffDays} DIAS`;
                urgenciaColor = 'bg-yellow-500 text-white';
              } else {
                urgenciaLabel = `${diffDays} DIAS`;
                urgenciaColor = 'bg-gray-400 text-white';
              }
              
              return (
                <div 
                  key={evento.id} 
                  className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer group border-l-4"
                  style={{
                    borderLeftColor: evento.tipo === 'PARLAMENTAR'
                      ? '#3b82f6'
                      : evento.tipo === 'LOCAL'
                        ? '#a855f7'
                        : '#14b8a6'
                  }}
                  onClick={() => window.location.href = `/agenda/${evento.id}`}
                >
                  <div className="p-3">
                    <div className="flex items-start gap-3">
                      {/* Mini Calendário */}
                      <div className="flex-shrink-0">
                        <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden shadow-sm w-14 text-center">
                          <div className="bg-red-600 text-white text-xs font-bold py-1">{mes}</div>
                          <div className="py-2">
                            <div className="text-2xl font-bold text-gray-800 leading-none">{dia}</div>
                            <div className="text-xs text-gray-500 font-semibold mt-1">{diaSemana}</div>
                          </div>
                        </div>
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${urgenciaColor}`}>
                              {urgenciaLabel}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                              evento.tipo === 'PARLAMENTAR' 
                                ? 'bg-blue-100 text-blue-700' 
                                : evento.tipo === 'LOCAL'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-teal-100 text-teal-700'
                            }`}>
                              {evento.tipo === 'PARLAMENTAR'
                                ? '📍 Parlamentar'
                                : evento.tipo === 'LOCAL'
                                  ? '📌 Local'
                                  : '🎯 Evento'}
                            </span>
                          </div>
                        </div>
                        
                        <h4 className="font-bold text-gray-800 text-sm group-hover:text-teal-600 transition-colors mb-2 line-clamp-2">
                          {evento.titulo}
                        </h4>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <FontAwesomeIcon icon={faClock} className="text-teal-600" />
                            <span className="font-semibold">{evento.horaInicio}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <FontAwesomeIcon icon={faMapMarkerAlt} className="text-teal-600" />
                            <span className="truncate">{evento.local}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <FontAwesomeIcon icon={faUsers} className="text-teal-600" />
                            <span><span className="font-bold text-teal-700">{evento.confirmados}</span>/{evento.participantes} confirmados</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {!agendaLoading && eventosFiltrados.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <FontAwesomeIcon icon={faCalendarAlt} className="text-4xl mb-3 opacity-50" />
                <p className="text-sm font-medium">Nenhum evento agendado</p>
                <button
                  onClick={() => window.location.href = '/agenda/novo'}
                  className="mt-3 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Criar Evento
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Últimas Solicitações */}
        {mostrarSolicitacoes && (
          <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border border-teal-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base lg:text-lg font-bold text-teal-700 flex items-center gap-2">
                <FontAwesomeIcon icon={faExclamationTriangle} /> ÚLTIMAS SOLICITAÇÕES
              </h3>
              <button 
                onClick={() => window.location.href = '/solicitacoes'}
                className="text-xs text-teal-600 hover:text-teal-700 font-semibold"
              >
                Ver todas →
              </button>
            </div>
            <div className="space-y-2">
              {solicitacoesFiltradas.slice(0, 4).map((sol) => {
                const statusConfig = {
                  'NOVA': { icon: faClock, color: 'text-blue-600', bg: 'bg-blue-50', badge: 'bg-blue-500', texto: 'Nova' },
                  'EM_ANDAMENTO': { icon: faClock, color: 'text-yellow-600', bg: 'bg-yellow-50', badge: 'bg-yellow-500', texto: 'Em Andamento' },
                  'ATENDIDA': { icon: faCheckCircle, color: 'text-green-600', bg: 'bg-green-50', badge: 'bg-green-500', texto: 'Atendida' },
                  'RECUSADA': { icon: faTimesCircle, color: 'text-red-600', bg: 'bg-red-50', badge: 'bg-red-500', texto: 'Recusada' }
                };
                const config = statusConfig[sol.status] || statusConfig['NOVA'];
                
                return (
                  <div key={sol.id} className={`flex items-center gap-2 text-xs lg:text-sm p-2 ${config.bg} rounded-lg hover:shadow-md transition-shadow cursor-pointer`}
                    onClick={() => window.location.href = `/solicitacoes/${sol.id}`}>
                    <span className={`${config.badge} text-white px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap`}>
                      {config.texto}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 truncate">{sol.titulo}</div>
                      <div className="text-xs text-gray-600">{sol.protocolo} • {sol.solicitante}</div>
                    </div>
                  </div>
                );
              })}
              {solicitacoesFiltradas.length === 0 && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl mb-2 text-gray-300" />
                  <p>Nenhuma solicitação recente</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Aniversariantes */}
        <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border border-teal-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base lg:text-lg font-bold text-teal-700 flex items-center gap-2">
              <FontAwesomeIcon icon={faBirthdayCake} /> ANIVERSARIANTES
            </h3>
            <button 
              onClick={() => window.location.href = '/aniversariantes'}
              className="text-xs text-teal-600 hover:text-teal-700 font-semibold"
            >
              Ver todos →
            </button>
          </div>
          <div className="space-y-3">
            {stats.proximosAniversariantes?.slice(0, 5).map((pessoa) => {
              const hierarquia = String(pessoa.hierarquia || pessoa.tipo || 'ELEITOR').toUpperCase();
              const hoje = new Date();
              const aniversario = new Date(hoje.getFullYear(), pessoa.mes - 1, pessoa.dia);
              if (aniversario < hoje) {
                aniversario.setFullYear(hoje.getFullYear() + 1);
              }
              const diffTime = aniversario - hoje;
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              const isHoje = diffDays === 0;
              const isAmanha = diffDays === 1;
              
              return (
                <div key={`${pessoa.tipo}-${pessoa.id}`} className={`p-2 rounded-lg ${isHoje ? 'bg-pink-50 border-2 border-pink-300' : 'bg-teal-50'}`}>
                  <div className="flex items-center gap-2">
                    {pessoa.foto ? (
                      <img src={pessoa.foto} alt={pessoa.nome} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-xs">
                          {pessoa.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 text-sm truncate">{pessoa.nome}</div>
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="text-gray-600">
                          {pessoa.dia}/{pessoa.mes}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-full font-semibold ${
                          hierarquia === 'LIDERANCA'
                            ? 'bg-purple-100 text-purple-700'
                            : hierarquia === 'FUNCIONARIO'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                        }`}>
                          {hierarquia === 'LIDERANCA' ? 'Liderança' : hierarquia === 'FUNCIONARIO' ? 'Funcionário' : 'Eleitor'}
                        </span>
                        {isHoje && (
                          <span className="bg-pink-500 text-white px-1.5 py-0.5 rounded-full font-semibold text-xs">
                            🎉 HOJE!
                          </span>
                        )}
                        {isAmanha && (
                          <span className="bg-purple-500 text-white px-1.5 py-0.5 rounded-full font-semibold text-xs">
                            Amanhã
                          </span>
                        )}
                        {!isHoje && !isAmanha && (
                          <span className="text-teal-600">
                            {diffDays} {diffDays === 1 ? 'dia' : 'dias'}
                          </span>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => window.location.href = `/comunicacao?userId=${pessoa.id}`}
                      className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg flex items-center gap-1.5 flex-shrink-0 transition-all hover:scale-105 shadow-sm"
                      title="Enviar mensagem no WhatsApp"
                    >
                      <FontAwesomeIcon icon={faWhatsapp} className="text-base" />
                      <span className="text-xs font-semibold">Mensagem</span>
                    </button>
                  </div>
                </div>
              );
            })}
            {(!stats.proximosAniversariantes || stats.proximosAniversariantes.length === 0) && (
              <div className="text-center py-6 text-gray-500 text-sm">
                <FontAwesomeIcon icon={faBirthdayCake} className="text-3xl mb-2 text-gray-300" />
                <p>Nenhum aniversariante nos próximos dias</p>
              </div>
            )}
          </div>
        </div>

        {/* Top 10 Líderes */}
        <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border border-teal-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base lg:text-lg font-bold text-teal-700 flex items-center gap-2">
              <FontAwesomeIcon icon={faTrophy} /> Top 10 Líderes
            </h3>
            <button 
              onClick={() => window.location.href = '/cadastros/liderancas'}
              className="text-xs text-teal-600 hover:text-teal-700 font-semibold"
            >
              Abrir tela completa →
            </button>
          </div>
          <div className="space-y-2">
            {topLideresLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map((item) => (
                  <div key={`top-lideres-skeleton-${item}`} className="bg-teal-50 rounded-lg p-3 animate-pulse">
                    <div className="h-4 bg-teal-100 rounded w-24 mb-2" />
                    <div className="h-3 bg-teal-100 rounded" />
                  </div>
                ))}
              </div>
            )}

            {!topLideresLoading && topLideres.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm">
                <FontAwesomeIcon icon={faTrophy} className="text-2xl mb-2 text-gray-300" />
                <p>Nenhum líder cadastrado</p>
              </div>
            )}

            {!topLideresLoading && topLideres.length > 0 && topLideres.slice(0, 5).map((lider, index) => (
              <div 
                key={lider.id} 
                className="p-3 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer"
                onClick={() => window.location.href = `/cadastros/liderancas/${lider.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center min-w-max w-8 h-8 rounded-full bg-teal-600 text-white font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800 text-sm truncate">{lider.nome}</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="text-xs text-gray-600">
                        📊 <span className="font-semibold">{lider.projecaoVotos || 0}</span> votos
                      </span>
                      <span className="text-xs text-gray-600">
                        📋 <span className="font-semibold">{lider.cadastros || 0}</span> cadastros
                      </span>
                      <span className="text-xs text-gray-600">
                        📈 <span className="font-semibold text-teal-700">{lider.percentual || 0}%</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mapa de Calor de Eleitores */}
        <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border border-teal-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base lg:text-lg font-bold text-teal-700 flex items-center gap-2">
              <FontAwesomeIcon icon={faMapMarkerAlt} /> Mapa de Calor (PA)
            </h3>
            <button
              onClick={() => window.location.href = '/geolocalizacao/mapa-calor'}
              className="text-xs text-teal-600 hover:text-teal-700 font-semibold"
            >
              Abrir tela completa →
            </button>
          </div>

          <div className="mb-3 p-3 bg-teal-50 rounded-lg flex items-center justify-between">
            <span className="text-xs lg:text-sm font-semibold text-gray-700">Eleitores considerados</span>
            <span className="text-lg lg:text-xl font-bold text-teal-700">
              {heatmapPreview.loading ? (
                <span className="inline-block h-6 w-14 bg-teal-100 rounded animate-pulse" />
              ) : (
                heatmapPreview.totalConsiderados
              )}
            </span>
          </div>

          {heatmapPreview.loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => (
                <div key={`heatmap-preview-skeleton-${item}`} className="h-10 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          )}

          {!heatmapPreview.loading && heatmapPreview.error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
              {heatmapPreview.error}
            </div>
          )}

          {!heatmapPreview.loading && !heatmapPreview.error && heatmapPreview.ranking.length > 0 && (
            <div className="space-y-2">
              {heatmapPreview.ranking.map((item) => (
                <div key={`${item.codigoIbge || item.municipioNormalizado}-${item.posicao}`} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div className="min-w-0 pr-2">
                    <div className="text-xs text-slate-500">#{item.posicao}</div>
                    <div className="font-semibold text-slate-800 truncate">{item.municipio}</div>
                  </div>
                  <span className="text-sm font-bold text-teal-700">{item.quantidade}</span>
                </div>
              ))}
            </div>
          )}

          {!heatmapPreview.loading && !heatmapPreview.error && heatmapPreview.ranking.length === 0 && (
            <div className="text-sm text-gray-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
              Sem dados para ranking no momento.
            </div>
          )}
        </div>

        {/* Métricas do Mandato */}
        <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border border-teal-100">
          <h3 className="text-base lg:text-lg font-bold text-teal-700 mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faTrophy} /> Métricas do Mandato
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
              <span className="text-xs lg:text-sm font-semibold text-gray-700">Lideranças Ativas</span>
              <span className="text-lg lg:text-xl font-bold text-teal-700">{stats.liderancasAtivas}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
              <span className="text-xs lg:text-sm font-semibold text-gray-700">Regiões alcançadas</span>
              <span className="text-lg lg:text-xl font-bold text-teal-700">0</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
              <span className="text-xs lg:text-sm font-semibold text-gray-700">Atendimentos realizados</span>
              <span className="text-lg lg:text-xl font-bold text-teal-700">{stats.atendimentosConcluidos}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
              <span className="text-xs lg:text-sm font-semibold text-gray-700">Benefícios</span>
              <span className="text-lg lg:text-xl font-bold text-teal-700">0</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
