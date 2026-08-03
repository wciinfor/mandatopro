import LiveWidget from '../LiveWidget';
import { useLiveStatusGeral } from '@/hooks/useLiveStatusGeral';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faShieldAlt, 
  faCheckCircle, 
  faThumbsUp, 
  faExclamationCircle, 
  faExclamationTriangle,
  faRadiation,
  faChartLine,
  faCheck,
  faTimes
} from '@fortawesome/free-solid-svg-icons';

export default function StatusWidget() {
  const { 
    statusData, 
    loading, 
    error, 
    empty, 
    ultimaAtualizacao, 
    refetch 
  } = useLiveStatusGeral({ pollingIntervalMs: 15000 });

  const renderBadgeNivel = (status, score) => {
    switch (status) {
      case 'EXCELENTE':
        return (
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            🟢 Excelente ({score} pts)
          </span>
        );
      case 'MUITO_BOM':
        return (
          <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-wider">
            🔵 Muito Bom ({score} pts)
          </span>
        );
      case 'ATENCAO':
        return (
          <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-wider">
            🟡 Atenção ({score} pts)
          </span>
        );
      case 'ALERTA':
        return (
          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-wider">
            🟠 Alerta ({score} pts)
          </span>
        );
      case 'CRITICO':
      default:
        return (
          <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-wider">
            🔴 Crítico ({score} pts)
          </span>
        );
    }
  };

  const getCorScoreBar = (score) => {
    if (score >= 90) return 'from-emerald-500 to-teal-400 text-emerald-400';
    if (score >= 75) return 'from-blue-500 to-indigo-400 text-blue-400';
    if (score >= 60) return 'from-yellow-500 to-amber-400 text-yellow-400';
    if (score >= 40) return 'from-amber-600 to-orange-500 text-amber-400';
    return 'from-rose-600 to-red-500 text-rose-400';
  };

  const score = statusData?.score || 0;
  const corScore = getCorScoreBar(score);

  return (
    <LiveWidget
      titulo="Status Geral do Mandato"
      subtitulo="Mission Status: Consolidação dos indicadores estratégicos do gabinete"
      icone={faShieldAlt}
      badgeTag="Mission Status"
      corBadge={statusData?.cor || 'emerald'}
      loading={loading}
      error={error}
      empty={empty}
      mensagemEmpty="Nenhum status operacional consolidado."
      ultimaAtualizacao={ultimaAtualizacao}
      onRetry={refetch}
    >
      <div className="flex flex-col h-full justify-between gap-3">
        
        {/* Bloco 1: Frase Executiva + Score Bar */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-slate-100 font-extrabold text-lg leading-tight flex items-center gap-2">
              "{statusData?.resumoExecutivo}"
            </h3>
            {renderBadgeNivel(statusData?.status, score)}
          </div>

          {/* Barra Visual de Score Estilo Indicador de Missão */}
          <div className="w-full mt-2">
            <div className="flex justify-between items-center text-xs font-mono mb-1 text-slate-400">
              <span>Score de Saúde Operacional</span>
              <span className="font-bold text-base text-white">{score} / 100</span>
            </div>
            <div className="w-full h-3.5 bg-slate-900 rounded-full border border-slate-800 overflow-hidden p-0.5 relative">
              <div 
                className={`h-full rounded-full bg-gradient-to-r ${corScore.split(' ')[0]} ${corScore.split(' ')[1]} transition-all duration-1000 shadow-lg`}
                style={{ width: `${score}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Bloco 2: Fatores Positivos vs Fatores de Atenção */}
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
          
          {/* Fatores Positivos */}
          <div className="bg-slate-950/40 border border-emerald-900/30 rounded-xl p-3 flex flex-col min-h-0">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 flex-shrink-0">
              <FontAwesomeIcon icon={faCheck} className="text-emerald-400" />
              Fatores Positivos & Pontos Fortes
            </span>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar text-xs">
              {statusData?.fatoresPositivos?.map((fp, i) => (
                <div key={i} className="bg-emerald-950/20 border border-emerald-800/30 p-2 rounded-lg text-emerald-200 font-medium flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>{fp}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fatores de Atenção / Negativos */}
          <div className="bg-slate-950/40 border border-amber-900/30 rounded-xl p-3 flex flex-col min-h-0">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 flex-shrink-0">
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-400" />
              Pontos de Atenção & Riscos
            </span>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar text-xs">
              {statusData?.fatoresNegativos?.length > 0 ? (
                statusData.fatoresNegativos.map((fn, i) => (
                  <div key={i} className="bg-amber-950/20 border border-amber-800/30 p-2 rounded-lg text-amber-200 font-medium flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{fn}</span>
                  </div>
                ))
              ) : (
                <div className="p-2 text-slate-500 italic text-[11px]">
                  Nenhum fator negativo de risco detectado no momento.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </LiveWidget>
  );
}
