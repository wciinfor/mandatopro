import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faHistory,
  faPaperPlane,
  faTimesCircle,
  faSpinner,
  faPause,
  faPlay,
  faSearch
} from '@fortawesome/free-solid-svg-icons';

/**
 * Componente que exibe a Linha do Tempo e o Log Cronológico dos disparos e webhooks de status recebidos.
 * 
 * @param {Object} props
 * @param {Array<Object>} props.eventosFila - Logs cronológicos de disparo e webhook
 */
export function LinhaTempoJornada({ eventosFila }) {
  const getIconStatus = (status) => {
    switch (status) {
      case 'lida':
      case 'read':
        return <span className="h-6 w-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xs">✓✓</span>;
      case 'entregue':
      case 'delivered':
        return <span className="h-6 w-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs">✓</span>;
      case 'enviada':
      case 'sent':
        return <span className="h-6 w-6 bg-gray-100 text-gray-700 rounded-full flex items-center justify-center text-xs">✉</span>;
      case 'falhou':
      case 'failed':
        return <span className="h-6 w-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs">✕</span>;
      default:
        return <span className="h-6 w-6 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs">⏱</span>;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
        <FontAwesomeIcon icon={faHistory} className="text-teal-600" />
        <h4 className="font-bold text-sm text-gray-800">Linha do Tempo da Jornada</h4>
      </div>

      <div className="relative border-l border-gray-100 ml-3 pl-6 space-y-5">
        {eventosFila.map((event, idx) => (
          <div key={idx} className="relative">
            {/* Ícone flutuante sobre a linha */}
            <div className="absolute -left-[37px] top-0.5">
              {getIconStatus(event.status)}
            </div>

            <div className="text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-800">Contato: {event.contact_id}</span>
                <span className="text-[10px] text-gray-400">
                  {new Date(event.updated_at || event.scheduled_at).toLocaleTimeString('pt-BR')}
                </span>
              </div>
              <p className="text-gray-500">
                Status: <span className="font-semibold text-gray-700 uppercase tracking-wider">{event.status}</span>
                {event.attempts > 0 && ` (Tentativa: ${event.attempts}/3)`}
              </p>
              {event.last_error && (
                <p className="text-[10px] bg-red-50 text-red-700 border border-red-100 p-2 rounded-lg mt-1 font-mono">
                  Erro: {event.last_error}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
