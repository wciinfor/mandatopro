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
  children
}) {
  return (
    <div className="w-full h-full bg-slate-900/70 border border-slate-800/90 rounded-2xl p-6 flex flex-col justify-between backdrop-blur shadow-2xl relative overflow-hidden group hover:border-slate-700/80 transition-all duration-300">
      
      {/* Cabeçalho do Widget */}
      <div className="flex items-center justify-between flex-shrink-0 mb-3">
        <div className="flex items-center gap-3">
          {icone && (
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-300 text-lg border border-slate-700/50">
              <FontAwesomeIcon icon={icone} />
            </div>
          )}
          <div>
            <h3 className="text-slate-200 font-bold text-lg leading-tight uppercase tracking-wider">
              {titulo}
            </h3>
            {subtitulo && (
              <p className="text-slate-400 text-xs font-medium mt-0.5">
                {subtitulo}
              </p>
            )}
          </div>
        </div>

        {badgeTag && (
          <span className={`bg-${corBadge}-500/10 text-${corBadge}-400 border border-${corBadge}-500/20 text-xs font-semibold px-3 py-1 rounded-full font-mono uppercase tracking-wider`}>
            {badgeTag}
          </span>
        )}
      </div>

      {/* Área de Conteúdo com Estados de Loading, Error, Empty ou Conteúdo Normal */}
      <div className="flex-1 relative flex flex-col my-1 overflow-hidden">
        {loading ? (
          /* Estado Loading */
          <div className="flex flex-col items-center justify-center h-full w-full border border-slate-800/60 rounded-xl bg-slate-950/40 p-4">
            <FontAwesomeIcon icon={faSyncAlt} className="animate-spin text-teal-400 text-3xl mb-3" />
            <span className="text-slate-400 text-sm font-medium">Carregando dados...</span>
          </div>
        ) : error ? (
          /* Estado Error */
          <div className="flex flex-col items-center justify-center h-full w-full border border-rose-900/40 rounded-xl bg-rose-950/20 p-4 text-center">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-rose-400 text-3xl mb-2" />
            <span className="text-rose-300 text-sm font-semibold mb-1">Falha na atualização</span>
            <span className="text-rose-400/80 text-xs max-w-xs mb-3">{error}</span>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg text-xs font-medium transition-colors"
              >
                Tentar novamente
              </button>
            )}
          </div>
        ) : empty ? (
          /* Estado Empty */
          <div className="flex flex-col items-center justify-center h-full w-full border border-slate-800/60 rounded-xl bg-slate-950/40 p-4 text-center">
            <FontAwesomeIcon icon={faInbox} className="text-slate-600 text-4xl mb-2" />
            <span className="text-slate-400 text-sm font-medium">{mensagemEmpty}</span>
          </div>
        ) : (
          /* Conteúdo do Widget */
          <div className="h-full w-full overflow-hidden">
            {children}
          </div>
        )}
      </div>

      {/* Rodapé / Status de Atualização do Widget */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800/70 text-xs text-slate-500 flex-shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{ultimaAtualizacao ? `Atualizado às ${ultimaAtualizacao}` : 'SSE / Canal Aberto'}</span>
        </span>
        <span className="font-mono text-slate-600">Widget v1.0</span>
      </div>

    </div>
  );
}
