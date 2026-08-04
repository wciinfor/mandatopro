import LiveWidget from '../LiveWidget';
import { useLiveStatusGeral } from '@/hooks/useLiveStatusGeral';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldAlt } from '@fortawesome/free-solid-svg-icons';

/**
 * StatusCompactoWidget
 * Versão ultra compacta do Status Geral para a View 02 (Sala de Situação).
 * Exibe apenas Score, Classificação e Principal Resumo Executivo em uma única linha horizontal.
 */
export default function StatusCompactoWidget() {
  const { statusData, loading, error, empty, ultimaAtualizacao, refetch } = useLiveStatusGeral({ pollingIntervalMs: 15000 });

  const getCorScore = (score = 0) => {
    if (score >= 90) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 75) return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
    if (score >= 60) return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
    if (score >= 40) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  const score = statusData?.score || 0;
  const corClass = getCorScore(score);

  return (
    <LiveWidget
      titulo="Resumo Executivo do Mandato"
      icone={faShieldAlt}
      badgeTag="Estratégico"
      corBadge="purple"
      loading={loading}
      error={error}
      empty={empty}
      ultimaAtualizacao={ultimaAtualizacao}
      onRetry={refetch}
      densityMode="commandCenter"
    >
      <div className="flex items-center justify-between gap-4 h-full bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-lg border font-mono font-black text-lg flex items-center gap-2 ${corClass}`}>
            <span className="w-2 h-2 rounded-full bg-current animate-ping"></span>
            <span>{score} pts</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
              Classificação: <strong className="text-white">{statusData?.status || 'EM ANALISE'}</strong>
            </span>
            <h4 className="text-slate-100 font-bold text-xs leading-snug">
              "{statusData?.resumoExecutivo}"
            </h4>
          </div>
        </div>

        {/* Alerta de topo */}
        {statusData?.fatoresNegativos?.length > 0 && (
          <div className="bg-rose-950/30 border border-rose-800/40 text-rose-300 text-[11px] px-3 py-1.5 rounded-lg font-medium max-w-sm truncate flex-shrink-0">
            ⚠️ {statusData.fatoresNegativos[0]}
          </div>
        )}
      </div>
    </LiveWidget>
  );
}
