import { useState, useEffect } from 'react';
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
import { ConversasService } from '@/services/conversasService';

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
  const [conversas, setConversas] = useState([]);
  const [conversaAtiva, setConversaAtiva] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [busca, setBusca] = useState('');
  
  // Filtros
  const [filtroCanal, setFiltroCanal] = useState('all');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [filtroResponsavel, setFiltroResponsavel] = useState('all');

  const [novaMensagemText, setNovaMensagemText] = useState('');

  const carregarConversasReais = async () => {
    try {
      const data = await ConversasService.listarConversas();
      setConversas(data || []);
    } catch (err) {
      console.error('Falha ao obter lista de conversas da Central:', err);
    }
  };

  const carregarMensagensReais = async (conversaId) => {
    try {
      const data = await ConversasService.obterMensagens(conversaId);
      setMensagens(data || []);
    } catch (err) {
      console.error('Falha ao carregar histórico de mensagens:', err);
    }
  };

  useEffect(() => {
    carregarConversasReais();

    // 1. Inicia canal Realtime para escuta de communication_conversations
    const supabase = createClient();
    if (!supabase) return;

    const channelConversations = supabase
      .channel('realtime-conversas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'communication_conversations' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const novaC = {
            id: payload.new.id,
            contact_id: payload.new.contact_id,
            contatoNome: payload.new.contact_id,
            channel: payload.new.channel,
            status: payload.new.status,
            assigned_to: payload.new.assigned_to,
            unread_count: payload.new.unread_count || 0,
            last_message_at: payload.new.last_message_at,
            last_message_preview: payload.new.last_message_preview,
            responsavel: payload.new.assigned_to ? { id: payload.new.assigned_to, nome: 'Operador' } : null
          };
          setConversas(prev => [novaC, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setConversas(prev => prev.map(c => c.id === payload.new.id ? {
            ...c,
            status: payload.new.status,
            last_message_preview: payload.new.last_message_preview,
            last_message_at: payload.new.last_message_at,
            unread_count: payload.new.unread_count || 0,
            assigned_to: payload.new.assigned_to,
            responsavel: payload.new.assigned_to ? { id: payload.new.assigned_to, nome: 'Operador' } : null
          } : c));
        } else if (payload.eventType === 'DELETE') {
          setConversas(prev => prev.filter(c => c.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelConversations);
    };
  }, []);

  useEffect(() => {
    if (conversaAtiva?.id) {
      carregarMensagensReais(conversaAtiva.id);

      // 2. Inicia canal Realtime para escuta de communication_messages na conversa ativa
      const supabase = createClient();
      if (!supabase) return;

      const channelMessages = supabase
        .channel(`realtime-mensagens-${conversaAtiva.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'communication_messages',
          filter: `conversation_id=eq.${conversaAtiva.id}`
        }, (payload) => {
          setMensagens(prev => {
            // Evita duplicações causadas por envio próprio concorrente
            if (prev.some(m => m.id === payload.new.id || m.provider_message_id === payload.new.provider_message_id)) {
              return prev;
            }
            return [...prev, payload.new];
          });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channelMessages);
      };
    } else {
      setMensagens([]);
    }
  }, [conversaAtiva]);

  // Lógica de Filtro aplicada na exibição das Conversas
  const conversasFiltradas = conversas.filter((c) => {
    const bateBusca = c.contatoNome.toLowerCase().includes(busca.toLowerCase()) || 
                      (c.last_message_preview && c.last_message_preview.toLowerCase().includes(busca.toLowerCase()));
    
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

  const handleEnviarMensagem = async (e) => {
    e.preventDefault();
    if (!conversaAtiva || !novaMensagemText.trim()) return;

    const textoEnvio = novaMensagemText.trim();
    setNovaMensagemText('');

    try {
      const msgCriada = await ConversasService.enviarMensagem(conversaAtiva.id, { mensagem: textoEnvio });
      
      // Insere na lista local de balões de conversa
      setMensagens(prev => [...prev, msgCriada]);
      
      // Atualiza preview na lista lateral de chats
      setConversas(prev => prev.map(c => c.id === conversaAtiva.id ? {
        ...c,
        last_message_preview: textoEnvio,
        last_message_at: new Date().toISOString()
      } : c));

    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    }
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
        {/* Chips de Contexto / Filtros Rápidos de Status */}
        <div className="p-3 bg-white border-b border-gray-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[10px] font-bold uppercase tracking-wider">
          <button
            onClick={() => setFiltroStatus('all')}
            className={`px-3 py-1.5 rounded-full transition border ${
              filtroStatus === 'all'
                ? 'bg-teal-600 border-teal-600 text-white'
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFiltroStatus('nova')}
            className={`px-3 py-1.5 rounded-full transition border ${
              filtroStatus === 'nova'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-blue-50/50 border-blue-100 text-blue-700 hover:bg-blue-50'
            }`}
          >
            Novas
          </button>
          <button
            onClick={() => setFiltroStatus('em_atendimento')}
            className={`px-3 py-1.5 rounded-full transition border ${
              filtroStatus === 'em_atendimento'
                ? 'bg-amber-600 border-amber-600 text-white'
                : 'bg-amber-50/50 border-amber-100 text-amber-700 hover:bg-amber-50'
            }`}
          >
            Em Atendimento
          </button>
          <button
            onClick={() => setFiltroStatus('aguardando_eleitor')}
            className={`px-3 py-1.5 rounded-full transition border ${
              filtroStatus === 'aguardando_eleitor'
                ? 'bg-purple-600 border-purple-600 text-white'
                : 'bg-purple-50/50 border-purple-100 text-purple-700 hover:bg-purple-50'
            }`}
          >
            Aguardando
          </button>
        </div>

        {/* Painel de Filtros Operacionais Secundários */}
        <div className="p-3 border-b border-gray-100 bg-white grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <label className="block font-bold text-gray-400 uppercase mb-1">Canal de Origem</label>
            <select
              value={filtroCanal}
              onChange={(e) => setFiltroCanal(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none font-semibold text-gray-600"
            >
              <option value="all">Todos os canais</option>
              <option value="whatsapp">WhatsApp Business</option>
              <option value="instagram">Instagram Direct</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-gray-400 uppercase mb-1">Responsável</label>
            <select
              value={filtroResponsavel}
              onChange={(e) => setFiltroResponsavel(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none font-semibold text-gray-600"
            >
              <option value="all">Todos</option>
              <option value="assigned">Atribuídos</option>
              <option value="unassigned">Sem Responsável</option>
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
              Nenhum atendimento ativo localizado.
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
              {mensagens.map((msg) => (
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
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-white to-gray-50/50">
            <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center text-2xl mb-4 shadow-sm border border-teal-100/50">
              💬
            </div>
            <h4 className="font-bold text-gray-800 text-sm">Central de Atendimento Multicanal</h4>
            <p className="text-gray-400 text-xs mt-1.5 max-w-xs leading-relaxed">
              Selecione um eleitor na fila lateral para visualizar as conversas e responder em tempo real.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
