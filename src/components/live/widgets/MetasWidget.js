import LiveWidget from '../LiveWidget';
import { faChartLine } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function MetasWidget({ loading, error, empty }) {
  return (
    <LiveWidget
      titulo="Desempenho & Metas"
      subtitulo="Acompanhamento semanal de metas do mandato"
      icone={faChartLine}
      badgeTag="Desempenho"
      corBadge="amber"
      loading={loading}
      error={error}
      empty={empty}
    >
      <div className="flex flex-col items-center justify-center h-full border border-dashed border-slate-800 rounded-xl bg-slate-950/50 p-6">
        <FontAwesomeIcon icon={faChartLine} className="text-amber-500/40 text-5xl mb-2" />
        <p className="text-slate-400 text-sm font-semibold">Container Gráficos & Ranking</p>
        <p className="text-slate-600 text-xs mt-1">Pronto para canal de dados independente</p>
      </div>
    </LiveWidget>
  );
}
