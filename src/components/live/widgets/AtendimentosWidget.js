import LiveWidget from '../LiveWidget';
import { faHandsHelping } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function AtendimentosWidget({ loading, error, empty }) {
  return (
    <LiveWidget
      titulo="Atendimentos & Demandas"
      subtitulo="Solicitações e status de resposta"
      icone={faHandsHelping}
      badgeTag="Atendimentos"
      corBadge="blue"
      loading={loading}
      error={error}
      empty={empty}
    >
      <div className="flex flex-col items-center justify-center h-full border border-dashed border-slate-800 rounded-xl bg-slate-950/40 p-4">
        <FontAwesomeIcon icon={faHandsHelping} className="text-blue-500/40 text-4xl mb-2" />
        <p className="text-slate-400 text-sm font-semibold">Container Atendimentos</p>
        <p className="text-slate-600 text-xs mt-1">Pronto para canal de dados independente</p>
      </div>
    </LiveWidget>
  );
}
