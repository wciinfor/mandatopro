import { useState } from 'react';
import LiveWidget from '../LiveWidget';
import { useLiveAtividadeTempoReal } from '@/hooks/useLiveAtividadeTempoReal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBroadcastTower, 
  faUserPlus, 
  faUserTie, 
  faHandsHelping, 
  faCheckCircle, 
  faCheckDouble,
  faClipboardList,
  faBullhorn,
  faMapMarkerAlt,
  faClock,
  faBolt
} from '@fortawesome/free-solid-svg-icons';

export default function AtividadeTempoRealWidget() {
  // Filtro de categorias preparado para expansão (Mantendo apenas 'TUDO' ativo)
  const [filtroAtivo, setFiltroAtivo] = useState('TUDO');

  const { 
    eventos, 
    loading, 
    error, 
    empty, 
    ultimaAtualizacao, 
    refetch 
  } = useLiveAtividadeTempoReal({ filtroCategoria: filtroAtivo, pollingIntervalMs: 8000 });

  const getIconeComponent = (iconeNome) => {
    switch (iconeNome) {
      case 'faUserPlus': return faUserPlus;
      case 'faUserTie': return faUserTie;
      case 'faCheckCircle': return faCheckCircle;
      case 'faCheckDouble': return faCheckDouble;
      case 'faClipboardList': return faClipboardList;
      case 'faBullhorn': return faBullhorn;
      case 'faHandsHelping': 
      default: 
        return faHandsHelping;
    }
  };

  const getCorClasses = (cor) => {
    switch (cor) {
      case 'teal':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      case 'emerald':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'amber':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'purple':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'sky':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      case 'blue':
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  return (
    <LiveWidget
      titulo="Central de Atividade em Tempo Real"
      subtitulo="Feed operacional ao vivo das movimentações do gabinete"
      icone={faBroadcastTower}
      badgeTag="Centro de Operações"
      corBadge="emerald"
      loading={loading}
      error={error}
      empty={empty}
      mensagemEmpty="Nenhuma atividade operacional registrada recentemente."
      ultimaAtualizacao={ultimaAtualizacao}
      onRetry={refetch}
    >
      <div className="flex flex-col h-full gap-3">
        
        {/* Barra Superior: Filtros Preparados (Apenas 'Tudo' ativo nesta etapa) */}
        <div className="flex items-center justify-between flex-shrink-0 bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Live Stream do Gabinete ({eventos.length} eventos)
            </span>
          </div>

          {/* Abas Preparadas de Filtro */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg">
            {[
              { id: 'TUDO', label: 'Tudo' },
              { id: 'CADASTROS', label: 'Cadastros' },
              { id: 'LIDERANCAS', label: 'Lideranças' },
              { id: 'ATENDIMENTOS', label: 'Atendimentos' },
              { id: 'CAMPANHAS', label: 'Campanhas' },
              { id: 'EVENTOS', label: 'Eventos' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltroAtivo(f.id)}
                disabled={f.id !== 'TUDO'} // Apenas 'Tudo' ativo nesta etapa
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  filtroAtivo === f.id 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm' 
                    : 'text-slate-600 cursor-not-allowed opacity-60'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Linha do Tempo Feed em Tempo Real (Scrollável) */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-0 bg-slate-950/40 border border-slate-800/80 rounded-xl p-3">
          {eventos.map((item) => {
            const iconeComp = getIconeComponent(item.icone);
            const corClass = getCorClasses(item.cor);

            return (
              <div 
                key={item.id}
                className={`p-3 rounded-xl border transition-all duration-300 flex items-center justify-between shadow-md ${
                  item.recente5Min
                    ? 'bg-slate-900/95 border-emerald-500/40 shadow-emerald-950/20'
                    : 'bg-slate-900/70 border-slate-800/90'
                }`}
              >
                {/* Lado Esquerdo: Ícone + Descrição + Local */}
                <div className="flex items-center gap-3.5">
                  {/* Badge de Ícone */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg border flex-shrink-0 ${corClass}`}>
                    <FontAwesomeIcon icon={iconeComp} />
                  </div>

                  {/* Detalhes do Evento */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-slate-100 font-bold text-sm leading-snug">
                        {item.descricao}
                      </h4>
                      {item.recente5Min && (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                          <FontAwesomeIcon icon={faBolt} className="text-emerald-400 text-[9px] animate-pulse" />
                          Novo (Últimos 5 min)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1 text-slate-400 font-medium">
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-slate-500 text-[10px]" />
                        {item.municipio}
                      </span>

                      {item.lideranca && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-amber-300/90 font-medium">
                            <FontAwesomeIcon icon={faUserTie} className="text-amber-400 text-[10px]" />
                            Líder: {item.lideranca}
                          </span>
                        </>
                      )}

                      <span>•</span>
                      <span className="text-slate-500 font-mono">
                        Por {item.usuario}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Tempo Relativo */}
                <div className="text-right flex-shrink-0 pl-4">
                  <div className="text-xs font-mono font-bold bg-slate-950 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-1.5">
                    <FontAwesomeIcon icon={faClock} className="text-slate-500 text-[11px]" />
                    {item.tempoRelativo}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </LiveWidget>
  );
}
