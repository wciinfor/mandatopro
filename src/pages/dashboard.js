import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
  faExclamationTriangle,
  faBullhorn,
  faCalendarAlt,
  faTrophy,
  faMapMarkerAlt,
  faPaperPlane,
  faServer,
  faClock,
  faCheckCircle,
  faCommentDots
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { MODULES, hasModuleAccess } from '@/utils/permissions';
import { useAuth } from '@/contexts/AuthContext';
import { useRegistrarAcesso } from '@/hooks/useRegistrarAcesso';

export default function Dashboard() {
  const { user } = useAuth();
  const userSnapshot = useMemo(
    () => ({
      id: user?.id ?? null,
      nivel: user?.nivel ?? null,
      payload: user ? JSON.stringify(user) : null
    }),
    [user]
  );
  const [usuario, setUsuario] = useState(null);
  const [stats, setStats] = useState({
    totalEleitores: 0,
    eleitoresAtivos: 0,
    eleitoresInativos: 0,
    totalLiderancas: 0,
    campanhasAtivas: 0,
    totalAtendimentos: 0,
    liderancasAtivas: 0,
    atendimentosConcluidos: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Estados de Comunicação Oficial e Disparos
  const [metricasDisparos, setMetricasDisparos] = useState({
    totalEnviadas: 0,
    mensagensEnviadasHoje: 0,
    entregues: 0,
    lidas: 0,
    falhas: 0,
    aguardandoConfirmacao: 0,
    taxaEntrega: 0,
    taxaEntregaConfirmada: null,
    taxaLeitura: 0,
    porProvedor: {},
    campanhasRecentes: []
  });
  const [disparosLoading, setDisparosLoading] = useState(true);
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
  const [topLideres, setTopLideres] = useState([]);
  const [topLideresLoading, setTopLideresLoading] = useState(true);

  // Carrega usuário do localStorage e busca nome atualizado
  useEffect(() => {
    if (!userSnapshot.nivel || !hasModuleAccess(userSnapshot.nivel, MODULES.DASHBOARD)) return;
    const usuarioData = JSON.parse(localStorage.getItem('usuario') || '{}');
    setUsuario(usuarioData);

    if (usuarioData?.id || usuarioData?.email) {
      fetch('/api/usuarios/me')
        .then(r => r.ok ? r.json() : null)
        .then(body => {
          if (body?.data?.nome) {
            setUsuario(prev => ({ ...prev, nome: body.data.nome }));
          }
        })
        .catch(() => {});
    }
  }, [userSnapshot.nivel]);

  useEffect(() => {
    if (!userSnapshot.nivel || !hasModuleAccess(userSnapshot.nivel, MODULES.DASHBOARD)) {
      setStatsLoading(false);
      return;
    }
    const carregarStats = async () => {
      try {
        setStatsLoading(true);
        const response = await fetch('/api/dashboard/stats');
        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }
        const data = await response.json();
        setStats(prev => ({
          ...prev,
          totalEleitores: data.totalEleitores || 0,
          eleitoresAtivos: data.eleitoresAtivos || 0,
          eleitoresInativos: data.eleitoresInativos || 0,
          totalLiderancas: data.totalLiderancas || 0,
          campanhasAtivas: data.campanhasAtivas || 0,
          totalAtendimentos: data.totalAtendimentos || 0,
          liderancasAtivas: data.liderancasAtivas || 0,
          atendimentosConcluidos: data.atendimentosConcluidos || 0
        }));
      } catch (error) {
        console.error('Erro ao carregar estatisticas do dashboard:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    carregarStats();
  }, [userSnapshot.nivel]);

  // Carrega métricas e últimos disparos da Comunicação Oficial
  useEffect(() => {
    if (!userSnapshot.nivel || !hasModuleAccess(userSnapshot.nivel, MODULES.DASHBOARD)) return;
    let ativo = true;

    const carregarMetricasDisparos = async () => {
      try {
        setDisparosLoading(true);
        const response = await fetch('/api/comunicacao-oficial/dashboard/campanhas');
        if (!response.ok) return;
        const data = await response.json();

        if (ativo) {
          setMetricasDisparos({
            totalEnviadas: data.totalEnviadas || 0,
            mensagensEnviadasHoje: data.mensagensEnviadasHoje || 0,
            entregues: data.entregues || 0,
            lidas: data.lidas || 0,
            falhas: data.falhas || 0,
            aguardandoConfirmacao: data.aguardandoConfirmacao || 0,
            taxaEntrega: data.taxaEntrega || 0,
            taxaEntregaConfirmada: data.taxaEntregaConfirmada !== undefined ? data.taxaEntregaConfirmada : null,
            taxaLeitura: data.taxaLeitura || 0,
            porProvedor: data.porProvedor || {},
            campanhasRecentes: Array.isArray(data.campanhasRecentes) ? data.campanhasRecentes : []
          });
        }
      } catch (error) {
        console.error('Erro ao carregar métricas de disparos:', error);
      } finally {
        if (ativo) setDisparosLoading(false);
      }
    };

    carregarMetricasDisparos();
    return () => { ativo = false; };
  }, [userSnapshot.nivel]);

  useEffect(() => {
    if (!userSnapshot.nivel || !hasModuleAccess(userSnapshot.nivel, MODULES.DASHBOARD)) {
      setChartsLoading(false);
      return;
    }
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
  }, [userSnapshot.nivel]);

  useEffect(() => {
    let ativo = true;
    if (!userSnapshot.nivel || !hasModuleAccess(userSnapshot.nivel, MODULES.DASHBOARD)) {
      setAgendaLoading(false);
      return;
    }
    const carregarAgenda = async () => {
      try {
        setAgendaLoading(true);
        if (!userSnapshot.id || !userSnapshot.nivel) {
          if (ativo) {
            setAgendaEventos([]);
          }
          return;
        }

        const params = new URLSearchParams({
          userId: String(userSnapshot.id),
          nivel: String(userSnapshot.nivel),
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

    if (userSnapshot.id && userSnapshot.nivel) {
      carregarAgenda();
    } else {
      setAgendaEventos([]);
      setAgendaLoading(false);
    }

    return () => {
      ativo = false;
    };
  }, [userSnapshot.id, userSnapshot.nivel]);

  useEffect(() => {
    let ativo = true;
    if (!userSnapshot.nivel || !hasModuleAccess(userSnapshot.nivel, MODULES.DASHBOARD)) {
      setHeatmapPreview(prev => ({ ...prev, loading: false }));
      return;
    }

    const carregarPreviewMapaCalor = async () => {
      try {
        setHeatmapPreview(prev => ({ ...prev, loading: true, error: '' }));
        const response = await fetch('/api/geolocalizacao/eleitores-mapa-calor?limit=5');
        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }
        const data = await response.json();
        if (ativo) {
          setHeatmapPreview({
            loading: false,
            error: '',
            ranking: Array.isArray(data.ranking) ? data.ranking : [],
            totalConsiderados: data.totalConsiderados || 0
          });
        }
      } catch (error) {
        console.error('Erro ao carregar preview do mapa de calor:', error);
        if (ativo) {
          setHeatmapPreview({
            loading: false,
            error: 'Não foi possível carregar o ranking de municípios.',
            ranking: [],
            totalConsiderados: 0
          });
        }
      }
    };

    carregarPreviewMapaCalor();

    return () => {
      ativo = false;
    };
  }, [userSnapshot.nivel]);

  useEffect(() => {
    let ativo = true;
    if (!userSnapshot.nivel || !hasModuleAccess(userSnapshot.nivel, MODULES.DASHBOARD)) {
      setTopLideresLoading(false);
      return;
    }
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
  }, [userSnapshot.nivel]);

  // Gráfico de Linha em SVG para "Eleitores cadastrados por dia"
  const LineChart = ({
    series = [],
    width = 700,
    height = 140,
    paddingLeft = 40,
    paddingRight = 16,
    paddingTop = 15,
    paddingBottom = 26
  }) => {
    if (!series || series.length === 0) {
      return (
        <div className="h-[140px] flex items-center justify-center text-xs text-[#536987]">
          Nenhum dado registrado nos últimos 15 dias.
        </div>
      );
    }

    const values = series.map((s) => Number(s.value || 0));
    const rawMax = Math.max(...values, 0);
    const max = rawMax === 0 ? 10 : Math.ceil(rawMax * 1.15);
    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;
    const n = values.length;

    const points = values.map((val, idx) => {
      const x = n > 1 ? paddingLeft + (idx / (n - 1)) * chartW : paddingLeft + chartW / 2;
      const y = height - paddingBottom - (val / max) * chartH;
      return { x, y, val, label: series[idx].label };
    });

    const pathD = points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    const areaD = points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`
      : '';

    // Linhas de grid horizontal de referência
    const gridY = [0, 0.33, 0.66, 1].map(pct => ({
      y: height - paddingBottom - pct * chartH,
      val: Math.round(pct * max)
    }));

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[140px] overflow-visible"
        role="img"
        aria-label="Gráfico de linha de eleitores cadastrados"
      >
        <defs>
          <linearGradient id="blueGradientArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#087CFA" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#13B8EE" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Linhas de Grid Discretas */}
        {gridY.map((g, idx) => (
          <g key={`grid-${idx}`}>
            <line
              x1={paddingLeft}
              y1={g.y}
              x2={width - paddingRight}
              y2={g.y}
              stroke="#E2ECF7"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <text
              x={paddingLeft - 8}
              y={g.y + 3}
              textAnchor="end"
              fontSize="9"
              fill="#94A3B8"
              fontWeight="500"
            >
              {g.val >= 1000 ? `${(g.val / 1000).toFixed(1)}k` : g.val}
            </text>
          </g>
        ))}

        {/* Área preenchida */}
        {areaD && <path d={areaD} fill="url(#blueGradientArea)" />}

        {/* Linha principal */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="#087CFA"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Marcadores circulares com anel branco */}
        {points.map((pt, idx) => (
          <g key={`pt-${idx}`}>
            <circle cx={pt.x} cy={pt.y} r="4" fill="#087CFA" stroke="#FFFFFF" strokeWidth="2" />
          </g>
        ))}

        {/* Labels do eixo X */}
        {points.map((pt, idx) => {
          const raw = String(pt.label || '');
          const parts = raw.split('-');
          const label = parts.length === 3 ? parts[2] : (parts.length === 2 ? parts[1] : raw);
          return (
            <text
              key={`lbl-${idx}`}
              x={pt.x}
              y={height - 6}
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill="#64748B"
            >
              {label}
            </text>
          );
        })}
      </svg>
    );
  };

  // Gráfico de Barras para "Campanhas do mês" em tom Âmbar/Dourado conforme Mockup
  const AmberBarChart = ({
    series = [],
    width = 700,
    height = 140,
    paddingLeft = 32,
    paddingRight = 16,
    paddingTop = 15,
    paddingBottom = 26
  }) => {
    if (!series || series.length === 0) {
      return (
        <div className="h-[140px] flex items-center justify-center text-xs text-[#536987]">
          Nenhuma campanha registrada no mês.
        </div>
      );
    }

    const values = series.map((s) => Number(s.value || 0));
    const rawMax = Math.max(...values, 0);
    const max = rawMax === 0 ? 5 : Math.ceil(rawMax * 1.15);
    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;
    const n = values.length;
    const barGap = 4;
    const barWidth = Math.max((chartW - barGap * (n - 1)) / n, 4);

    const gridY = [0, 0.5, 1].map(pct => ({
      y: height - paddingBottom - pct * chartH,
      val: Math.round(pct * max)
    }));

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[140px] overflow-visible"
        role="img"
        aria-label="Gráfico de barras de campanhas do mês"
      >
        {/* Linhas de Grid */}
        {gridY.map((g, idx) => (
          <g key={`grid-bar-${idx}`}>
            <line
              x1={paddingLeft}
              y1={g.y}
              x2={width - paddingRight}
              y2={g.y}
              stroke="#E2ECF7"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <text
              x={paddingLeft - 6}
              y={g.y + 3}
              textAnchor="end"
              fontSize="9"
              fill="#94A3B8"
              fontWeight="500"
            >
              {g.val}
            </text>
          </g>
        ))}

        {/* Barras Douradas/Âmbar */}
        {values.map((val, idx) => {
          const barHeight = (val / max) * chartH;
          const x = paddingLeft + idx * (barWidth + barGap);
          const y = height - paddingBottom - barHeight;
          const hasValue = val > 0;

          return (
            <g key={`bar-${idx}`}>
              <rect
                x={x}
                y={hasValue ? y : height - paddingBottom - 2}
                width={barWidth}
                height={hasValue ? Math.max(barHeight, 3) : 2}
                rx={hasValue ? 3 : 1}
                fill={hasValue ? '#F59E0B' : '#E2ECF7'}
                className="transition-all hover:opacity-80"
              />
              {hasValue && (
                <text
                  x={x + barWidth / 2}
                  y={Math.max(y - 4, 10)}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="#78350F"
                >
                  {val}
                </text>
              )}
            </g>
          );
        })}

        {/* Labels de dias no rodapé */}
        {series.map((item, idx) => {
          const raw = String(item.label || '');
          const parts = raw.split('-');
          const label = parts.length === 3 ? parts[2] : (parts.length === 2 ? parts[1] : raw);
          const x = paddingLeft + idx * (barWidth + barGap) + barWidth / 2;

          return (
            <text
              key={`bar-lbl-${idx}`}
              x={x}
              y={height - 6}
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill="#64748B"
            >
              {label}
            </text>
          );
        })}
      </svg>
    );
  };

  useRegistrarAcesso(usuario, 'DASHBOARD', 'Dashboard');

  // Mapeamento dos provedores reais para o resumo
  const provedoresResumo = useMemo(() => {
    const p = metricasDisparos.porProvedor || {};
    return [
      { key: 'META', label: 'Meta', total: p.META || 0, color: 'text-[#087CFA] bg-blue-50 border-blue-200' },
      { key: 'WABLAST', label: 'WaBlast', total: p.WABLAST || 0, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
      { key: 'YCLOUD', label: 'YCloud', total: p.YCLOUD || 0, color: 'text-cyan-700 bg-cyan-50 border-cyan-200' }
    ];
  }, [metricasDisparos.porProvedor]);

  // Filtrar eventos baseado no perfil
  const eventosFiltrados = agendaEventos.filter((evento) => {
    if (!user) return false;
    if (user?.nivel === 'ADMINISTRADOR') return true;
    if (evento.tipo === 'LOCAL' && evento.criado_por_id !== user?.id) return false;
    return true;
  });

  return (
    <ProtectedRoute module={MODULES.DASHBOARD}>
      <Layout titulo={`Bem-vindo, ${usuario?.nome || 'Administrador'}!`}>
        <div className="space-y-5 lg:space-y-6">

          {/* =========================================================================
              LINHA 1: 4 CARDS DE KPI (Com a paleta idêntica ao Mockup)
             ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            {/* KPI 1: Eleitores Cadastrados (Azul) */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#CBDCEC] shadow-sm shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-[#536987] tracking-tight block mb-1">
                    Eleitores Cadastrados
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-[#10254B] tracking-tight">
                    {statsLoading ? (
                      <span className="inline-block h-8 w-24 bg-blue-50 rounded-lg animate-pulse" />
                    ) : (
                      Number(stats.totalEleitores || 0).toLocaleString('pt-BR')
                    )}
                  </div>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#087CFA] to-[#0B7FF5] text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
                  <FontAwesomeIcon icon={faUsers} className="text-base" />
                </div>
              </div>

              {/* Detalhe estético elegante na base */}
              <div className="pt-3 mt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-[#536987]">
                <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  Base Ativa
                </span>
                <span>{Number(stats.eleitoresAtivos || stats.totalEleitores || 0).toLocaleString('pt-BR')} ativos</span>
              </div>
            </div>

            {/* KPI 2: Lideranças Cadastradas (Âmbar/Laranja) */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#CBDCEC] shadow-sm shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-[#536987] tracking-tight block mb-1">
                    Lideranças Cadastradas
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-[#10254B] tracking-tight">
                    {statsLoading ? (
                      <span className="inline-block h-8 w-16 bg-amber-50 rounded-lg animate-pulse" />
                    ) : (
                      Number(stats.totalLiderancas || 0).toLocaleString('pt-BR')
                    )}
                  </div>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white flex items-center justify-center shadow-md shadow-amber-500/25 shrink-0">
                  <FontAwesomeIcon icon={faUsers} className="text-base" />
                </div>
              </div>

              <div className="pt-3 mt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-[#536987]">
                <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                  Articulação
                </span>
                <span>{Number(stats.liderancasAtivas || stats.totalLiderancas || 0).toLocaleString('pt-BR')} ativas</span>
              </div>
            </div>

            {/* KPI 3: Campanhas Ativas (Verde Esmeralda) */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#CBDCEC] shadow-sm shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-[#536987] tracking-tight block mb-1">
                    Campanhas Ativas
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-[#10254B] tracking-tight">
                    {statsLoading ? (
                      <span className="inline-block h-8 w-14 bg-emerald-50 rounded-lg animate-pulse" />
                    ) : (
                      stats.campanhasAtivas || 0
                    )}
                  </div>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#10B981] to-[#059669] text-white flex items-center justify-center shadow-md shadow-emerald-500/25 shrink-0">
                  <FontAwesomeIcon icon={faBullhorn} className="text-base" />
                </div>
              </div>

              <div className="pt-3 mt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-[#536987]">
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  Em andamento
                </span>
                <span>Comunicação ativa</span>
              </div>
            </div>

            {/* KPI 4: Atendimentos Registrados (Vermelho/Coral) */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#CBDCEC] shadow-sm shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-[#536987] tracking-tight block mb-1">
                    Atendimentos Registrados
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-[#10254B] tracking-tight">
                    {statsLoading ? (
                      <span className="inline-block h-8 w-20 bg-rose-50 rounded-lg animate-pulse" />
                    ) : (
                      Number(stats.totalAtendimentos || 0).toLocaleString('pt-BR')
                    )}
                  </div>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#EF4444] to-[#DC2626] text-white flex items-center justify-center shadow-md shadow-rose-500/25 shrink-0">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-base" />
                </div>
              </div>

              <div className="pt-3 mt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-[#536987]">
                <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60">
                  Gabinete
                </span>
                <span>{Number(stats.atendimentosConcluidos || 0).toLocaleString('pt-BR')} concluídos</span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              LINHA 2: DOIS GRÁFICOS LADO A LADO (Visual idêntico ao Mockup)
             ========================================================================= */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-5">
            {/* Gráfico 1: Eleitores cadastrados por dia (Linha Azul Elétrica) */}
            <div className="bg-white rounded-2xl p-5 lg:p-6 border border-[#CBDCEC] shadow-sm shadow-xs">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#087CFA] flex items-center justify-center">
                    <FontAwesomeIcon icon={faUsers} className="text-sm" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-[#10254B]">
                      Eleitores cadastrados por dia
                    </h2>
                    <p className="text-[11px] text-[#536987]">Últimos 15 dias</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-[#087CFA] bg-blue-50 px-3 py-1 rounded-full border border-blue-200/60">
                    Total: {Number(stats.totalEleitores || 0).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              {chartsLoading ? (
                <div className="h-[140px] rounded-xl bg-blue-50/50 animate-pulse flex items-center justify-center" />
              ) : (
                <LineChart series={charts.eleitoresSeries} />
              )}
            </div>

            {/* Gráfico 2: Campanhas do mês (Barras Âmbar/Douradas) */}
            <div className="bg-white rounded-2xl p-5 lg:p-6 border border-[#CBDCEC] shadow-sm shadow-xs">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <FontAwesomeIcon icon={faBullhorn} className="text-sm" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-[#10254B]">
                      Campanhas do mês
                    </h2>
                    <p className="text-[11px] text-[#536987]">Registros com data no mês atual</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/60">
                    Total: {charts.campanhasSeries.reduce((acc, item) => acc + (item.value || 0), 0)}
                  </span>
                </div>
              </div>

              {chartsLoading ? (
                <div className="h-[140px] rounded-xl bg-amber-50/50 animate-pulse flex items-center justify-center" />
              ) : (
                <AmberBarChart series={charts.campanhasSeries} />
              )}
            </div>
          </div>

          {/* =========================================================================
              LINHA 3: TRÊS ÁREAS PRINCIPAIS (Próximos Eventos | Últimos Disparos | Resumo)
             ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">

            {/* COLUNA 1: Próximos Eventos */}
            <div className="bg-white rounded-2xl p-5 lg:p-6 border border-[#CBDCEC] shadow-sm shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#087CFA] flex items-center justify-center">
                      <FontAwesomeIcon icon={faCalendarAlt} className="text-xs" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#10254B]">
                        Próximos Eventos
                      </h3>
                      <p className="text-[11px] text-[#536987]">Sua agenda esta semana</p>
                    </div>
                  </div>
                  <button
                    onClick={() => window.location.href = '/agenda'}
                    className="px-3 py-1.5 bg-[#087CFA] hover:bg-[#0B7FF5] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Ver Agenda</span>
                    <span className="text-[10px]">→</span>
                  </button>
                </div>

                <div className="space-y-3 pt-1">
                  {agendaLoading && (
                    <div className="space-y-2.5">
                      {[1, 2, 3].map((item) => (
                        <div key={`agenda-skel-${item}`} className="p-3 bg-slate-50 rounded-xl animate-pulse h-16" />
                      ))}
                    </div>
                  )}

                  {!agendaLoading && eventosFiltrados.slice(0, 3).map((evento) => {
                    const dataEvento = new Date(evento.data + 'T00:00:00');
                    const mes = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'][dataEvento.getMonth()];
                    const dia = dataEvento.getDate();

                    return (
                      <div
                        key={evento.id}
                        onClick={() => window.location.href = `/agenda/${evento.id}`}
                        className="p-3 bg-[#F5FAFF] hover:bg-blue-50/70 border border-[#CBDCEC] shadow-sm rounded-xl transition-all cursor-pointer flex items-center gap-3"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white border border-[#CBDCEC] shadow-sm flex flex-col items-center justify-center shrink-0 shadow-xs">
                          <span className="text-[9px] font-black text-[#087CFA] leading-none uppercase">{mes}</span>
                          <span className="text-base font-black text-[#10254B] leading-none mt-0.5">{dia}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-[#10254B] truncate">{evento.titulo}</h4>
                          <div className="flex items-center gap-2 text-[11px] text-[#536987] mt-0.5">
                            <span className="flex items-center gap-1">
                              <FontAwesomeIcon icon={faClock} className="text-[10px] text-[#087CFA]" />
                              {evento.horaInicio}
                            </span>
                            <span className="truncate">{evento.local}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {!agendaLoading && eventosFiltrados.length === 0 && (
                    <div className="text-center py-9 flex flex-col items-center justify-center">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#087CFA] flex items-center justify-center mb-3">
                        <FontAwesomeIcon icon={faCalendarAlt} className="text-2xl" />
                      </div>
                      <p className="text-xs font-bold text-[#10254B]">Nenhum evento agendado</p>
                      <p className="text-[11px] text-[#536987] mt-0.5 mb-4">Sua programação está livre</p>
                      <button
                        onClick={() => window.location.href = '/agenda/novo'}
                        className="px-4 py-2 bg-[#087CFA] hover:bg-[#0B7FF5] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                      >
                        Criar Evento
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* COLUNA 2: Últimos Disparos */}
            <div className="bg-white rounded-2xl p-5 lg:p-6 border border-[#CBDCEC] shadow-sm shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#087CFA] flex items-center justify-center">
                      <FontAwesomeIcon icon={faPaperPlane} className="text-xs" />
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-[#10254B]">
                      ÚLTIMOS DISPAROS
                    </h3>
                  </div>
                  <button
                    onClick={() => window.location.href = '/comunicacao-oficial/campanhas'}
                    className="text-xs text-[#087CFA] hover:text-blue-700 font-bold transition-colors cursor-pointer"
                  >
                    Ver todos →
                  </button>
                </div>

                <div className="space-y-2.5">
                  {disparosLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-xl animate-pulse h-14" />
                      ))}
                    </div>
                  ) : (metricasDisparos.campanhasRecentes || []).length > 0 ? (
                    (metricasDisparos.campanhasRecentes || []).slice(0, 4).map((c) => {
                      const statusNormalized = String(c.status || '').toLowerCase().trim();
                      let statusBadge = { bg: 'bg-blue-50 text-[#087CFA] border-blue-200', label: 'Na Fila' };

                      if (['concluido', 'concluído', 'concluida', 'concluída', 'enviada', 'finalizada'].includes(statusNormalized)) {
                        statusBadge = { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Concluída' };
                      } else if (['executando', 'processando', 'em_andamento', 'ativa'].includes(statusNormalized)) {
                        statusBadge = { bg: 'bg-blue-50 text-[#087CFA] border-blue-200 animate-pulse', label: 'Executando' };
                      } else if (['agendado', 'agendada'].includes(statusNormalized)) {
                        statusBadge = { bg: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Agendada' };
                      } else if (['falha', 'erro', 'falhou'].includes(statusNormalized)) {
                        statusBadge = { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Falha' };
                      } else if (['pausado', 'pausada'].includes(statusNormalized)) {
                        statusBadge = { bg: 'bg-amber-50 text-amber-800 border-amber-200', label: 'Pausada' };
                      } else if (['rascunho', 'cancelado', 'cancelada'].includes(statusNormalized)) {
                        statusBadge = { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: c.status || 'Rascunho' };
                      }

                      const total = c.totalDestinatarios || 0;
                      const enviadas = c.enviadas || 0;
                      const pct = total > 0 ? Math.min(Math.round((enviadas / total) * 100), 100) : 0;
                      const dataFormatada = c.criadoEm
                        ? new Date(c.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '';

                      return (
                        <div
                          key={c.id}
                          onClick={() => window.location.href = `/comunicacao-oficial/campanhas/${c.id}`}
                          className="p-3 bg-[#F5FAFF] hover:bg-blue-50/70 border border-[#CBDCEC] shadow-sm rounded-xl transition-all cursor-pointer space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-[#10254B] truncate">{c.nome}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.bg} shrink-0`}>
                              {statusBadge.label}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-[#536987]">
                            <span className="truncate">Template: <strong className="text-slate-700 font-semibold">{c.template}</strong></span>
                            <span className="text-[10px] text-slate-400">{dataFormatada}</span>
                          </div>

                          <div className="space-y-1 pt-0.5">
                            <div className="flex items-center justify-between text-[10px] text-[#536987]">
                              <span>Envios: <strong className="text-[#087CFA]">{enviadas}</strong>/{total}</span>
                              <span className="font-bold text-[#10254B]">{pct}%</span>
                            </div>
                            <div className="w-full bg-slate-200/70 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-[#087CFA] h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-[#536987] text-xs">
                      <FontAwesomeIcon icon={faPaperPlane} className="text-2xl mb-2 text-slate-300" />
                      <p>Nenhum disparo realizado recentemente.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* COLUNA 3: Resumo de Disparos */}
            <div className="bg-white rounded-2xl p-5 lg:p-6 border border-[#CBDCEC] shadow-sm shadow-xs flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#087CFA] flex items-center justify-center">
                      <FontAwesomeIcon icon={faWhatsapp} className="text-sm text-emerald-600" />
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-[#10254B]">
                      RESUMO DE DISPAROS
                    </h3>
                  </div>
                  <button
                    onClick={() => window.location.href = '/comunicacao-oficial/dashboard'}
                    className="text-xs text-[#087CFA] hover:text-blue-700 font-bold transition-colors cursor-pointer"
                  >
                    Ver Central →
                  </button>
                </div>

                {disparosLoading ? (
                  <div className="space-y-3">
                    <div className="h-16 bg-slate-50 rounded-xl animate-pulse" />
                    <div className="h-16 bg-slate-50 rounded-xl animate-pulse" />
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {/* Total Enviadas e Hoje */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-3 bg-[#F5FAFF] border border-[#CBDCEC] shadow-sm rounded-xl text-center">
                        <span className="text-[10px] font-bold text-[#536987] uppercase tracking-wider block">Total Enviadas</span>
                        <span className="text-xl font-black text-[#10254B]">{metricasDisparos.totalEnviadas}</span>
                      </div>
                      <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Enviadas Hoje</span>
                        <span className="text-xl font-black text-emerald-900">{metricasDisparos.mensagensEnviadasHoje}</span>
                      </div>
                    </div>

                    {/* Taxa de Entrega Confirmada */}
                    <div className="p-3 bg-[#F5FAFF] border border-[#CBDCEC] shadow-sm rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#10254B]">Taxa de Entrega Confirmada</span>
                        <span className="font-black text-emerald-600">
                          {metricasDisparos.taxaEntregaConfirmada !== null && metricasDisparos.taxaEntregaConfirmada !== undefined
                            ? `${metricasDisparos.taxaEntregaConfirmada}%`
                            : (metricasDisparos.taxaEntrega ? `${metricasDisparos.taxaEntrega}%` : '—')}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200/70 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              (metricasDisparos.taxaEntregaConfirmada !== null && metricasDisparos.taxaEntregaConfirmada !== undefined
                                ? metricasDisparos.taxaEntregaConfirmada
                                : metricasDisparos.taxaEntrega) || 0,
                              100
                            )}%`
                          }}
                        />
                      </div>
                      <p className="text-[9px] text-[#536987]">
                        {metricasDisparos.aguardandoConfirmacao > 0
                          ? `${metricasDisparos.aguardandoConfirmacao} envios aguardando recibo do canal`
                          : 'Calculada sobre desfechos confirmados'}
                      </p>
                    </div>

                    {/* Mini Grid: Aguardando / Entregues / Lidas / Falhas */}
                    <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                      <div className="p-2 bg-amber-50 rounded-xl border border-amber-100" title="Aguardando recibo">
                        <span className="text-[9px] text-amber-700 font-bold block truncate">Aguardando</span>
                        <span className="font-black text-amber-900">{metricasDisparos.aguardandoConfirmacao || 0}</span>
                      </div>
                      <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                        <span className="text-[9px] text-emerald-700 font-bold block truncate">Entregues</span>
                        <span className="font-black text-emerald-900">{metricasDisparos.entregues || 0}</span>
                      </div>
                      <div className="p-2 bg-blue-50 rounded-xl border border-blue-100">
                        <span className="text-[9px] text-blue-700 font-bold block truncate">Lidas</span>
                        <span className="font-black text-blue-900">{metricasDisparos.lidas || 0}</span>
                      </div>
                      <div className="p-2 bg-rose-50 rounded-xl border border-rose-100">
                        <span className="text-[9px] text-rose-700 font-bold block truncate">Falhas</span>
                        <span className="font-black text-rose-900">{metricasDisparos.falhas || 0}</span>
                      </div>
                    </div>

                    {/* Provedores Ativos */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold text-[#536987] uppercase tracking-wider block">
                        <FontAwesomeIcon icon={faServer} className="mr-1 text-slate-400" /> Provedores Ativos
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {provedoresResumo.map((p) => (
                          <div key={p.key} className={`p-1.5 rounded-xl border text-center ${p.color}`}>
                            <span className="text-[9px] font-bold uppercase block">{p.label}</span>
                            <span className="text-xs font-black">{p.total}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <button
                  onClick={() => window.location.href = '/comunicacao-oficial/campanhas'}
                  className="w-full py-2.5 bg-gradient-to-r from-[#087CFA] to-[#13B8EE] hover:from-[#0B7FF5] hover:to-[#087CFA] text-white font-bold rounded-xl text-xs transition shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FontAwesomeIcon icon={faPaperPlane} className="text-xs" />
                  <span>Iniciar Novo Disparo</span>
                </button>
              </div>
            </div>

          </div>

          {/* =========================================================================
              LINHA 4: COMPONENTES INFERIORES (Top 10 Líderes | Mapa de Calor | Métricas)
             ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">

            {/* Top 10 Líderes */}
            <div className="bg-white rounded-2xl p-5 lg:p-6 border border-[#CBDCEC] shadow-sm shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#087CFA] flex items-center justify-center">
                    <FontAwesomeIcon icon={faTrophy} className="text-xs" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-[#10254B]">
                    Top 10 Líderes
                  </h3>
                </div>
                <button
                  onClick={() => window.location.href = '/cadastros/liderancas'}
                  className="text-xs text-[#087CFA] hover:text-blue-700 font-bold transition-colors cursor-pointer"
                >
                  Abrir lista completa →
                </button>
              </div>

              <div className="space-y-2">
                {topLideresLoading && (
                  <div className="space-y-2">
                    {[1, 2, 3].map((item) => (
                      <div key={`top-lideres-skel-${item}`} className="bg-slate-50 rounded-xl p-3 animate-pulse h-12" />
                    ))}
                  </div>
                )}

                {!topLideresLoading && topLideres.length === 0 && (
                  <div className="text-center py-6 text-[#536987] text-xs">
                    <FontAwesomeIcon icon={faTrophy} className="text-2xl mb-2 text-slate-300" />
                    <p>Nenhum líder cadastrado</p>
                  </div>
                )}

                {!topLideresLoading && topLideres.length > 0 && topLideres.slice(0, 5).map((lider, index) => (
                  <div
                    key={lider.id}
                    className="p-3 bg-[#F5FAFF] hover:bg-blue-50/70 border border-[#CBDCEC] shadow-sm rounded-xl transition-all cursor-pointer"
                    onClick={() => window.location.href = `/cadastros/liderancas/${lider.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center min-w-max w-7 h-7 rounded-xl bg-[#087CFA] text-white font-bold text-xs shadow-xs">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[#10254B] text-xs truncate">{lider.nome}</div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="text-[11px] text-[#536987]">
                            📊 <span className="font-bold text-slate-700">{lider.projecaoVotos || 0}</span> votos
                          </span>
                          <span className="text-[11px] text-[#536987]">
                            📋 <span className="font-bold text-slate-700">{lider.cadastros || 0}</span> cadastros
                          </span>
                          <span className="text-[11px] text-[#536987]">
                            📈 <span className="font-bold text-[#087CFA]">{lider.percentual || 0}%</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mapa de Calor de Eleitores */}
            <div className="bg-white rounded-2xl p-5 lg:p-6 border border-[#CBDCEC] shadow-sm shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#087CFA] flex items-center justify-center">
                    <FontAwesomeIcon icon={faMapMarkerAlt} className="text-xs" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-[#10254B]">
                    Mapa de Calor (PA)
                  </h3>
                </div>
                <button
                  onClick={() => window.location.href = '/geolocalizacao/mapa-calor'}
                  className="text-xs text-[#087CFA] hover:text-blue-700 font-bold transition-colors cursor-pointer"
                >
                  Abrir mapa completo →
                </button>
              </div>

              <div className="mb-3 p-3 bg-[#F5FAFF] border border-[#CBDCEC] shadow-sm rounded-xl flex items-center justify-between">
                <span className="text-xs font-semibold text-[#536987]">Eleitores na base</span>
                <span className="text-lg font-black text-[#087CFA]">
                  {heatmapPreview.loading ? (
                    <span className="inline-block h-6 w-14 bg-blue-50 rounded animate-pulse" />
                  ) : (
                    Number(heatmapPreview.totalConsiderados || 0).toLocaleString('pt-BR')
                  )}
                </span>
              </div>

              <p className="text-[11px] text-[#536987] mb-3">Prévia de concentração por município</p>

              {heatmapPreview.loading && (
                <div className="space-y-2">
                  {[1, 2, 3].map((item) => (
                    <div key={`heatmap-skel-${item}`} className="h-9 bg-slate-50 rounded-xl animate-pulse" />
                  ))}
                </div>
              )}

              {!heatmapPreview.loading && heatmapPreview.error && (
                <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3">
                  {heatmapPreview.error}
                </div>
              )}

              {!heatmapPreview.loading && !heatmapPreview.error && heatmapPreview.ranking.length > 0 && (
                <div className="space-y-1.5">
                  {heatmapPreview.ranking.map((item) => (
                    <div
                      key={`${item.codigoIbge || item.municipioNormalizado}-${item.posicao}`}
                      className="flex items-center justify-between p-2.5 bg-[#F5FAFF] hover:bg-blue-50/70 border border-[#CBDCEC] shadow-sm rounded-xl transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-[10px] font-bold text-[#536987]">#{item.posicao}</div>
                        <div className="font-bold text-xs text-[#10254B] truncate">{item.municipio}</div>
                      </div>
                      <span className="text-xs font-black text-[#087CFA]">{item.quantidade}</span>
                    </div>
                  ))}
                </div>
              )}

              {!heatmapPreview.loading && !heatmapPreview.error && heatmapPreview.ranking.length === 0 && (
                <div className="text-xs text-[#536987] bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  Sem dados para ranking no momento.
                </div>
              )}
            </div>

            {/* Métricas do Mandato */}
            <div className="bg-white rounded-2xl p-5 lg:p-6 border border-[#CBDCEC] shadow-sm shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#087CFA] flex items-center justify-center">
                    <FontAwesomeIcon icon={faTrophy} className="text-xs" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-[#10254B]">
                    Métricas do Mandato
                  </h3>
                </div>
                <button
                  onClick={() => window.location.href = '/cadastros/atendimentos'}
                  className="text-xs text-[#087CFA] hover:text-blue-700 font-bold transition-colors cursor-pointer"
                >
                  Ver relatório →
                </button>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-3 bg-[#F5FAFF] border border-[#CBDCEC] shadow-sm rounded-xl">
                  <span className="text-xs font-semibold text-[#536987]">Lideranças Ativas</span>
                  <span className="text-base font-black text-[#10254B]">{stats.liderancasAtivas || stats.totalLiderancas || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#F5FAFF] border border-[#CBDCEC] shadow-sm rounded-xl">
                  <span className="text-xs font-semibold text-[#536987]">Regiões alcançadas</span>
                  <span className="text-base font-black text-[#10254B]">{heatmapPreview.ranking.length || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#F5FAFF] border border-[#CBDCEC] shadow-sm rounded-xl">
                  <span className="text-xs font-semibold text-[#536987]">Atendimentos realizados</span>
                  <span className="text-base font-black text-[#10254B]">{stats.atendimentosConcluidos || stats.totalAtendimentos || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#F5FAFF] border border-[#CBDCEC] shadow-sm rounded-xl">
                  <span className="text-xs font-semibold text-[#536987]">Campanhas em curso</span>
                  <span className="text-base font-black text-[#087CFA]">{stats.campanhasAtivas || 0}</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </Layout>
    </ProtectedRoute>
  );
}
