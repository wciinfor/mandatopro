import LiveWidget from '../LiveWidget';
import { useLiveSnapshot } from '@/hooks/useLiveSnapshot';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers, 
  faUserPlus, 
  faCalendarDay, 
  faCalendarWeek, 
  faCalendarAlt,
  faArrowUp,
  faArrowDown,
  faMapMarkerAlt,
  faUserTie
} from '@fortawesome/free-solid-svg-icons';

export default function EleitoresWidget() {
  const { snapshot, loading, error, refetch } = useLiveSnapshot({ pollingIntervalMs: 10000 });
  const metricas = snapshot?.cadastros;
  const timeline = snapshot?.activity?.feedExecutivo || snapshot?.feedExecutivo;
  const empty = !metricas;
  const ultimaAtualizacao = snapshot?.metadata?.ultimaAtualizacao;

  const formatarHoraRelativa = (isoString) => {
    if (!isoString) return '';
    const dataObj = new Date(isoString);
    return dataObj.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <LiveWidget
      titulo="Cadastros em Tempo Real"
      subtitulo="Acompanhamento dinâmico do crescimento da base"
      icone={faUsers}
      badgeTag="Eleitores"
      corBadge="teal"
      loading={loading}
      error={error}
      empty={empty}
      mensagemEmpty="Nenhum cadastro de eleitor registrado até o momento."
      ultimaAtualizacao={ultimaAtualizacao}
      onRetry={refetch}
    >
      <div className="flex flex-col h-full gap-4">
        
        {/* Bloco 1: Grid de Métricas Principais (Destaque TV) */}
        <div className="grid grid-cols-4 gap-3 flex-shrink-0">
          
          {/* Card Total */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Total Base</span>
              <FontAwesomeIcon icon={faUsers} className="text-teal-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono my-1">
              {metricas?.totalEleitores?.toLocaleString('pt-BR') || 0}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Base eleitoral ativa
            </div>
          </div>

          {/* Card Hoje */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Hoje</span>
              <FontAwesomeIcon icon={faCalendarDay} className="text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-emerald-400 font-mono my-1">
              +{metricas?.cadastrosHoje || 0}
            </div>
            <div className="text-[11px] text-emerald-500/80 font-medium">
              Novos registros hoje
            </div>
          </div>

          {/* Card Semana */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Esta Semana</span>
              <FontAwesomeIcon icon={faCalendarWeek} className="text-blue-400" />
            </div>
            <div className="text-3xl font-black text-blue-400 font-mono my-1">
              +{metricas?.cadastrosSemana || 0}
            </div>
            <div className="text-[11px] text-blue-500/80 font-medium">
              Acumulado semanal
            </div>
          </div>

          {/* Card Mês + Variação */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Neste Mês</span>
              <FontAwesomeIcon icon={faCalendarAlt} className="text-purple-400" />
            </div>
            <div className="flex items-baseline gap-2 my-1">
              <span className="text-3xl font-black text-purple-400 font-mono">
                +{metricas?.cadastrosMes || 0}
              </span>
              {metricas?.variacaoPercentualMes !== undefined && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                  metricas.variacaoPercentualMes >= 0 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'bg-rose-500/20 text-rose-400'
                }`}>
                  <FontAwesomeIcon icon={metricas.variacaoPercentualMes >= 0 ? faArrowUp : faArrowDown} className="text-[10px]" />
                  {Math.abs(metricas.variacaoPercentualMes)}%
                </span>
              )}
            </div>
            <div className="text-[11px] text-purple-400/80 font-medium">
              Comparado ao mês anterior
            </div>
          </div>

        </div>

        {/* Bloco 2: Timeline em Tempo Real dos Últimos Cadastros */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-950/40 border border-slate-800/80 rounded-xl p-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between flex-shrink-0 px-1">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping"></span>
              Feed em Tempo Real (Últimos Cadastros)
            </span>
            <span className="text-slate-500 font-mono text-[11px]">Ordem Decrescente</span>
          </div>

          {/* Feed scrollável com alto contraste para leitura a distância */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {timeline.map((item) => (
              <div 
                key={item.id} 
                className="bg-slate-900/90 border border-slate-800 hover:border-teal-500/40 rounded-lg p-2.5 flex items-center justify-between transition-colors shadow-sm"
              >
                {/* Dados do Eleitor */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-teal-500/20 text-teal-300 font-bold flex items-center justify-center text-sm border border-teal-500/30">
                    {item.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-slate-100 font-bold text-sm leading-snug">
                      {item.nome}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1 text-slate-400">
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-teal-400/80 text-[10px]" />
                        {item.municipio}
                      </span>
                      {item.lideranca && (
                        <span className="flex items-center gap-1 text-teal-300/90 font-medium">
                          <FontAwesomeIcon icon={faUserTie} className="text-teal-400 text-[10px]" />
                          Líder: {item.lideranca}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Hora do Cadastro */}
                <div className="text-right flex-shrink-0">
                  <span className="text-xs font-mono font-bold bg-slate-800 text-teal-300 px-2.5 py-1 rounded-md border border-slate-700">
                    {formatarHoraRelativa(item.dataHora)}
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>
    </LiveWidget>
  );
}
