import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelopeOpen, faInbox, faMessage, faPaperPlane } from '@fortawesome/free-solid-svg-icons';

/**
 * Componente base de visualização rápida da conversa ativa / cartão de histórico.
 * @param {Object} props
 * @param {import('@/lib/model-conversas').Conversa} props.conversa
 * @param {boolean} props.selected
 * @param {Function} props.onClick
 */
export function ConversaCard({ conversa, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
        selected
          ? 'border-teal-500 bg-teal-50/40 shadow-sm ring-2 ring-teal-100'
          : 'border-gray-200 bg-white hover:border-teal-400 hover:shadow-xs'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <h4 className="font-bold text-sm text-gray-900 truncate">
            {conversa.contatoNome || 'Contato sem nome'}
          </h4>
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
            Canal: {conversa.channel || conversa.canal}
          </span>
        </div>
        {conversa.unread_count > 0 && (
          <span className="bg-teal-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {conversa.unread_count}
          </span>
        )}
      </div>

      <p className="text-xs text-gray-600 line-clamp-1 mt-2">
        {conversa.last_message_preview || 'Sem mensagens registradas'}
      </p>

      <div className="flex items-center justify-between mt-3 border-t border-gray-100 pt-2 text-[10px] text-gray-400">
        <span>
          {conversa.last_message_at
            ? new Date(conversa.last_message_at).toLocaleDateString('pt-BR')
            : '—'}
        </span>
        <span className="font-semibold text-gray-500">
          Status: {conversa.status}
        </span>
      </div>
    </div>
  );
}

/**
 * Componente base para renderização da linha de mensagens dentro do Chat.
 * @param {Object} props
 * @param {import('@/lib/model-conversas').Mensagem} props.mensagem
 */
export function MensagemItem({ mensagem }) {
  const isOut = mensagem.direcao === 'saida';
  const isSystem = mensagem.direcao === 'nota';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-medium border border-gray-200">
          ⚙️ {mensagem.mensagem}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} my-2`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
          isOut
            ? 'bg-teal-600 text-white rounded-tr-none'
            : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
        }`}
      >
        <p className="leading-relaxed break-words">{mensagem.mensagem}</p>
        <span
          className={`block text-[9px] mt-1 text-right ${
            isOut ? 'text-teal-200' : 'text-gray-400'
          }`}
        >
          {mensagem.created_at ? new Date(mensagem.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
        </span>
      </div>
    </div>
  );
}
