import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileSignature, faCheckCircle, faClock, faTimesCircle } from '@fortawesome/free-solid-svg-icons';

/**
 * Card visual detalhado de um Template Oficial do WhatsApp.
 * Exibe a visualização real estruturada: Cabeçalho, Corpo (com variáveis), Rodapé e Botões de Ação.
 * 
 * @param {Object} props
 * @param {import('@/lib/model-templates-oficiais').TemplateOficial} props.template
 */
export function TemplateVisualizerCard({ template }) {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'APPROVED':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><FontAwesomeIcon icon={faCheckCircle} /> Aprovado</span>;
      case 'PENDING':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><FontAwesomeIcon icon={faClock} /> Pendente</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><FontAwesomeIcon icon={faTimesCircle} /> Rejeitado</span>;
    }
  };

  const headerComp = template.componentes.find(c => c.type === 'HEADER');
  const bodyComp = template.componentes.find(c => c.type === 'BODY');
  const footerComp = template.componentes.find(c => c.type === 'FOOTER');
  const buttonsComp = template.componentes.find(c => c.type === 'BUTTONS');

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition duration-200">
      
      {/* Informações de Status */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div>
          <h4 className="font-bold text-sm text-gray-800 truncate" title={template.nome}>
            {template.nome}
          </h4>
          <span className="text-[10px] text-gray-400 font-semibold tracking-wider block mt-0.5">
            Categoria: {template.categoria} · {template.idioma}
          </span>
        </div>
        {getStatusIcon(template.status)}
      </div>

      {/* Visualização de Layout (Preview do Balão do WhatsApp) */}
      <div className="p-4 bg-[#efeae2] flex-1 flex flex-col justify-center">
        <div className="bg-white rounded-xl p-3.5 shadow-xs max-w-sm mx-auto space-y-2 border border-gray-200/50 text-xs">
          
          {/* Cabeçalho */}
          {headerComp && headerComp.format === 'TEXT' && (
            <p className="font-bold text-gray-900 border-b border-gray-100 pb-1.5">{headerComp.text}</p>
          )}

          {/* Corpo */}
          {bodyComp && (
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{bodyComp.text}</p>
          )}

          {/* Rodapé */}
          {footerComp && (
            <p className="text-[10px] text-gray-400 font-medium">{footerComp.text}</p>
          )}

          {/* Botões */}
          {buttonsComp && buttonsComp.buttons && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-100">
              {buttonsComp.buttons.map((btn, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center text-blue-600 font-bold text-[10px] cursor-pointer hover:bg-gray-100"
                >
                  🔗 {btn.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Meta info */}
      <div className="p-3 border-t border-gray-100 text-[9px] text-gray-400 bg-white text-center">
        Última Sincronização: {new Date(template.ultima_sincronizacao).toLocaleString('pt-BR')}
      </div>
    </div>
  );
}
