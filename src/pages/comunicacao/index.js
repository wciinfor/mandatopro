import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faComments, faPaperPlane, faSearch, faUsers, faBell, faCircle, faUserCircle, 
  faCrown, faUserTie, faUser, faCheckDouble, faCheck, faPaperclip, faSmile,
  faEllipsisV, faTrash, faReply, faBroadcastTower, faEnvelope, faPhone,
  faCheckCircle, faExclamationCircle, faTimes, faArrowLeft
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { useNotifications } from '@/contexts/NotificationContext';
import { ROLES } from '@/utils/permissions';

export default function Comunicacao() {
  const { modalState, closeModal, showSuccess, showConfirm } = useModal();
  const { addNotification } = useNotifications();
  const messagesEndRef = useRef(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' ou 'disparo'

  const [usuarioAtual] = useState({
    id: 1,
    nome: 'Admin Sistema',
    nivel: ROLES.ADMINISTRADOR
  });

  // ============ CHAT ============
  const [busca, setBusca] = useState('');
  const [mensagemTexto, setMensagemTexto] = useState('');
  const [conversaSelecionada, setConversaSelecionada] = useState(null);

  // Mock de usuários
  const [usuarios] = useState([
    { id: 1, nome: 'Admin Sistema', nivel: ROLES.ADMINISTRADOR, online: true },
    { id: 2, nome: 'João Silva Santos', nivel: ROLES.LIDERANCA, online: true },
    { id: 3, nome: 'Maria Costa Oliveira', nivel: ROLES.OPERADOR, online: false },
    { id: 4, nome: 'Carlos Mendes', nivel: ROLES.OPERADOR, online: true },
    { id: 5, nome: 'Ana Paula Costa', nivel: ROLES.LIDERANCA, online: false },
    { id: 6, nome: 'Roberto Almeida', nivel: ROLES.OPERADOR, online: true }
  ]);

  // Mock de mensagens
  const [mensagens, setMensagens] = useState([
    {
      id: 1,
      remetenteId: 2,
      destinatarioId: 1,
      texto: 'Olá, Admin! Preciso de ajuda com um cadastro.',
      dataHora: '2024-01-20 10:30',
      lida: true,
      tipo: 'individual'
    },
    {
      id: 2,
      remetenteId: 1,
      destinatarioId: 2,
      texto: 'Oi João! Claro, pode me explicar o problema?',
      dataHora: '2024-01-20 10:32',
      lida: true,
      tipo: 'individual'
    }
  ]);

  // ============ DISPARO EM MASSA ============
  const [canalDisparo, setCanalDisparo] = useState('whatsapp'); // 'whatsapp', 'email', 'sms'
  const [destinatariosDisparo, setDestinatariosDisparo] = useState('todos'); // 'todos', 'liderancas', 'operadores'
  const [mensagemDisparo, setMensagemDisparo] = useState('');
  const [assuntoEmail, setAssuntoEmail] = useState('');
  const [loadingDisparo, setLoadingDisparo] = useState(false);
  const [resultadoDisparo, setResultadoDisparo] = useState(null);

  // Conversas agrupadas
  const conversas = usuarios
    .filter(u => u.id !== usuarioAtual.id)
    .map(usuario => {
      const mensagensConversa = mensagens.filter(
        m => (m.remetenteId === usuario.id && m.destinatarioId === usuarioAtual.id) ||
             (m.remetenteId === usuarioAtual.id && m.destinatarioId === usuario.id)
      );
      
      const ultimaMensagem = mensagensConversa[mensagensConversa.length - 1];
      const naoLidas = mensagensConversa.filter(m => !m.lida && m.destinatarioId === usuarioAtual.id).length;

      return {
        usuario,
        mensagensConversa,
        ultimaMensagem,
        naoLidas
      };
    })
    .sort((a, b) => {
      if (!a.ultimaMensagem) return 1;
      if (!b.ultimaMensagem) return -1;
      return new Date(b.ultimaMensagem.dataHora) - new Date(a.ultimaMensagem.dataHora);
    });

  const converssaFiltrada = conversas.filter(c => 
    c.usuario.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const mensagensChat = conversaSelecionada 
    ? conversas.find(c => c.usuario.id === conversaSelecionada)?.mensagensConversa || []
    : [];

  const handleEnviarMensagem = () => {
    if (!mensagemTexto.trim() || !conversaSelecionada) return;

    const novaMensagem = {
      id: mensagens.length + 1,
      remetenteId: usuarioAtual.id,
      destinatarioId: conversaSelecionada,
      texto: mensagemTexto,
      dataHora: new Date().toLocaleString('pt-BR'),
      lida: false,
      tipo: 'individual'
    };

    setMensagens([...mensagens, novaMensagem]);
    setMensagemTexto('');

    showSuccess('Mensagem enviada com sucesso!');
  };

  const handleEnviarDisparo = async () => {
    if (!mensagemDisparo.trim()) {
      showSuccess('Preencha a mensagem', 'error');
      return;
    }

    if (canalDisparo === 'email' && !assuntoEmail.trim()) {
      showSuccess('Preencha o assunto do email', 'error');
      return;
    }

    setLoadingDisparo(true);

    // Simular delay de envio
    setTimeout(() => {
      let destinatarios = [];
      
      if (destinatariosDisparo === 'todos') {
        destinatarios = usuarios.filter(u => u.id !== usuarioAtual.id);
      } else if (destinatariosDisparo === 'liderancas') {
        destinatarios = usuarios.filter(u => u.nivel === ROLES.LIDERANCA);
      } else if (destinatariosDisparo === 'operadores') {
        destinatarios = usuarios.filter(u => u.nivel === ROLES.OPERADOR);
      }

      const resultado = {
        total: destinatarios.length,
        sucesso: Math.floor(destinatarios.length * 0.95),
        falha: Math.ceil(destinatarios.length * 0.05),
        canal: canalDisparo,
        destinatarios: destinatariosDisparo,
        horario: new Date().toLocaleString('pt-BR')
      };

      setResultadoDisparo(resultado);
      setLoadingDisparo(false);

      showSuccess(`${resultado.sucesso} mensagens enviadas com sucesso!`);
    }, 2000);
  };

  const limparDisparo = () => {
    setMensagemDisparo('');
    setAssuntoEmail('');
    setResultadoDisparo(null);
    setDestinatariosDisparo('todos');
    setCanalDisparo('whatsapp');
  };

  const getCanalIcon = (canal) => {
    switch(canal) {
      case 'whatsapp': return faWhatsapp;
      case 'email': return faEnvelope;
      case 'sms': return faPhone;
      default: return faBroadcast;
    }
  };

  const getCanalCor = (canal) => {
    switch(canal) {
      case 'whatsapp': return 'bg-green-100 border-green-500 text-green-700';
      case 'email': return 'bg-blue-100 border-blue-500 text-blue-700';
      case 'sms': return 'bg-purple-100 border-purple-500 text-purple-700';
      default: return 'bg-gray-100 border-gray-500 text-gray-700';
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-6">
          <div className="flex items-center gap-4">
            <FontAwesomeIcon icon={faComments} size="2x" />
            <div>
              <h1 className="text-3xl font-bold">Comunicação</h1>
              <p className="text-teal-100 mt-1">Chat e Disparo em Massa</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-8">
              <button
                onClick={() => {
                  setActiveTab('chat');
                  setConversaSelecionada(null);
                }}
                className={`py-4 px-2 border-b-2 font-semibold transition ${
                  activeTab === 'chat'
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                💬 Chat
              </button>
              <button
                onClick={() => setActiveTab('disparo')}
                className={`py-4 px-2 border-b-2 font-semibold transition ${
                  activeTab === 'disparo'
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                📢 Disparo em Massa
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* ============ ABA: CHAT ============ */}
          {activeTab === 'chat' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
              {/* Lista de Conversas */}
              <div className="lg:col-span-1 bg-white rounded-lg shadow-lg flex flex-col overflow-hidden">
                <div className="p-4 border-b">
                  <div className="relative">
                    <FontAwesomeIcon 
                      icon={faSearch} 
                      className="absolute left-3 top-3 text-gray-400"
                    />
                    <input
                      type="text"
                      placeholder="Buscar conversa..."
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {converssaFiltrada.map(conversa => (
                    <button
                      key={conversa.usuario.id}
                      onClick={() => setConversaSelecionada(conversa.usuario.id)}
                      className={`w-full text-left px-4 py-3 border-b transition hover:bg-gray-50 ${
                        conversaSelecionada === conversa.usuario.id
                          ? 'bg-teal-50 border-l-4 border-l-teal-600'
                          : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-white text-sm font-bold">
                            {conversa.usuario.nome.charAt(0)}
                          </div>
                          {conversa.usuario.online && (
                            <FontAwesomeIcon 
                              icon={faCircle} 
                              className="absolute bottom-0 right-0 w-3 h-3 text-green-500 bg-white rounded-full"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 truncate">
                            {conversa.usuario.nome}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {conversa.ultimaMensagem?.texto || 'Sem mensagens'}
                          </p>
                        </div>
                        {conversa.naoLidas > 0 && (
                          <div className="flex-shrink-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                            {conversa.naoLidas}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat */}
              <div className="lg:col-span-2 bg-white rounded-lg shadow-lg flex flex-col overflow-hidden">
                {conversaSelecionada ? (
                  <>
                    {/* Header Chat */}
                    <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setConversaSelecionada(null)}
                          className="lg:hidden hover:bg-teal-600 p-2 rounded transition"
                        >
                          <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                        <div>
                          <h3 className="font-bold">
                            {conversas.find(c => c.usuario.id === conversaSelecionada)?.usuario.nome}
                          </h3>
                          <p className="text-sm text-teal-100">
                            {conversas.find(c => c.usuario.id === conversaSelecionada)?.usuario.online 
                              ? 'Online' 
                              : 'Offline'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Mensagens */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                      {mensagensChat.map(msg => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.remetenteId === usuarioAtual.id ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-xs px-4 py-2 rounded-lg ${
                              msg.remetenteId === usuarioAtual.id
                                ? 'bg-teal-600 text-white'
                                : 'bg-gray-300 text-gray-900'
                            }`}
                          >
                            <p>{msg.texto}</p>
                            <p className="text-xs mt-1 opacity-70">{msg.dataHora}</p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="border-t p-4 bg-white">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Digite sua mensagem..."
                          value={mensagemTexto}
                          onChange={(e) => setMensagemTexto(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleEnviarMensagem()}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <button
                          onClick={handleEnviarMensagem}
                          className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition flex items-center gap-2"
                        >
                          <FontAwesomeIcon icon={faPaperPlane} />
                          Enviar
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <FontAwesomeIcon icon={faComments} size="3x" className="mb-4 text-gray-300" />
                      <p>Selecione uma conversa para começar</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============ ABA: DISPARO EM MASSA ============ */}
          {activeTab === 'disparo' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Configuração */}
              <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                  <FontAwesomeIcon icon={faBroadcast} className="text-teal-600" />
                  Enviar Mensagem em Massa
                </h2>

                {!resultadoDisparo ? (
                  <div className="space-y-6">
                    {/* Seleção de Canal */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Canal de Envio
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'whatsapp', label: 'WhatsApp', icon: faWhatsapp },
                          { id: 'email', label: 'Email', icon: faEnvelope },
                          { id: 'sms', label: 'SMS', icon: faPhone }
                        ].map(canal => (
                          <button
                            key={canal.id}
                            onClick={() => setCanalDisparo(canal.id)}
                            className={`p-4 rounded-lg border-2 transition ${
                              canalDisparo === canal.id
                                ? 'border-teal-600 bg-teal-50'
                                : 'border-gray-300 hover:border-teal-400'
                            }`}
                          >
                            <FontAwesomeIcon icon={canal.icon} className="text-2xl mb-2 block" />
                            <p className="font-semibold text-sm">{canal.label}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Assunto (apenas Email) */}
                    {canalDisparo === 'email' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Assunto do Email *
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Informações Importantes"
                          value={assuntoEmail}
                          onChange={(e) => setAssuntoEmail(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    )}

                    {/* Destinatários */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Destinatários
                      </label>
                      <div className="space-y-2">
                        {[
                          { value: 'todos', label: 'Todos os Usuários', count: 5 },
                          { value: 'liderancas', label: 'Apenas Lideranças', count: 2 },
                          { value: 'operadores', label: 'Apenas Operadores', count: 3 }
                        ].map(opt => (
                          <label key={opt.value} className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                              type="radio"
                              name="destinatarios"
                              value={opt.value}
                              checked={destinatariosDisparo === opt.value}
                              onChange={(e) => setDestinatariosDisparo(e.target.value)}
                              className="w-4 h-4"
                            />
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800">{opt.label}</p>
                              <p className="text-sm text-gray-500">{opt.count} usuários</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Mensagem */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Mensagem *
                      </label>
                      <textarea
                        placeholder="Digite a mensagem que será enviada..."
                        value={mensagemDisparo}
                        onChange={(e) => setMensagemDisparo(e.target.value)}
                        rows="6"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Caracteres: {mensagemDisparo.length}
                      </p>
                    </div>

                    {/* Botões */}
                    <div className="flex gap-3">
                      <button
                        onClick={handleEnviarDisparo}
                        disabled={loadingDisparo}
                        className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <FontAwesomeIcon icon={faPaperPlane} />
                        {loadingDisparo ? 'Enviando...' : 'Enviar Agora'}
                      </button>
                      <button
                        onClick={limparDisparo}
                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-lg transition"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FontAwesomeIcon 
                      icon={faCheckCircle} 
                      className="text-6xl text-green-500 mb-4"
                    />
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">
                      Enviado com Sucesso!
                    </h3>
                    <p className="text-gray-600 mb-6">
                      {resultadoDisparo.sucesso} de {resultadoDisparo.total} mensagens foram enviadas
                    </p>
                    <button
                      onClick={limparDisparo}
                      className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-6 rounded-lg transition"
                    >
                      Enviar Outra Mensagem
                    </button>
                  </div>
                )}
              </div>

              {/* Resumo */}
              <div className="bg-white rounded-lg shadow-lg p-6 h-fit sticky top-24">
                <h3 className="font-bold text-lg mb-4 text-gray-800">Resumo</h3>

                <div className={`p-4 rounded-lg mb-4 border-2 ${getCanalCor(canalDisparo)}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <FontAwesomeIcon icon={getCanalIcon(canalDisparo)} />
                    <span className="font-semibold">
                      {canalDisparo === 'whatsapp' ? 'WhatsApp' : canalDisparo === 'email' ? 'Email' : 'SMS'}
                    </span>
                  </div>
                </div>

                {resultadoDisparo ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-gray-50 rounded">
                      <p className="text-xs text-gray-600">Total Enviado</p>
                      <p className="text-2xl font-bold text-teal-600">{resultadoDisparo.total}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded border-l-4 border-green-500">
                      <p className="text-xs text-gray-600">Sucesso</p>
                      <p className="text-2xl font-bold text-green-600">{resultadoDisparo.sucesso}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded border-l-4 border-red-500">
                      <p className="text-xs text-gray-600">Falhas</p>
                      <p className="text-2xl font-bold text-red-600">{resultadoDisparo.falha}</p>
                    </div>
                    <div className="text-xs text-gray-500 pt-3 border-t">
                      {resultadoDisparo.horario}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 rounded">
                      <p className="text-xs text-gray-600">Destinatários</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {destinatariosDisparo === 'todos' ? 5 : destinatariosDisparo === 'liderancas' ? 2 : 3}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                      <p className="text-xs text-gray-600">Caracteres</p>
                      <p className="text-2xl font-bold text-gray-600">{mensagemDisparo.length}</p>
                    </div>
                    <div className="text-xs text-gray-500 pt-3 text-center">
                      Preencha os dados e clique em "Enviar Agora"
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
