import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faRefresh, faTags, faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons';

/**
 * Card visual representativo de um Público (Audiência segmentada).
 * Exibe contagem de contatos qualificados, origem e última sincronização.
 * 
 * @param {Object} props
 * @param {import('@/lib/model-publicos-oficiais').PublicoOficial} props.publico
 * @param {Function} [props.onSync]
 */
export function PublicoCard({ publico, onSync }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4 hover:shadow-md transition duration-200">
      <div className="flex justify-between items-start gap-2">
        <div>
          <h4 className="font-bold text-sm text-gray-900 truncate" title={publico.nome}>
            {publico.nome}
          </h4>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
            {publico.descricao}
          </p>
        </div>
        <span className="bg-teal-50 text-teal-700 text-[10px] font-bold border border-teal-200 px-2 py-0.5 rounded">
          {publico.canal}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Contatos</p>
          <p className="text-sm font-bold text-gray-800 flex items-center justify-center gap-1 mt-0.5">
            <FontAwesomeIcon icon={faUsers} className="text-teal-600" />
            {publico.quantidade_contatos}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Origem</p>
          <p className="text-xs font-semibold text-gray-700 mt-1">{publico.origem}</p>
        </div>
      </div>

      {/* Exibição resumida dos filtros de segmentação configurados */}
      {publico.filtros_ativos && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {publico.filtros_ativos.tags && (
            <span className="inline-flex items-center gap-1 text-[9px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              <FontAwesomeIcon icon={faTags} className="text-[8px]" /> Tags
            </span>
          )}
          {publico.filtros_ativos.bairro && (
            <span className="inline-flex items-center gap-1 text-[9px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              <FontAwesomeIcon icon={faMapMarkerAlt} className="text-[8px]" /> Bairro
            </span>
          )}
        </div>
      )}

      <div className="flex justify-between items-center text-[10px] text-gray-400 border-t border-gray-50 pt-3">
        <span>
          Atualizado em: {new Date(publico.ultima_atualizacao).toLocaleDateString('pt-BR')}
        </span>
        {onSync && (
          <button
            onClick={() => onSync(publico.id)}
            className="text-teal-600 hover:text-teal-800 font-bold flex items-center gap-1 transition text-[10px]"
            title="Recalcular contatos"
          >
            <FontAwesomeIcon icon={faRefresh} /> Recalcular
          </button>
        )}
      </div>
    </div>
  );
}
