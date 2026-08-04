import LiveWidget from '../LiveWidget';
import { useLiveRadarEstrategico } from '@/hooks/useLiveRadarEstrategico';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSatellite, 
  faExclamationTriangle, 
  faLightbulb, 
  faChartLine,
  faBullseye,
  faCalendarAlt,
  faShieldAlt,
  faChevronRight
} from '@fortawesome/free-solid-svg-icons';

export default function RadarWidget() {
  const { 
    radarData, 
    previsoes, 
    previsaoMaisCritica, 
    distribuicao, 
    indiceTendencia, 
    loading, 
    error, 
    empty, 
    ultimaAtualizacao, 
    refetch 
  } = useLiveRadarEstrategico({ pollingIntervalMs: 15000 });

  const renderBadgePrioridade = (prioridade) => {
    switch (prioridade) {
      case 'ALTO':
        return (
          <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
            🔴 Alto Impacto
          </span>
        );
      case 'MEDIO':
        return (
          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
            🟠 Médio Impacto
          </span>
        );
      case 'BAIXO':
      default:
        return (
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
            🟢 Baixo Impacto
          </span>
        );
    }
  };

  const getTipoBadge = (tipo) => {
    switch (tipo) {
      case 'Risco':
        return <span className="text-rose-400 font-bold flex items-center gap-1"><FontAwesomeIcon icon={faExclamationTriangle} /> Risco</span>;
      case 'Oportunidade':
        return <span className="text-emerald-400 font-bold flex items-center gap-1"><FontAwesomeIcon icon={faLightbulb} /> Oportunidade</span>;
      case 'Tendência':
      default:
        return <span className="text-teal-300 font-bold flex items-center gap-1"><FontAwesomeIcon icon={faChartLine} /> Tendência</span>;
    }
  };

  return (
    <LiveWidget
      titulo="Radar Estratégico & Inteligência Preditiva"
      subtitulo="Modelos estocásticos de antecipação de riscos, oportunidades e tendências"
      icone={faSatellite}
      badgeTag="INSYSTENS Ready"
      corBadge="teal"
      loading={loading}
      error={error}
      empty={empty}
      mensagemEmpty="Nenhuma tendência preditiva crítica identificada para os próximos ciclos."
      ultimaAtualizacao={ultimaAtualizacao}
      onRetry={refetch}
    >
      <div className="flex flex-col h-full gap-3">
        
        {/* Faixa de Topo: Índice Geral de Tendência + Distribuição */}
        <div className="grid grid-cols-12 gap-3 flex-shrink-0">
          
          {/* Índice Geral de Tendência do Mandato */}
          <div className="col-span-5 bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-[11px] uppercase tracking-wider block font-medium">
                Índice Geral de Tendência
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-teal-300 font-mono">{indiceTendencia} pts</span>
                <span className="text-[11px] text-slate-400 font-semibold">Projeção Positiva</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300 font-bold flex items-center justify-center text-lg">
              <FontAwesomeIcon icon={faSatellite} />
            </div>
          </div>

          {/* Distribuição por Tipo (Riscos | Oportunidades | Tendências) */}
          <div className="col-span-7 bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-around">
            <div className="text-center">
              <span className="text-rose-400 text-[10px] uppercase font-bold block">Riscos</span>
              <span className="text-xl font-black text-rose-400 font-mono">{distribuicao.riscos}</span>
            </div>
            <div className="h-7 border-r border-slate-800"></div>
            <div className="text-center">
              <span className="text-emerald-400 text-[10px] uppercase font-bold block">Oportunidades</span>
              <span className="text-xl font-black text-emerald-400 font-mono">{distribuicao.oportunidades}</span>
            </div>
            <div className="h-7 border-r border-slate-800"></div>
            <div className="text-center">
              <span className="text-teal-300 text-[10px] uppercase font-bold block">Tendências</span>
              <span className="text-xl font-black text-teal-300 font-mono">{distribuicao.tendencias}</span>
            </div>
          </div>

        </div>

        {/* Destaque para a Previsão Mais Crítica (Banner de Impacto Máximo) */}
        {previsaoMaisCritica && (
          <div className="bg-slate-950/90 border border-rose-500/40 rounded-xl p-3 flex-shrink-0 shadow-lg shadow-rose-950/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-rose-400 animate-pulse" />
                ⚠️ Alerta Máximo do Radar (Horizonte: {previsaoMaisCritica.horizonte})
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Confiança: {previsaoMaisCritica.scoreConfianca}%
              </span>
            </div>
            <h4 className="text-slate-100 font-bold text-sm">
              {previsaoMaisCritica.titulo}
            </h4>
            <p className="text-slate-300 text-xs mt-0.5">
              {previsaoMaisCritica.descricao}
            </p>
          </div>
        )}

        {/* Top 6 Previsões (Scrollável / Grid Dividida) */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-0">
          {previsoes.map((item) => (
            <div 
              key={item.id}
              className="bg-slate-900/80 border border-slate-800/90 hover:border-teal-500/30 p-3 rounded-xl transition-all"
            >
              <div className="flex items-center justify-between mb-1 text-xs">
                <div className="flex items-center gap-2">
                  {getTipoBadge(item.tipo)}
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400 font-medium">{item.categoria}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-500">
                    Prob: {item.probabilidade}% | {item.horizonte}
                  </span>
                  {renderBadgePrioridade(item.prioridade)}
                </div>
              </div>

              <h4 className="text-slate-100 font-bold text-sm leading-snug">
                {item.titulo}
              </h4>
              <p className="text-slate-300 text-xs mt-0.5">
                {item.descricao}
              </p>

              {/* Ação Recomendada */}
              {item.acaoRecomendada && (
                <div className="mt-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 text-xs text-teal-300 font-medium flex items-center gap-2">
                  <FontAwesomeIcon icon={faBullseye} className="text-teal-400 text-xs flex-shrink-0" />
                  <span>Ação Recomendada: {item.acaoRecomendada}</span>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </LiveWidget>
  );
}
