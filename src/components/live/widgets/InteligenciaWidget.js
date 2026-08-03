import LiveWidget from '../LiveWidget';
import { useLiveInteligencia } from '@/hooks/useLiveInteligencia';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBrain, 
  faExclamationTriangle, 
  faLightbulb, 
  faChartLine, 
  faInfoCircle,
  faArrowRight,
  faShieldAlt,
  faBullseye
} from '@fortawesome/free-solid-svg-icons';

export default function InteligenciaWidget() {
  const { 
    insights, 
    loading, 
    error, 
    empty, 
    ultimaAtualizacao, 
    refetch 
  } = useLiveInteligencia({ pollingIntervalMs: 15000 });

  const renderBadgePrioridade = (prioridade) => {
    switch (prioridade) {
      case 'CRITICA':
        return (
          <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>
            🔴 Crítica
          </span>
        );
      case 'ALTA':
        return (
          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
            🟠 Alta
          </span>
        );
      case 'MEDIA':
        return (
          <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
            🟡 Média
          </span>
        );
      case 'INFORMATIVA':
      default:
        return (
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
            🟢 Informativa
          </span>
        );
    }
  };

  const getCorBordaInsight = (prioridade) => {
    switch (prioridade) {
      case 'CRITICA': return 'border-rose-500/40 bg-rose-950/20 hover:border-rose-500/70';
      case 'ALTA': return 'border-amber-500/40 bg-amber-950/20 hover:border-amber-500/70';
      case 'MEDIA': return 'border-yellow-500/30 bg-yellow-950/10 hover:border-yellow-500/50';
      case 'INFORMATIVA': default: return 'border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/50';
    }
  };

  const getIconeCategoria = (tipo) => {
    switch (tipo) {
      case 'ALERTA': return faExclamationTriangle;
      case 'OPORTUNIDADE': return faLightbulb;
      default: return faBrain;
    }
  };

  return (
    <LiveWidget
      titulo="Centro de Inteligência Estratégica"
      subtitulo="Motor de regras de decisão, prioridades e recomendações acionáveis"
      icone={faBrain}
      badgeTag="Motor de Decisão"
      corBadge="purple"
      loading={loading}
      error={error}
      empty={empty}
      mensagemEmpty="Nenhuma recomendação ou insight crítico no momento."
      ultimaAtualizacao={ultimaAtualizacao}
      onRetry={refetch}
    >
      <div className="flex flex-col h-full gap-3">
        
        {/* Banner Superior: Resumo de Alertas */}
        <div className="flex items-center justify-between flex-shrink-0 bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faBrain} className="text-purple-400 text-base" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              {insights.length} Insights Estratégicos Priorizados
            </span>
          </div>
          <span className="text-[11px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2.5 py-0.5 rounded-full font-mono">
            Motor de Regras Ativo
          </span>
        </div>

        {/* Feed de Insights (Scrollável, Máximo 8 Insights) */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar min-h-0">
          {insights.map((item) => {
            const bordaClass = getCorBordaInsight(item.prioridade);
            const iconeTipo = getIconeCategoria(item.tipo);

            return (
              <div 
                key={item.id}
                className={`p-3.5 rounded-xl border transition-all duration-300 shadow-md ${bordaClass}`}
              >
                {/* Header do Insight */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={iconeTipo} className="text-slate-400 text-sm" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      {item.categoria}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-mono">
                      Score: {item.scoreConfianca}%
                    </span>
                    {renderBadgePrioridade(item.prioridade)}
                  </div>
                </div>

                {/* Título & Descrição */}
                <h4 className="text-slate-100 font-bold text-base leading-snug mb-1">
                  {item.titulo}
                </h4>
                <p className="text-slate-300 text-xs leading-relaxed mb-2.5">
                  {item.descricao}
                </p>

                {/* Recomendação de Ação */}
                {item.recomendacao && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 flex items-start gap-2 text-xs">
                    <FontAwesomeIcon icon={faBullseye} className="text-teal-400 text-xs mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-teal-400 font-bold uppercase tracking-wider block text-[10px] mb-0.5">
                        Recomendação de Ação:
                      </span>
                      <span className="text-slate-200 font-medium">
                        {item.recomendacao}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </LiveWidget>
  );
}
