import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers, faUserTie, faBullhorn, faClipboardList, faCalendarAlt,
  faBirthdayCake, faExclamationTriangle, faExpand, faCompress, faSyncAlt,
  faClock, faMapMarkerAlt, faTv, faCheckCircle, faMoon, faSun
} from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function TvDashboard() {
  const router = useRouter();
  const token = (router.query.token || router.query.tv_token || 'gabinete').toString();

  const [stats, setStats] = useState({
    totalEleitores: 0,
    totalLiderancas: 0,
    campanhasAtivas: 0,
    totalAtendimentos: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const [charts, setCharts] = useState({
    eleitoresSeries: [],
    campanhasSeries: []
  });
  const [chartsLoading, setChartsLoading] = useState(true);

  const [agendaEventos, setAgendaEventos] = useState([]);
  const [agendaLoading, setAgendaLoading] = useState(true);

  const [solicitacoes, setSolicitacoes] = useState([]);
  const [solicitacoesLoading, setSolicitacoesLoading] = useState(true);

  const [aniversariantes, setAniversariantes] = useState([]);
  const [aniversariantesLoading, setAniversariantesLoading] = useState(true);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshCountdown, setRefreshCountdown] = useState(180); // 3 minutos
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Relógio digital em tempo real
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Contador para auto-refresh automático de 3 minutos
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          carregarTodosOsDados();
          return 180;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [token]);

  const carregarTodosOsDados = async () => {
    const tokenParam = `token=${encodeURIComponent(token)}`;

    // 1. Carregar Estatísticas Gerais
    try {
      setStatsLoading(true);
      const res = await fetch(`/api/dashboard/stats?${tokenParam}`);
      if (res.ok) {
        const data = await res.json();
        setStats({
          totalEleitores: data.totalEleitores || 0,
          totalLiderancas: data.totalLiderancas || 0,
          campanhasAtivas: data.campanhasAtivas || 0,
          totalAtendimentos: data.totalAtendimentos || 0
        });
      }
    } catch (e) {
      console.error('Erro ao carregar stats no painel TV:', e);
    } finally {
      setStatsLoading(false);
    }

    // 2. Carregar Gráficos
    try {
      setChartsLoading(true);
      const res = await fetch(`/api/dashboard/charts?days=15&${tokenParam}`);
      if (res.ok) {
        const data = await res.json();
        setCharts({
          eleitoresSeries: Array.isArray(data.eleitoresSeries) ? data.eleitoresSeries : [],
          campanhasSeries: Array.isArray(data.campanhasSeries) ? data.campanhasSeries : []
        });
      }
    } catch (e) {
      console.error('Erro ao carregar gráficos no painel TV:', e);
    } finally {
      setChartsLoading(false);
    }

    // 3. Carregar Agenda
    try {
      setAgendaLoading(true);
      const res = await fetch(`/api/dashboard/agenda?userId=1&nivel=ADMIN&limit=5&${tokenParam}`);
      if (res.ok) {
        const body = await res.json();
        setAgendaEventos(Array.isArray(body.data) ? body.data.slice(0, 5) : []);
      }
    } catch (e) {
      console.error('Erro ao carregar agenda no painel TV:', e);
    } finally {
      setAgendaLoading(false);
    }

    // 4. Carregar Solicitações Recentes
    try {
      setSolicitacoesLoading(true);
      const res = await fetch(`/api/solicitacoes?limit=5&${tokenParam}`);
      if (res.ok) {
        const body = await res.json();
        setSolicitacoes(Array.isArray(body.data) ? body.data.slice(0, 5) : []);
      }
    } catch (e) {
      console.error('Erro ao carregar solicitações no painel TV:', e);
    } finally {
      setSolicitacoesLoading(false);
    }

    // 5. Carregar Aniversariantes
    try {
      setAniversariantesLoading(true);
      const res = await fetch(`/api/aniversariantes?limit=5&${tokenParam}`);
      if (res.ok) {
        const body = await res.json();
        setAniversariantes(Array.isArray(body.proximosAniversariantes) ? body.proximosAniversariantes.slice(0, 5) : []);
      }
    } catch (e) {
      console.error('Erro ao carregar aniversariantes no painel TV:', e);
    } finally {
      setAniversariantesLoading(false);
    }

    setLastUpdated(new Date());
    setRefreshCountdown(180);
  };

  useEffect(() => {
    carregarTodosOsDados();
  }, [token]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // CÁLCULOS E FORMATADOR
  const totalEleitoresGrafico = useMemo(() => {
    return charts.eleitoresSeries.reduce((acc, curr) => acc + (curr.value || 0), 0);
  }, [charts.eleitoresSeries]);

  const maxEleitoresVal = useMemo(() => {
    const vals = charts.eleitoresSeries.map(s => s.value || 0);
    return Math.max(...vals, 1);
  }, [charts.eleitoresSeries]);

  const totalCampanhasGrafico = useMemo(() => {
    return charts.campanhasSeries.reduce((acc, curr) => acc + (curr.value || 0), 0);
  }, [charts.campanhasSeries]);

  const maxCampanhasVal = useMemo(() => {
    const vals = charts.campanhasSeries.map(s => s.value || 0);
    return Math.max(...vals, 1);
  }, [charts.campanhasSeries]);

  const formatNumber = (num) => {
    return new Intl.NumberFormat('pt-BR').format(num || 0);
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const themeClasses = isDarkMode
    ? 'bg-slate-950 text-slate-100'
    : 'bg-[#ECFDF5] text-slate-800';

  const cardBgClasses = isDarkMode
    ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-xl'
    : 'bg-white border-slate-100 text-slate-800 shadow-sm';

  return (
    <>
      <Head>
        <title>MandatoPro — Painel do Gabinete (TV)</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className={`min-h-screen p-4 md:p-6 transition-colors duration-300 ${themeClasses}`}>
        {/* BARRA SUPERIOR DO PAINEL TV */}
        <header className={`mb-6 p-4 md:p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 border ${cardBgClasses}`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center text-white text-2xl shadow-md">
              <FontAwesomeIcon icon={faTv} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-teal-700 dark:text-teal-400">
                  PAINEL DO GABINETE PARLAMENTAR
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Ao Vivo
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                MandatoPro v2.0 • Métricas Consolidadas em Tempo Real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-6 flex-wrap">
            {/* RELÓGIO DIGITAL */}
            <div className="text-right">
              <div className="text-2xl md:text-3xl font-mono font-bold tracking-tight text-slate-800 dark:text-slate-100">
                {currentTime.toLocaleTimeString('pt-BR')}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                {currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>

            {/* CONTADOR DE AUTO-REFRESH */}
            <div className="hidden lg:flex flex-col items-end text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5 font-medium">
                <FontAwesomeIcon icon={faSyncAlt} className="animate-spin text-teal-600" style={{ animationDuration: '6s' }} />
                <span>Próxima atualização: <strong className="text-slate-700 dark:text-slate-200">{formatTimer(refreshCountdown)}</strong></span>
              </div>
              <div className="w-32 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-teal-500 h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${((180 - refreshCountdown) / 180) * 100}%` }}
                />
              </div>
            </div>

            {/* BOTÕES DE AÇÃO */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => carregarTodosOsDados()}
                title="Atualizar Agora"
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              >
                <FontAwesomeIcon icon={faSyncAlt} />
              </button>

              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                title="Alternar Tema"
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              >
                <FontAwesomeIcon icon={isDarkMode ? faSun : faMoon} />
              </button>

              <button
                onClick={toggleFullscreen}
                className="px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs md:text-sm flex items-center gap-2 shadow-md transition-all"
              >
                <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
                <span>{isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* LINHA 1: CARDS DE TOTAIS (4 CARDS) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-6">
          {/* Card 1: Eleitores Cadastrados */}
          <div className={`p-5 rounded-2xl border-l-4 border-l-teal-500 border border-slate-100 dark:border-slate-800 ${cardBgClasses}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Eleitores Cadastrados
              </span>
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-300 flex items-center justify-center text-lg">
                <FontAwesomeIcon icon={faUsers} />
              </div>
            </div>
            <div className="text-3xl md:text-4xl font-bold tracking-tight text-teal-700 dark:text-teal-400">
              {statsLoading ? '...' : formatNumber(stats.totalEleitores)}
            </div>
          </div>

          {/* Card 2: Lideranças Cadastradas */}
          <div className={`p-5 rounded-2xl border-l-4 border-l-amber-500 border border-slate-100 dark:border-slate-800 ${cardBgClasses}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Lideranças Cadastradas
              </span>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center text-lg">
                <FontAwesomeIcon icon={faUserTie} />
              </div>
            </div>
            <div className="text-3xl md:text-4xl font-bold tracking-tight text-amber-700 dark:text-amber-400">
              {statsLoading ? '...' : formatNumber(stats.totalLiderancas)}
            </div>
          </div>

          {/* Card 3: Campanhas Ativas */}
          <div className={`p-5 rounded-2xl border-l-4 border-l-emerald-500 border border-slate-100 dark:border-slate-800 ${cardBgClasses}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Campanhas Ativas
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center text-lg">
                <FontAwesomeIcon icon={faBullhorn} />
              </div>
            </div>
            <div className="text-3xl md:text-4xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
              {statsLoading ? '...' : formatNumber(stats.campanhasAtivas)}
            </div>
          </div>

          {/* Card 4: Atendimentos Registrados */}
          <div className={`p-5 rounded-2xl border-l-4 border-l-rose-500 border border-slate-100 dark:border-slate-800 ${cardBgClasses}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Atendimentos Registrados
              </span>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300 flex items-center justify-center text-lg">
                <FontAwesomeIcon icon={faClipboardList} />
              </div>
            </div>
            <div className="text-3xl md:text-4xl font-bold tracking-tight text-rose-700 dark:text-rose-400">
              {statsLoading ? '...' : formatNumber(stats.totalAtendimentos)}
            </div>
          </div>
        </section>

        {/* LINHA 2: GRÁFICOS DO MÊS E ÚLTIMOS 15 DIAS (2 GRÁFICOS IDÊNTICOS À FOTO) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          {/* Gráfico 1: Eleitores Cadastrados Por Dia */}
          <div className={`p-5 md:p-6 rounded-2xl border ${cardBgClasses}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100">
                  Eleitores cadastrados por dia
                </h2>
                <p className="text-xs text-slate-400">Últimos 15 dias</p>
              </div>
              <div className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                Total do Período: <strong>{formatNumber(totalEleitoresGrafico)}</strong>
              </div>
            </div>

            {chartsLoading ? (
              <div className="h-44 flex items-center justify-center text-slate-400 text-sm">Carregando dados...</div>
            ) : (
              <div className="h-44 flex items-end gap-1.5 md:gap-2 pt-6 pb-2">
                {charts.eleitoresSeries.map((item, idx) => {
                  const dayNum = item.label ? item.label.split('-')[2] : '';
                  const pct = Math.max((item.value / maxEleitoresVal) * 100, item.value > 0 ? 8 : 2);
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      {/* Badge do Valor numérico acima da barra */}
                      <span className={`text-[10px] md:text-xs font-bold mb-1 ${item.value > 0 ? 'text-teal-600 dark:text-teal-400 font-extrabold' : 'text-slate-300 dark:text-slate-600'}`}>
                        {item.value}
                      </span>
                      {/* Barra do Gráfico */}
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 ${item.value > 0 ? 'bg-teal-500 hover:bg-teal-600 shadow-sm' : 'bg-slate-100 dark:bg-slate-800'}`}
                        style={{ height: `${pct}%` }}
                      />
                      {/* Dia no Eixo X */}
                      <span className="text-[10px] font-medium text-slate-400 mt-2">
                        {dayNum}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Gráfico 2: Campanhas do Mês */}
          <div className={`p-5 md:p-6 rounded-2xl border ${cardBgClasses}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100">
                  Campanhas do mês
                </h2>
                <p className="text-xs text-slate-400">Registros com data no mês atual</p>
              </div>
              <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                Total: <strong>{totalCampanhasGrafico}</strong>
              </div>
            </div>

            {chartsLoading ? (
              <div className="h-44 flex items-center justify-center text-slate-400 text-sm">Carregando dados...</div>
            ) : (
              <div className="h-44 flex items-end gap-1 md:gap-1.5 pt-6 pb-2">
                {charts.campanhasSeries.map((item, idx) => {
                  const dayNum = item.label ? item.label.split('-')[2] : '';
                  const pct = Math.max((item.value / maxCampanhasVal) * 100, item.value > 0 ? 8 : 2);
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                      <span className={`text-[9px] md:text-[10px] font-bold mb-1 ${item.value > 0 ? 'text-amber-600 dark:text-amber-400 font-extrabold' : 'text-slate-300 dark:text-slate-600'}`}>
                        {item.value}
                      </span>
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 ${item.value > 0 ? 'bg-amber-500 hover:bg-amber-600 shadow-sm' : 'bg-slate-100 dark:bg-slate-800'}`}
                        style={{ height: `${pct}%` }}
                      />
                      <span className="text-[9px] font-medium text-slate-400 mt-2">
                        {dayNum}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* LINHA 3: MÓDULOS OPERACIONAIS (3 SEÇÕES) */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Card 1: Próximos Eventos */}
          <div className={`p-5 rounded-2xl border ${cardBgClasses}`}>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-bold">
                <FontAwesomeIcon icon={faCalendarAlt} />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Próximos Eventos</h3>
              </div>
              <span className="text-xs text-slate-400">Esta semana</span>
            </div>

            {agendaLoading ? (
              <div className="p-6 text-center text-slate-400 text-sm">Carregando eventos...</div>
            ) : agendaEventos.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
                <FontAwesomeIcon icon={faCalendarAlt} className="text-2xl text-slate-300" />
                <span>Nenhum evento agendado nos próximos dias</span>
              </div>
            ) : (
              <div className="space-y-3">
                {agendaEventos.map((ev, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-teal-600 text-white flex flex-col items-center justify-center font-bold shrink-0">
                      <span className="text-[10px] uppercase tracking-wider leading-none">
                        {ev.data_inicio ? new Date(ev.data_inicio).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : 'AGO'}
                      </span>
                      <span className="text-base leading-none">
                        {ev.data_inicio ? new Date(ev.data_inicio).getDate() : '--'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                        {ev.titulo || ev.nome || 'Evento sem título'}
                      </h4>
                      {ev.horaInicio && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                          <FontAwesomeIcon icon={faClock} className="text-teal-600" />
                          <span>{ev.horaInicio}</span>
                        </p>
                      )}
                      {ev.local && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                          <FontAwesomeIcon icon={faMapMarkerAlt} className="text-slate-400" />
                          <span className="truncate">{ev.local}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: Últimas Solicitações */}
          <div className={`p-5 rounded-2xl border ${cardBgClasses}`}>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
                <FontAwesomeIcon icon={faExclamationTriangle} />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Últimas Solicitações</h3>
              </div>
              <span className="text-xs text-slate-400">Gabinete</span>
            </div>

            {solicitacoesLoading ? (
              <div className="p-6 text-center text-slate-400 text-sm">Carregando solicitações...</div>
            ) : solicitacoes.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl text-slate-300" />
                <span>Nenhuma solicitação recente</span>
              </div>
            ) : (
              <div className="space-y-3">
                {solicitacoes.map((sol, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {sol.titulo || sol.assunto || 'Solicitação'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-medium">
                        {sol.status || 'Pendente'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {sol.descricao || sol.eleitor_nome || 'Sem descrição'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 3: Aniversariantes */}
          <div className={`p-5 rounded-2xl border ${cardBgClasses}`}>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
                <FontAwesomeIcon icon={faBirthdayCake} />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Aniversariantes</h3>
              </div>
              <span className="text-xs text-slate-400">Próximos dias</span>
            </div>

            {aniversariantesLoading ? (
              <div className="p-6 text-center text-slate-400 text-sm">Carregando aniversariantes...</div>
            ) : aniversariantes.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
                <FontAwesomeIcon icon={faBirthdayCake} className="text-2xl text-slate-300" />
                <span>Nenhum aniversariante nos próximos dias</span>
              </div>
            ) : (
              <div className="space-y-3">
                {aniversariantes.map((niver, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <h4 className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                        {niver.nome || 'Eleitor'}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate">
                        {niver.bairro || niver.cidade || 'Eleitor cadastrado'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300 shrink-0">
                      🎂 {niver.dataNascimento || niver.data_nascimento || 'Aniversário'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
