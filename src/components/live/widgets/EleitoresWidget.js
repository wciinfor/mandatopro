import LiveWidget from '../LiveWidget';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers } from '@fortawesome/free-solid-svg-icons';

export default function EleitoresWidget({ loading, error, empty }) {
  return (
    <LiveWidget
      titulo="Eleitores & Base"
      subtitulo="Distribuição e engajamento da base"
      icone={faUsers}
      badgeTag="Eleitorado"
      corBadge="teal"
      loading={loading}
      error={error}
      empty={empty}
    >
      <div className="flex flex-col items-center justify-center h-full border border-dashed border-slate-800 rounded-xl bg-slate-950/40 p-4">
        <FontAwesomeIcon icon={faUsers} className="text-teal-500/40 text-4xl mb-2" />
        <p className="text-slate-400 text-sm font-semibold">Container Eleitores</p>
        <p className="text-slate-600 text-xs mt-1">Pronto para canal de dados independente</p>
      </div>
    </LiveWidget>
  );
}
