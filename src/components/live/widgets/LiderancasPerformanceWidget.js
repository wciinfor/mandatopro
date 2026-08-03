import { useState } from 'react';
import LiveWidget from '../LiveWidget';
import { useLiveLiderancasPerformance } from '@/hooks/useLiveLiderancasPerformance';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUserTie, 
  faTrophy, 
  faExclamationTriangle, 
  faCheckCircle, 
  faTimesCircle, 
  faChartLine,
  faMapMarkerAlt,
  faClock,
  faUserCheck,
  faUserTimes,
  faArrowTrendUp
} from '@fortawesome/free-solid-svg-icons';

export default function LiderancasPerformanceWidget() {
  // Filtro de período preparado para expansão (padrão 'MES')
  const [filtroPeriodo, setFiltroPeriodo] = useState('MES');

  const { 
    metricas, 
    topLiderancas, 
    liderancasEmRisco, 
    loading, 
    error, 
    empty, 
    ultimaAtualizacao, 
    refetch 
  } = useLiveLiderancasPerformance({ filtro: filtroPeriodo, pollingIntervalMs: 12000 });

  const formatarDataAmigavel = (isoString) => {
    if (!isoString) return 'Nunca cadastrou';
    const data = new Date(isoString);
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const renderBadgeTendencia = (tendencia) => {
    switch (tendencia) {
      case 'CRESCENDO':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            🟢 Crescendo
          </span>
        );
      case 'ESTAVEL':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
            🟡 Estável
          </span>
        );
      case 'INATIVA':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">
            🔴 Sem atividade
          </span>
        );
    }
  };

  return (
    <LiveWidget
      titulo="Performance das Lideranças"
      subtitulo="Produtividade, engajamento e acompanhamento de base"
      icone={faUserTie}
      badgeTag="Lideranças"
      corBadge="amber"
      loading={loading}
      error={error}
      empty={empty}
      mensagemEmpty="Nenhuma liderança encontrada no sistema."
      ultimaAtualizacao={ultimaAtualizacao}
      onRetry={refetch}
    >
      <div className="flex flex-col h-full gap-4">
        
        {/* Cabeçalho com Filtros de Período & Indicadores de Resumo */}
        <div className="flex items-center justify-between flex-shrink-0 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          {/* Métricas Rápidas */}
          <div className="flex items-center gap-6">
            <div>
              <span className="text-slate-400 text-[11px] uppercase tracking-wider block">Total</span>
              <span className="text-xl font-black text-white font-mono">{metricas?.totalLiderancas || 0}</span>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <span className="text-emerald-400 text-[11px] uppercase tracking-wider block">Ativas Mês</span>
              <span className="text-xl font-black text-emerald-400 font-mono">{metricas?.liderancasAtivas || 0}</span>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <span className="text-rose-400 text-[11px] uppercase tracking-wider block">Sem Atividade</span>
              <span className="text-xl font-black text-rose-400 font-mono">{metricas?.liderancasInativas || 0}</span>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <span className="text-amber-400 text-[11px] uppercase tracking-wider block">Média / Líder</span>
              <span className="text-xl font-black text-amber-400 font-mono">{metricas?.mediaCadastros || 0}</span>
            </div>
          </div>

          {/* Filtros de Período (Estrutura Preparada) */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg">
            {['HOJE', 'SEMANA', 'MES', 'ANO'].map((f) => (
              <button
                key={f}
                onClick={() => setFiltroPeriodo(f)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                  filtroPeriodo === f 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {f === 'HOJE' ? 'Hoje' : f === 'SEMANA' ? 'Semana' : f === 'MES' ? 'Mês' : 'Ano'}
              </button>
            ))}
          </div>
        </div>

        {/* Área Principal Split: Top 5 (Esquerda) vs Alertas Inatividade (Direita) */}
        <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
          
          {/* Coluna 1: 🏆 Top 5 Lideranças do Mês (7 Colunas) */}
          <div className="col-span-7 bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 flex-shrink-0 px-1">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <FontAwesomeIcon icon={faTrophy} className="text-amber-400 text-sm" />
                🏆 Top 5 Lideranças do Mês
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Maior Produção</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {topLiderancas.map((item, index) => (
                <div 
                  key={item.id} 
                  className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
                    index === 0 
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-100' 
                      : 'bg-slate-900/90 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank / Posição */}
                    <div className={`w-7 h-7 rounded-full font-black text-xs flex items-center justify-center flex-shrink-0 ${
                      index === 0 ? 'bg-amber-400 text-slate-950' : index === 1 ? 'bg-slate-300 text-slate-950' : index === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      #{index + 1}
                    </div>

                    {/* Foto ou Avatar */}
                    {item.foto ? (
                      <img src={item.foto} alt={item.nome} className="w-9 h-9 rounded-full object-cover border border-amber-500/40 flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 text-amber-400 font-bold flex items-center justify-center text-sm flex-shrink-0">
                        {item.nome.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Dados */}
                    <div>
                      <div className="font-bold text-sm text-slate-100 leading-snug flex items-center gap-2">
                        {item.nome}
                        {renderBadgeTendencia(item.tendencia)}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <FontAwesomeIcon icon={faMapMarkerAlt} className="text-slate-500 text-[10px]" />
                          {item.municipio}
                        </span>
                        <span>•</span>
                        <span>Total: <strong className="text-slate-200">{item.totalCadastros}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Números em Destaque */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-black text-amber-400 font-mono">
                      +{item.cadastrosMes} <span className="text-xs text-slate-400 font-normal">mês</span>
                    </div>
                    {item.cadastrosHoje > 0 && (
                      <div className="text-[10px] font-bold text-emerald-400">
                        +{item.cadastrosHoje} hoje
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna 2: ⚠️ Lideranças Sem Atividade / Atenção (5 Colunas) */}
          <div className="col-span-5 bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 flex-shrink-0 px-1">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-rose-400 text-sm" />
                ⚠️ Alerta de Inatividade
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Mais Tempo Sem Cadastrar</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {liderancasEmRisco.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-slate-900/90 border border-slate-800/90 hover:border-rose-500/30 p-2.5 rounded-lg flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold flex items-center justify-center text-xs flex-shrink-0">
                      {item.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-200 truncate max-w-[140px]">
                        {item.nome}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {item.municipio}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-mono font-bold text-rose-400">
                      {formatarDataAmigavel(item.ultimoCadastro)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Último cadastro
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </LiveWidget>
  );
}
