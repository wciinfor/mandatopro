import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBullhorn, faClock, faCheckDouble, faBan } from '@fortawesome/free-solid-svg-icons';

/**
 * Card visual representativo de uma Campanha Oficial de disparos.
 * Exibe métricas de entrega, leitura, falhas e status operacional.
 * 
 * @param {Object} props
 * @param {import('@/lib/model-campanhas-oficiais').CampanhaOficial} props.campanha
 * @param {Function} [props.onAction]
 */
export function CampanhaCard({ campanha, onAction }) {
  const router = useRouter();

  const getStatusBadge = (status) => {
    switch (status) {
      case 'concluido':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'enviando':
        return 'bg-blue-100 text-blue-800 border-blue-200 animate-pulse';
      case 'agendado':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'falho':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleCardClick = () => {
    router.push(`/comunicacao-oficial/campanhas/${campanha.id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4 hover:shadow-md transition duration-200 cursor-pointer"
    >
      <div className="flex justify-between items-start gap-2">
        <div>
          <h4 className="font-bold text-sm text-gray-900 truncate hover:text-teal-600" title={campanha.nome}>
            {campanha.nome}
          </h4>
          <span className="text-[10px] text-gray-400 font-semibold tracking-wider block mt-0.5">
            Template: {campanha.template} · Canal: {campanha.canal}
          </span>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(campanha.status)}`}>
          {campanha.status}
        </span>
      </div>

      {/* Grid de métricas */}
      <div className="grid grid-cols-4 gap-2 text-center bg-gray-50 p-3 rounded-xl border border-gray-100">
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Público</p>
          <p className="text-xs font-bold text-gray-700">{campanha.total_destinatarios}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-green-600">Entregues</p>
          <p className="text-xs font-bold text-green-700">{campanha.entregues}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-blue-600">Lidas</p>
          <p className="text-xs font-bold text-blue-700">{campanha.lidas}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-red-600">Falhas</p>
          <p className="text-xs font-bold text-red-700">{campanha.falhas}</p>
        </div>
      </div>

      <div className="flex justify-between items-center text-[10px] text-gray-400 border-t border-gray-50 pt-3">
        <span>
          <FontAwesomeIcon icon={faClock} className="mr-1" />
          {campanha.agendamento
            ? `Agendado para: ${new Date(campanha.agendamento).toLocaleString('pt-BR')}`
            : 'Envio imediato'}
        </span>
        {campanha.status === 'rascunho' && onAction && (
          <button
            onClick={(event) => { event.stopPropagation(); onAction(campanha); }}
            className="bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold py-1 px-3 rounded-lg border border-teal-100 transition text-[9px]"
          >
            Iniciar Envio
          </button>
        )}
      </div>
    </div>
  );
}
