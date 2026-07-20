import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch,
  faFilter,
  faInbox,
  faUserTie,
  faCheck,
  faExclamationTriangle,
  faClock,
  faMessage,
  faPaperPlane
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp, faInstagram } from '@fortawesome/free-brands-svg-icons';
import { ConversaCard, MensagemItem } from '@/components/ConversaBaseComponents';

// Dados fictícios estruturados de acordo com o modelo de Conversa
const CONVERSAS_MOCK = [
  {
    id: 'conv-1',
    contact_id: 'eleitor-1',
    contatoNome: 'Mariana Souza',
    channel: 'whatsapp', // WhatsApp Business Oficial
    status: 'nova',
    assigned_to: null,
    unread_count: 3,
    last_message_at: new Date().toISOString(),
    last_message_preview: 'Gostaria de saber como apoiar o novo projeto de lei.',
    responsavel: null
  },
  {
    id: 'conv-2',
    contact_id: 'eleitor-2',
    contatoNome: 'Carlos Eduardo',
    channel: 'whatsapp_legacy', // WhatsApp Legacy
    status: 'em_atendimento',
    assigned_to: 'user-1',
    unread_count: 0,
    last_message_at: new Date(Date.now() - 3600000).toISOString(),
    last_message_preview: 'Obrigado pelo retorno rápido, aguardo o andamento.',
    responsavel: { id: 'user-1', nome: 'Rodrigo Lima' }
  },
  {
    id: 'conv-3',
    contact_id: 'eleitor-3',
    contatoNome: 'Ana Beatriz',
    channel: 'instagram', // Instagram Direct
    status: 'aguardando_eleitor',
    assigned_to: 'user-2',
    unread_count: 0,
    last_message_at: new Date(Date.now() - 7200000).toISOString(),
    last_message_preview: 'Vocês realizam atendimento presencial aos sábados?',
    responsavel: { id: 'user-2', nome: 'Fernanda Costa' }
  }
];

const MOCK_MENSAGENS = {
  'conv-1': [
    { id: 'm1', conversa_id: 'conv-1', direcao: 'entrada', mensagem: 'Olá, tudo bem?', created_at: new Date(Date.now() - 600000).toISOString() },
    { id: 'm2', conversa_id: 'conv-1', direcao: 'entrada', mensagem: 'Gostaria de saber como apoiar o novo projeto de lei.', created_at: new Date().toISOString() }
  ],
  'conv-2': [
    { id: 'm3', conversa_id: 'conv-2', direcao: 'entrada', mensagem: 'Já enviei a documentação necessária.', created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: 'm4', conversa_id: 'conv-2', direcao: 'saida', mensagem: 'Excelente! Vou processar agora mesmo.', created_at: new Date(Date.now() - 5400000).toISOString() },
    { id: 'm5', conversa_id: 'conv-2', direcao: 'entrada', mensagem: 'Obrigado pelo retorno rápido, aguardo o andamento.', created_at: new Date(Date.now() - 3600000).toISOString() }
  ],
  'conv-3': [
    { id: 'm6', conversa_id: 'conv-3', direcao: 'entrada', mensagem: 'Vocês realizam atendimento presencial aos sábados?', created_at: new Date(Date.now() - 7200000).toISOString() }
  ]
};

