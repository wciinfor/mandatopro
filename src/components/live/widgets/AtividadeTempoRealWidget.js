import LiveWidget from '../LiveWidget';
import { useLiveSnapshot } from '@/hooks/useLiveSnapshot';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBroadcastTower, 
  faUserPlus, 
  faUserTie, 
  faHandsHelping, 
  faCheckCircle, 
  faClock,
  faMapMarkerAlt
} from '@fortawesome/free-solid-svg-icons';

export default function AtividadeTempoRealWidget() {
  const { snapshot, loading, error, refetch } = useLiveSnapshot({ pollingIntervalMs: 10000 });
  const eventos = snapshot?.activity?.feedExecutivo || snapshot?.feedExecutivo || [];
  const empty = eventos.length === 0;
  const ultimaAtualizacao = snapshot?.metadata?.ultimaAtualizacao;

  // Feed Executivo: exibir rigorosamente os últimos 5 a 6 acontecimentos mais relevantes (Sem scroll, sem abas, sem filtros)
  const ultimosEventos = eventos.slice(0, 5);

  const getHora = (isoString) => {
    if (!isoString) return 'agora';
    const data = new Date(isoString);
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <LiveWidget
      titulo="Atividade do Gabinete"
      icone={faBroadcastTower}
      badgeTag="Ao Vivo"
      corBadge="emerald"
      loading={loading}
      error={error}
      empty={empty}
      mensagemEmpty="Nenhuma atividade recente registrada."
      ultimaAtualizacao={ultimaAtualizacao}
      onRetry={refetch}
    >
      <div className="flex flex-col h-full justify-between gap-1.5 overflow-hidden">
        {ultimosEventos.map((item) => (
          <div 
            key={item.id}
            className="bg-slate-950/70 border border-slate-800/80 p-2 rounded-lg flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded flex-shrink-0">
                {getHora(item.dataHora)}
              </span>
              <div>
                <h4 className="text-slate-100 font-bold text-xs truncate max-w-[180px]">
                  {item.descricao}
                </h4>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <FontAwesomeIcon icon={faMapMarkerAlt} className="text-slate-600 text-[9px]" />
                  {item.municipio}
                </span>
              </div>
            </div>

            {item.lideranca && (
              <span className="text-[10px] text-amber-400 font-medium truncate max-w-[100px] flex-shrink-0">
                {item.lideranca}
              </span>
            )}
          </div>
        ))}
      </div>
    </LiveWidget>
  );
}
