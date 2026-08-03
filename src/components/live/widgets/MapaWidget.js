import LiveWidget from '../LiveWidget';
import { faMapMarkedAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function MapaWidget({ loading, error, empty }) {
  return (
    <LiveWidget
      titulo="Presença Territorial & Mapa"
      subtitulo="Cobertura geográfica e densidade eleitoral"
      icone={faMapMarkedAlt}
      badgeTag="Território"
      corBadge="emerald"
      loading={loading}
      error={error}
      empty={empty}
    >
      <div className="flex flex-col items-center justify-center h-full border border-dashed border-slate-800 rounded-xl bg-slate-950/50 p-6">
        <FontAwesomeIcon icon={faMapMarkedAlt} className="text-emerald-500/40 text-6xl mb-3" />
        <p className="text-slate-300 text-base font-semibold">Container Mapa & Geolocalização</p>
        <p className="text-slate-500 text-xs mt-1">Otimizado para exibição em telas Full HD / 4K (3–5m)</p>
      </div>
    </LiveWidget>
  );
}
