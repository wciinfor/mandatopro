import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faChartBar, faCoins } from '@fortawesome/free-solid-svg-icons';

/**
 * Componente visual de Funil de Conversão e Métricas de Engajamento de Campanhas.
 * 
 * @param {Object} props
 * @param {Object} props.funil - Dados de passagem do funil
 * @param {import('@/lib/model-resultados-campanhas').ResultadosCampanhaOficial} props.resultados - Cliques, respostas e conversão
 */
export function FunilResultadosCampanha({ funil, resultados }) {
  const etapas = [
    { label: 'Enviadas', valor: funil.enviadas, color: 'bg-teal-600' },
    { label: 'Entregues', valor: funil.entregues, color: 'bg-teal-500' },
    { label: 'Lidas', valor: funil.lidas, color: 'bg-emerald-500' },
    { label: 'Cliques', valor: resultados.cliques_botoes + resultados.cliques_links, color: 'bg-blue-500' },
    { label: 'Respostas', valor: resultados.respostas_recebidas, color: 'bg-indigo-500' },
    { label: 'Conversões', valor: resultados.conversoes, color: 'bg-purple-600' }
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-6">
      
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faChartBar} className="text-teal-600 text-sm" />
          <h4 className="font-bold text-sm text-gray-800">Funil de Resultados e Engajamento</h4>
        </div>
        
        {resultados.custo_por_conversa && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-lg">
            <FontAwesomeIcon icon={faCoins} className="text-gray-400" /> Custo médio: R$ {resultados.custo_por_conversa.toFixed(2)} / conv.
          </span>
        )}
      </div>

      {/* Gráfico do Funil */}
      <div className="space-y-3">
        {etapas.map((etapa, idx) => {
          const maxVal = funil.enviadas || 1;
          const widthPct = Math.round((etapa.valor / maxVal) * 100);
          return (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600 font-semibold px-1">
                <span>{etapa.label}</span>
                <span>{etapa.valor} ({widthPct}%)</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${etapa.color} rounded-full transition-all duration-500`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              {idx < etapas.length - 1 && (
                <div className="text-center text-[10px] text-gray-300">
                  <FontAwesomeIcon icon={faArrowDown} />
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
