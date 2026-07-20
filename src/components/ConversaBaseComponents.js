import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEnvelopeOpen,
  faInbox,
  faMessage,
  faPaperPlane,
  faCheckCircle,
  faUserPlus,
  faFolderOpen
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp, faInstagram } from '@fortawesome/free-brands-svg-icons';

/**
 * Função utilitária para renderizar horários relativos amigáveis em aplicativos de chat
 */
function formatarHorarioRelativo(timestamp) {
  if (!timestamp) return '—';
  const data = new Date(timestamp);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);

  const formatTime = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (data.toDateString() === hoje.toDateString()) {
    return `Hoje às ${formatTime(data)}`;
  } else if (data.toDateString() === ontem.toDateString()) {
    return `Ontem às ${formatTime(data)}`;
  } else {
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
}

/**
 * Componente base de visualização rápida da conversa ativa / cartão de histórico.
 * @param {Object} props
 * @param {import('@/lib/model-conversas').Conversa} props.conversa
 * @param {boolean} props.selected
 * @param {Function} props.onClick
 */
export function ConversaCard({ conversa, selected, onClick }) {
  const getCanalIcon = (channel) => {
    switch (channel) {
      case 'instagram':
        return <FontAwesomeIcon icon={faInstagram} className="text-pink-600" title="Instagram Direct" />;
      default:
        return <FontAwesomeIcon icon={faWhatsapp} className="text-emerald-500" title="WhatsApp Oficial" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'nova':
        return <span className="bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-bold px-1.5 py-0.5 rounded">Nova</span>;
      case 'em_atendimento':
        return <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-bold px-1.5 py-0.5 rounded">Em Atendimento</span>;
      case 'aguardando_eleitor':
        return <span className="bg-purple-50 text-purple-700 border border-purple-100 text-[9px] font-bold px-1.5 py-0.5 rounded">Aguardando</span>;
      default:
        return <span className="bg-gray-100 text-gray-700 border border-gray-200 text-[9px] font-bold px-1.5 py-0.5 rounded">Finalizada</span>;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-2xl border transition-all cursor-pointer select-none relative group ${
        selected
          ? 'border-teal-500 bg-teal-50/40 shadow-xs ring-2 ring-teal-100/50'
          : 'border-gray-100 bg-white hover:border-teal-400 hover:shadow-xs'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <span className="text-sm flex-shrink-0">{getCanalIcon(conversa.channel || conversa.canal)}</span>
          <h4 className="font-bold text-sm text-gray-900 truncate">
            {conversa.contatoNome || 'Contato sem nome'}
          </h4>
        </div>
        
        {/* Contadores e Ações no Hover */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {conversa.unread_count > 0 && !selected && (
            <span className="bg-teal-600 text-white text-[10px] font-bold rounded-full h-4.5 w-4.5 flex items-center justify-center">
              {conversa.unread_count}
            </span>
          )}
          
          {/* Ações Rápidas no Hover */}
          <div className="hidden group-hover:flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); alert('Conversa assumida com sucesso.'); }}
              className="p-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded border border-teal-100 text-[9px] font-semibold flex items-center gap-0.5"
              title="Assumir Atendimento"
            >
              <FontAwesomeIcon icon={faUserPlus} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); alert('Atendimento finalizado.'); }}
              className="p-1 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded border border-gray-200 text-[9px] font-semibold flex items-center gap-0.5"
              title="Finalizar"
            >
              <FontAwesomeIcon icon={faCheckCircle} />
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-600 line-clamp-1 mt-2 pr-4">
        {conversa.last_message_preview || 'Sem mensagens registradas'}
      </p>

      <div className="flex items-center justify-between mt-3 border-t border-gray-50 pt-2 text-[10px] text-gray-400">
        <span>
          {formatarHorarioRelativo(conversa.last_message_at)}
        </span>
        <div className="flex items-center gap-1.5">
          {getStatusBadge(conversa.status)}
        </div>
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
