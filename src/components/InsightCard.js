import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faCheckCircle, faInfoCircle, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';

/**
 * Cartão de Insight Analítico.
 * Apresenta alertas e recomendações de ações baseadas em dados locais da comunicação.
 * 
 * @param {Object} props
 * @param {import('@/lib/model-insights-comunicacao').InsightRecomendacao} props.insight
 */
export function InsightCard({ insight }) {
  const getStyle = (tipo) => {
    switch (tipo) {
      case 'danger':
        return {
          border: 'border-red-200 bg-red-50/50 text-red-900',
          icon: faExclamationCircle,
          iconColor: 'text-red-600'
        };
      case 'warning':
        return {
          border: 'border-amber-200 bg-amber-50/50 text-amber-900',
          icon: faExclamationTriangle,
          iconColor: 'text-amber-600'
        };
      case 'success':
        return {
          border: 'border-green-200 bg-green-50/50 text-green-900',
          icon: faCheckCircle,
          iconColor: 'text-green-600'
        };
      default:
        return {
          border: 'border-blue-200 bg-blue-50/50 text-blue-900',
          icon: faInfoCircle,
          iconColor: 'text-blue-600'
        };
    }
  };

  const style = getStyle(insight.tipo);

  return (
    <div className={`rounded-2xl border p-5 shadow-xs flex gap-4 items-start ${style.border}`}>
      <span className={`p-2.5 bg-white rounded-xl shadow-xs ${style.iconColor}`}>
        <FontAwesomeIcon icon={style.icon} className="text-base" />
      </span>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-sm text-gray-900">{insight.titulo}</h4>
          <span className="text-[9px] uppercase font-bold tracking-wider text-gray-400 bg-white/80 border border-gray-200/50 px-1.5 py-0.5 rounded">
            {insight.categoria}
          </span>
        </div>
        <p className="text-gray-700 leading-relaxed">{insight.descricao}</p>
        <div className="pt-2 border-t border-gray-200/50 space-y-1">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ação Recomendada:</p>
          <p className="font-medium text-gray-800">{insight.recomendacao}</p>
        </div>
      </div>
    </div>
  );
}
