import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSyncAlt, faExclamationTriangle, faInbox } from '@fortawesome/free-solid-svg-icons';

export default function LiveWidget({
  titulo,
  subtitulo,
  icone,
  loading = false,
  error = null,
  empty = false,
  mensagemEmpty = 'Nenhum dado disponível',
  badgeTag,
  corBadge = 'slate',
  ultimaAtualizacao,
  onRetry,
  densityMode = 'commandCenter', // 'comfortable' | 'compact' | 'commandCenter'
  children
}) {
  // Ajustes de padding e margens de acordo com o Layout Density System (Modo Command Center = 90% conteúdo útil)
  const isCommandCenter = densityMode === 'commandCenter';
  const containerPadding = isCommandCenter ? 'p-3.5' : 'p-5';
  const headerMargin = isCommandCenter ? 'mb-1.5' : 'mb-3';
  const iconSize = isCommandCenter ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-base';
  const titleSize = isCommandCenter ? 'text-xs tracking-wider' : 'text-sm tracking-wider';

  return (
    <div className={`w-full h-full bg-slate-900/85 border border-slate-800/90 rounded-xl ${containerPadding} flex flex-col justify-between backdrop-blur shadow-2xl relative overflow-hidden group hover:border-slate-700/80 transition-all duration-300`}>
      
      {/* Cabeçalho Compacto do Widget (-40% altura) */}
      <div className={`flex items-center justify-between flex-shrink-0 ${headerMargin}`}>
        <div className="flex items-center gap-2">
          {icone && (
            <div className={`${iconSize} rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-300 border border-slate-700/50 flex-shrink-0`}>
              <FontAwesomeIcon icon={icone} />
            </div>
          )}
          <div>
            <h3 className={`text-slate-100 font-extrabold ${titleSize} leading-tight uppercase font-sans`}>
              {titulo}
            </h3>
            {/* Omitir subtítulos secundários no modo Command Center se não agregarem valor imediato */}
            {subtitulo && !isCommandCenter && (
              <p className="text-slate-400 text-[11px] font-medium mt-0.5">
                {subtitulo}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {badgeTag && (
            <span className={`bg-slate-950 text-slate-300 border border-slate-800 text-[10px] font-black px-2 py-0.5 rounded-full font-mono uppercase tracking-wider`}>
              {badgeTag}
            </span>
          )}
          {/* Discreto Indicador LIVE em vez de rodapé poluído */}
          <span className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            LIVE
          </span>
        </div>
      </div>

      {/* Área Útil do Conteúdo (Privilegiando 90% da Área do Card) */}
      <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full w-full border border-slate-800/60 rounded-lg bg-slate-950/40 p-2">
            <FontAwesomeIcon icon={faSyncAlt} className="animate-spin text-emerald-400 text-xl mb-2" />
            <span className="text-slate-400 text-xs font-medium">Sincronizando...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full w-full border border-rose-900/40 rounded-lg bg-rose-950/20 p-2 text-center">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-rose-400 text-xl mb-1" />
            <span className="text-rose-300 text-xs font-semibold">Falha na Sincronização</span>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-2 px-2.5 py-1 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 rounded text-[11px] font-medium"
              >
                Reconectar
              </button>
            )}
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center h-full w-full border border-slate-800/60 rounded-lg bg-slate-950/40 p-2 text-center">
            <FontAwesomeIcon icon={faInbox} className="text-slate-600 text-2xl mb-1" />
            <span className="text-slate-400 text-xs font-medium">{mensagemEmpty}</span>
          </div>
        ) : (
          <div className="h-full w-full overflow-hidden flex flex-col">
            {children}
          </div>
        )}
      </div>

    </div>
  );
}
