import LiveWidget from '../LiveWidget';
import { faBullhorn } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function CampanhasWidget({ loading, error, empty }) {
  return (
    <LiveWidget
      titulo="Campanhas Ativas"
      subtitulo="Ações de rua e mobilizações"
      icone={faBullhorn}
      badgeTag="Campanhas"
      corBadge="purple"
      loading={loading}
      error={error}
      empty={empty}
    >
      <div className="flex flex-col items-center justify-center h-full border border-dashed border-slate-800 rounded-xl bg-slate-950/40 p-4">
        <FontAwesomeIcon icon={faBullhorn} className="text-purple-500/40 text-4xl mb-2" />
        <p className="text-slate-400 text-sm font-semibold">Container Campanhas</p>
        <p className="text-slate-600 text-xs mt-1">Pronto para canal de dados independente</p>
      </div>
    </LiveWidget>
  );
}
