import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCheckCircle, faExclamationCircle, faPaperPlane, faPause } from '@fortawesome/free-solid-svg-icons';

/**
 * Componente visual de monitoramento e progresso detalhado de execução da campanha.
 * Apresenta a barra de progresso consolidada e contadores por estágio da fila.
 * 
 * @param {Object} props
 * @param {Object} props.progresso - Estatísticas do progresso (total, enviados, pendentes, falhas)
 * @param {string} props.statusCampanha - Status geral (enviando, pausado, concluido)
 * @param {Function} [props.onTogglePause] - Controle de pausa da execução
 */
export function AcompanhamentoExecucao({ progresso, statusCampanha, onTogglePause }) {
  const total = progresso.total || 0;
  const processados = (progresso.enviados || 0) + (progresso.falhas || 0);
  const percentual = total > 0 ? Math.round((processados / total) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold text-sm text-gray-800">Status de Processamento</h4>
          <p className="text-xs text-gray-500 mt-0.5">Acompanhamento em tempo real da fila do motor oficial.</p>
        </div>

        {onTogglePause && statusCampanha === 'enviando' && (
          <button
            onClick={onTogglePause}
            className="bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 transition"
          >
            <FontAwesomeIcon icon={faPause} /> Pausar Fila
          </button>
        )}
      </div>

      {/* Barra de Progresso */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-semibold text-gray-700">
          <span>Envios Concluídos</span>
          <span>{percentual}% ({processados}/{total})</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percentual}%` }}
          />
        </div>
      </div>

      {/* Contadores Detalhados de Status da Fila */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Aguardando</p>
          <p className="text-sm font-bold text-gray-600 flex items-center justify-center gap-1.5 mt-1">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-gray-400 text-xs" />
            {progresso.pendentes || 0}
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-teal-600">Disparados</p>
          <p className="text-sm font-bold text-teal-700 flex items-center justify-center gap-1.5 mt-1">
            <FontAwesomeIcon icon={faPaperPlane} className="text-xs" />
            {progresso.enviados || 0}
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-green-600">Entregues</p>
          <p className="text-sm font-bold text-green-700 flex items-center justify-center gap-1.5 mt-1">
            <FontAwesomeIcon icon={faCheckCircle} className="text-xs" />
            {progresso.entregues || 0}
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-red-600">Erros / Falhas</p>
          <p className="text-sm font-bold text-red-700 flex items-center justify-center gap-1.5 mt-1">
            <FontAwesomeIcon icon={faExclamationCircle} className="text-xs" />
            {progresso.falhas || 0}
          </p>
        </div>
      </div>
    </div>
  );
}