export default function CentralInbox() {
  const [conversas, setConversas] = useState(CONVERSAS_MOCK);
  const [conversaAtiva, setConversaAtiva] = useState(null);
  const [busca, setBusca] = useState('');
  
  // Filtros
  const [filtroCanal, setFiltroCanal] = useState('all');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [filtroResponsavel, setFiltroResponsavel] = useState('all');

  const [novaMensagemText, setNovaMensagemText] = useState('');

  // Lógica de Filtro aplicada na exibição das Conversas
  const conversasFiltradas = conversas.filter((c) => {
    const bateBusca = c.contatoNome.toLowerCase().includes(busca.toLowerCase()) || 
                      c.last_message_preview.toLowerCase().includes(busca.toLowerCase());
    
    const bateCanal = filtroCanal === 'all' || c.channel === filtroCanal;
    const bateStatus = filtroStatus === 'all' || c.status === filtroStatus;
    
    let bateResponsavel = true;
    if (filtroResponsavel === 'assigned') {
      bateResponsavel = c.assigned_to !== null;
    } else if (filtroResponsavel === 'unassigned') {
      bateResponsavel = c.assigned_to === null;
    }

    return bateBusca && bateCanal && bateStatus && bateResponsavel;
  });

  const handleEnviarMensagem = (e) => {
    e.preventDefault();
    if (!conversaAtiva || !novaMensagemText.trim()) return;

    const novaM = {
      id: `msg-${Date.now()}`,
      conversa_id: conversaAtiva.id,
      direcao: 'saida',
      mensagem: novaMensagemText.trim(),
      created_at: new Date().toISOString()
    };

    MOCK_MENSAGENS[conversaAtiva.id] = [...(MOCK_MENSAGENS[conversaAtiva.id] || []), novaM];
    
    // Atualizar preview da conversa
    setConversas(prev => prev.map(c => c.id === conversaAtiva.id ? {
      ...c,
      last_message_preview: novaMensagemText.trim(),
      last_message_at: new Date().toISOString()
    } : c));

    setNovaMensagemText('');
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-[calc(100vh-140px)]">
      
      {/* Coluna da Fila / Lista de Conversas */}
      <div className="flex flex-col border-r border-gray-100 bg-gray-50/30">
        
        {/* Busca e Título */}
        <div className="p-4 border-b border-gray-100 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-base">Inbox Geral</h3>
            <span className="bg-teal-50 text-teal-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-teal-100">
              {conversasFiltradas.length} ativas
            </span>
          </div>

          <div className="relative">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-gray-400 text-sm" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar conversa..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </div>

        {/* Painel de Filtros Operacionais */}
        <div className="p-3 border-b border-gray-100 bg-white grid grid-cols-3 gap-2 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Canal</label>
            <select
              value={filtroCanal}
              onChange={(e) => setFiltroCanal(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none font-medium"
            >
              <option value="all">Todos</option>
              <option value="whatsapp">Business</option>
              <option value="whatsapp_legacy">Legacy</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Status</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none font-medium"
            >
              <option value="all">Todos</option>
              <option value="nova">Novos</option>
              <option value="em_atendimento">Em Atend.</option>
              <option value="resolver_depois">Depois</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Operador</label>
            <select
              value={filtroResponsavel}
              onChange={(e) => setFiltroResponsavel(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none font-medium"
            >
              <option value="all">Todos</option>
              <option value="assigned">Atribuídos</option>
              <option value="unassigned">Sem Resp.</option>
            </select>
          </div>
        </div>

        {/* Lista de Cards da Fila */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {conversasFiltradas.length > 0 ? (
            conversasFiltradas.map((conv) => (
              <ConversaCard
                key={conv.id}
                conversa={conv}
                selected={conversaAtiva?.id === conv.id}
                onClick={() => setConversaAtiva(conv)}
              />
            ))
          ) : (
            <div className="text-center py-12 text-gray-400 text-xs">
              <FontAwesomeIcon icon={faInbox} className="text-3xl text-gray-200 mb-2 block mx-auto" />
              Nenhuma conversa atende aos filtros ativos.
            </div>
          )}
        </div>
      </div>

      {/* Visualizador da Conversa / Chat Ativo */}
      <div className="flex flex-col bg-gray-50/50">
        {conversaAtiva ? (
          <>
            {/* Header do Chat */}
            <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold select-none">
                  {conversaAtiva.contatoNome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-800">{conversaAtiva.contatoNome}</h4>
                  <span className="text-[10px] font-semibold text-gray-400">
                    Origem: {conversaAtiva.channel === 'whatsapp' ? 'WhatsApp Business' : conversaAtiva.channel === 'instagram' ? 'Instagram Direct' : 'WhatsApp Legacy'}
                  </span>
                </div>
              </div>

              {/* Responsável da conversa */}
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <FontAwesomeIcon icon={faUserTie} className="text-teal-600" />
                <span className="font-medium">
                  {conversaAtiva.responsavel?.nome || 'Não atribuído'}
                </span>
              </div>
            </div>

            {/* Balões de Mensagem */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {(MOCK_MENSAGENS[conversaAtiva.id] || []).map((msg) => (
                <MensagemItem key={msg.id} mensagem={msg} />
              ))}
            </div>

            {/* Input de Envio */}
            <form onSubmit={handleEnviarMensagem} className="p-4 bg-white border-t border-gray-100 flex items-center gap-3">
              <input
                value={novaMensagemText}
                onChange={(e) => setNovaMensagemText(e.target.value)}
                placeholder="Escreva sua resposta..."
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
              <button
                type="submit"
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition flex items-center gap-2 shadow-sm"
              >
                <FontAwesomeIcon icon={faPaperPlane} />
                Enviar
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-xs">
            <FontAwesomeIcon icon={faMessage} className="text-4xl text-gray-200 mb-3" />
            <p className="font-medium">Nenhum atendimento selecionado</p>
            <p className="text-gray-400 mt-1">Selecione uma conversa ao lado para visualizar a linha do tempo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
