import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PDFGenerator from '@/utils/pdfGenerator';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import {
  faChartBar, faClipboardList, faUniversity, faCoins, faMapMarkerAlt, 
  faBullhorn, faCalendarAlt, faBirthdayCake, faFileAlt, faExclamationTriangle, 
  faUsers, faSignOutAlt, faBell, faChevronUp, faChevronDown, faBars, faTimes,
  faList, faPlus, faFilter, faPrint, faEdit, faTrash, faChevronLeft, faChevronRight, 
  faAngleDoubleLeft, faAngleDoubleRight, faUserTie, faEye, faShoppingCart, faFileArchive
} from '@fortawesome/free-solid-svg-icons';

const modulos = [
  { nome: 'Dashboard', icone: faChartBar, submenu: [] },
  {
    nome: 'Cadastros',
    icone: faClipboardList,
    submenu: ['Eleitores', 'Lideranças', 'Funcionários', 'Atendimentos']
  },
  {
    nome: 'Emendas',
    icone: faUniversity,
    submenu: ['Órgãos', 'Responsáveis', 'Emendas', 'Repasses', 'Relatórios']
  },
  {
    nome: 'Financeiro',
    icone: faCoins,
    submenu: ['Receitas', 'Despesas', 'Relatórios Financeiros']
  },
  { nome: 'Geolocalização', icone: faMapMarkerAlt, submenu: [] },
  { nome: 'Comunicados', icone: faBullhorn, submenu: [] },
  {
    nome: 'Agenda',
    icone: faCalendarAlt,
    submenu: ['Compromissos', 'Reuniões', 'Eventos']
  },
  { nome: 'Aniversariantes', icone: faBirthdayCake, submenu: [] },
  {
    nome: 'Documentos',
    icone: faFileAlt,
    submenu: ['Ofícios', 'Relatórios', 'Contratos']
  },
  { nome: 'Solicitações', icone: faExclamationTriangle, submenu: [] },
  { nome: 'Usuários', icone: faUsers, submenu: [] },
];

export default function GerenciarAtendimentos() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  const [usuario, setUsuario] = useState(null);
  const [moduloAtivo, setModuloAtivo] = useState('Cadastros - Atendimentos');
  const [menusAbertos, setMenusAbertos] = useState({ Cadastros: true });
  const [sidebarAberto, setSidebarAberto] = useState(false);
  
  const [atendimentos, setAtendimentos] = useState([
    {
      id: 1,
      codigo: 1,
      tipoAtendimento: 'ACAO_SOCIAL',
      tipoEspecifico: 'OFTAMOLOGISTA',
      eleitor: 'JOÃO DA SILVA SANTOS',
      eleitorCpf: '123.456.789-00',
      data: '2025-11-20',
      dataAtendimento: '2025-11-20',
      status: 'REALIZADO',
      statusPedido: 'PENDENTE', // PENDENTE, ENVIADO, RECEBIDO
      notificacao: 'EMAIL',
      statusAtendimento: 'ATIVO',
      oftalmologista: {
        odEsferico: '-2.00',
        odCilindrico: '-0.75',
        odEixo: '180',
        odAdicao: '+2.00',
        odDNP: '32',
        oeEsferico: '-2.25',
        oeCilindrico: '-1.00',
        oeEixo: '175',
        oeAdicao: '+2.00',
        oeDNP: '32',
        tipoLente: 'MULTIFOCAL',
        observacoesReceita: 'Lentes com anti-reflexo'
      }
    },
    {
      id: 2,
      codigo: 2,
      tipoAtendimento: 'ACAO_SOCIAL',
      tipoEspecifico: 'OFTAMOLOGISTA',
      eleitor: 'MARIA OLIVEIRA',
      eleitorCpf: '987.654.321-00',
      data: '2025-11-18',
      dataAtendimento: '2025-11-18',
      status: 'REALIZADO',
      statusPedido: 'PENDENTE',
      notificacao: 'WHATSAPP',
      statusAtendimento: 'ATIVO',
      oftalmologista: {
        odEsferico: '-1.50',
        odCilindrico: '-0.50',
        odEixo: '90',
        odAdicao: '',
        odDNP: '31',
        oeEsferico: '-1.75',
        oeCilindrico: '-0.50',
        oeEixo: '85',
        oeAdicao: '',
        oeDNP: '31',
        tipoLente: 'UNIFOCAL',
        observacoesReceita: ''
      }
    },
    {
      id: 3,
      codigo: 3,
      tipoAtendimento: 'ACAO_SOCIAL',
      tipoEspecifico: 'MEDICO',
      eleitor: 'CARLOS PEREIRA',
      eleitorCpf: '111.222.333-44',
      data: '2025-11-19',
      dataAtendimento: '2025-11-19',
      status: 'REALIZADO',
      statusPedido: null,
      notificacao: 'EMAIL',
      statusAtendimento: 'ATIVO'
    },
    {
      id: 4,
      codigo: 4,
      tipoAtendimento: 'ACAO_SOCIAL',
      tipoEspecifico: 'HOSPITALAR',
      eleitor: 'ANA COSTA',
      eleitorCpf: '555.666.777-88',
      data: '2025-11-17',
      dataAtendimento: '2025-11-17',
      status: 'EM_PROCESSO',
      statusPedido: null,
      notificacao: 'WHATSAPP',
      statusAtendimento: 'ATIVO'
    },
    {
      id: 5,
      codigo: 5,
      tipoAtendimento: 'JURIDICO',
      tipoEspecifico: 'JURIDICO',
      eleitor: 'PEDRO SANTOS',
      eleitorCpf: '999.888.777-66',
      data: '2025-11-16',
      dataAtendimento: '2025-11-16',
      status: 'EM_PROCESSO',
      statusPedido: null,
      notificacao: 'EMAIL',
      statusAtendimento: 'ATIVO'
    }
  ]);
  const [filtro, setFiltro] = useState('');
  const [situacao, setSituacao] = useState('ATIVO');
  const [tipoFiltro, setTipoFiltro] = useState('TODOS');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(10);

  useEffect(() => {
    const usuarioStr = localStorage.getItem('usuario');
    if (!usuarioStr) {
      router.push('/login');
      return;
    }
    setUsuario(JSON.parse(usuarioStr));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('usuario');
    router.push('/login');
  };

  const atendimentosFiltrados = atendimentos.filter(at => {
    const matchFiltro = filtro === '' || 
      at.eleitor.toLowerCase().includes(filtro.toLowerCase()) ||
      at.tipoAtendimento.toLowerCase().includes(filtro.toLowerCase());
    const matchSituacao = situacao === 'ATIVO' ? at.statusAtendimento === 'ATIVO' : at.statusAtendimento !== 'ATIVO';
    const matchTipo = tipoFiltro === 'TODOS' || at.tipoAtendimento === tipoFiltro;
    return matchFiltro && matchSituacao && matchTipo;
  });

  const totalPaginas = Math.ceil(atendimentosFiltrados.length / itensPorPagina);
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const indiceFim = indiceInicio + itensPorPagina;
  const atendimentosPaginados = atendimentosFiltrados.slice(indiceInicio, indiceFim);

  const handleInserir = () => {
    router.push('/cadastros/atendimentos/novo');
  };

  const handleEditar = (id) => {
    router.push(`/cadastros/atendimentos/${id}`);
  };

  const handleExcluir = (id) => {
    showConfirm('Tem certeza que deseja excluir este atendimento?', () => {
      setAtendimentos(atendimentos.filter(a => a.id !== id));
      showSuccess('Atendimento excluído com sucesso!');
    });
  };

  const handleImprimirListagem = () => {
    const pdfGen = new PDFGenerator();
    pdfGen.initDoc();
    pdfGen.addHeader('LISTAGEM DE ATENDIMENTOS');
    
    const tableData = atendimentosFiltrados.map(at => [
      at.codigo,
      at.tipoAtendimento.replace(/_/g, ' '),
      at.eleitor,
      new Date(at.data).toLocaleDateString('pt-BR'),
      at.status.replace(/_/g, ' '),
      at.notificacao,
      at.statusAtendimento
    ]);
    
    pdfGen.doc.autoTable({
      head: [['Código', 'Tipo', 'Eleitor', 'Data', 'Status', 'Notificação', 'Situação']],
      body: tableData,
      startY: 50,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [10, 76, 83], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    
    pdfGen.addFooter();
    pdfGen.doc.save(`listagem-atendimentos-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleImprimirFicha = (atendimento) => {
    const dadosFicha = {
      tipoAtendimento: atendimento.tipoAtendimento,
      eleitor: atendimento.eleitor,
      data: atendimento.data,
      status: atendimento.status,
      notificacao: atendimento.notificacao,
      observacoes: 'Atendimento registrado no sistema MandatoPro',
      dataEmissao: new Date().toLocaleDateString('pt-BR')
    };
    
    const pdfGen = new PDFGenerator();
    pdfGen.gerarRelatorioAtendimento(dadosFicha);
  };

  const handleGerarPedidoLentes = () => {
    // Filtrar atendimentos de oftalmologista pendentes
    const atendimentosOftalmoPendentes = atendimentos.filter(
      at => at.tipoEspecifico === 'OFTAMOLOGISTA' && 
            at.statusPedido === 'PENDENTE' &&
            at.status === 'REALIZADO'
    );

    if (atendimentosOftalmoPendentes.length === 0) {
      showError('Não há atendimentos oftalmológicos pendentes para gerar pedido.');
      return;
    }

    showConfirm(
      `Gerar pedido com ${atendimentosOftalmoPendentes.length} atendimento(s) (${atendimentosOftalmoPendentes.length * 2} lentes)? Os atendimentos serão marcados como ENVIADO.`,
      () => {
        // Gerar PDF do pedido
        const pdfGen = new PDFGenerator();
        const numeroPedido = `PED-${Date.now()}`;
        pdfGen.gerarPedidoLentesConsolidado(atendimentosOftalmoPendentes, numeroPedido);

        // Atualizar status dos atendimentos para ENVIADO
        const idsAtualizados = atendimentosOftalmoPendentes.map(at => at.id);
        setAtendimentos(prev => prev.map(at => 
          idsAtualizados.includes(at.id) 
            ? { ...at, statusPedido: 'ENVIADO', numeroPedido: numeroPedido, dataPedido: new Date().toISOString() }
            : at
        ));

        // Aqui seria salvo no banco: pedido arquivado + atualização de status
        showSuccess(`Pedido ${numeroPedido} gerado com sucesso! ${atendimentosOftalmoPendentes.length} atendimento(s) marcados como ENVIADO.`);
      }
    );
  };

  const handleReimprimirPedido = (numeroPedido) => {
    // Buscar atendimentos desse pedido
    const atendimentosDoPedido = atendimentos.filter(at => at.numeroPedido === numeroPedido);
    
    if (atendimentosDoPedido.length === 0) {
      showError('Pedido não encontrado.');
      return;
    }

    const pdfGen = new PDFGenerator();
    pdfGen.gerarPedidoLentesConsolidado(atendimentosDoPedido, numeroPedido, true);
    showSuccess('Segunda via do pedido gerada com sucesso!');
  };

  // Contar atendimentos pendentes
  const atendimentosOftalmoPendentes = atendimentos.filter(
    at => at.tipoEspecifico === 'OFTAMOLOGISTA' && 
          at.statusPedido === 'PENDENTE' &&
          at.status === 'REALIZADO'
  ).length;

  if (!usuario) return <div className="flex items-center justify-center h-screen">Carregando...</div>;

  return (
    <div className="min-h-screen bg-teal-50 flex">
      {/* Modal */}
      <Modal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        showCancel={modalState.showCancel}
      />

      {/* Overlay para mobile */}
      {sidebarAberto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarAberto(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`w-64 bg-[#0A4C53] text-white fixed left-0 top-0 min-h-screen z-50 shadow-lg transform transition-transform duration-300 ease-in-out ${
        sidebarAberto ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 lg:static lg:z-auto flex flex-col`}>
        <div className="p-6 flex-1 flex flex-col min-h-screen">
          <div className="flex justify-end mb-4 lg:hidden">
            <button 
              onClick={() => setSidebarAberto(false)}
              className="mt-2.5 text-white hover:text-teal-200"
            >
              <FontAwesomeIcon icon={faTimes} className="text-xl" />
            </button>
          </div>

          <div className="flex items-center justify-center mb-2">
            <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center text-2xl">🏛️</div>
            <h1 className="text-2xl font-bold ml-3">MandatoPro</h1>
          </div>
          <p className="text-center text-teal-100 text-sm mb-6">SISTEMA DE GESTÃO POLÍTICA</p>
          
          <nav className="space-y-1 flex-1">
            {modulos.map((modulo, idx) => (
              <div key={modulo.nome}>
                <button
                  onClick={() => {
                    setModuloAtivo(modulo.nome);
                    if (modulo.submenu.length > 0) {
                      setMenusAbertos(prev => ({
                        ...prev,
                        [modulo.nome]: !prev[modulo.nome]
                      }));
                    } else {
                      if (modulo.nome === 'Dashboard') {
                        window.location.href = '/dashboard';
                      }
                    }
                  }}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${
                    moduloAtivo === modulo.nome || moduloAtivo.startsWith(modulo.nome)
                      ? 'bg-white text-[#0A4C53] font-bold shadow-md'
                      : 'hover:bg-[#032E35]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={modulo.icone} className="text-xl" />
                    <span>{modulo.nome}</span>
                  </div>
                  {modulo.submenu.length > 0 && (
                    <FontAwesomeIcon 
                      icon={menusAbertos[modulo.nome] ? faChevronUp : faChevronDown} 
                      className="text-sm" 
                    />
                  )}
                </button>
                
                {modulo.submenu.length > 0 && (
                  <div className={`mt-1 overflow-hidden transition-all duration-300 ease-in-out ${
                    menusAbertos[modulo.nome] ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}>
                    <div className="bg-[#032E35] p-1 space-y-1">
                      {modulo.submenu.map((subitem) => (
                        <button
                          key={subitem}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setModuloAtivo(`${modulo.nome} - ${subitem}`);
                            setSidebarAberto(false);
                            
                            const routeMap = {
                              'Funcionários': '/cadastros/funcionarios',
                              'Lideranças': '/cadastros/liderancas',
                              'Eleitores': '/cadastros/eleitores',
                              'Atendimentos': '/cadastros/atendimentos',
                              'Regionais/Locais': '/cadastros/regionais-locais'
                            };
                            
                            const rota = routeMap[subitem];
                            
                            if (rota) {
                              if (window.location.pathname === rota) {
                                window.location.reload();
                              } else {
                                window.location.href = rota;
                              }
                            }
                          }}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                            moduloAtivo === `${modulo.nome} - ${subitem}`
                              ? 'bg-white text-[#0A4C53] font-bold'
                              : 'hover:bg-[#0A4C53] text-gray-300'
                          }`}
                        >
                          {subitem}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {modulo.nome === 'Usuários' && (
                  <div className="px-4 mt-2.5">
                    <button
                      onClick={handleLogout}
                      className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      <FontAwesomeIcon icon={faSignOutAlt} />
                      <span>Sair</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 transition-all duration-300 ease-in-out lg:ml-0">
        {/* Header */}
        <div className="bg-white shadow-sm p-3 lg:p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarAberto(true)}
                className="lg:hidden text-teal-700 hover:text-teal-900 p-2"
              >
                <FontAwesomeIcon icon={faBars} className="text-lg" />
              </button>
              <div>
                <h2 className="text-lg lg:text-xl font-bold text-teal-800">
                  Gerenciar Atendimentos
                </h2>
                <p className="text-xs text-gray-600">Listagem e controle de atendimentos</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="relative p-1 text-teal-700 hover:text-teal-900">
                <FontAwesomeIcon icon={faBell} className="text-lg" />
              </button>
              <div className="flex items-center gap-2 bg-teal-100 px-3 py-2 rounded-lg">
                <FontAwesomeIcon icon={faUserTie} className="text-sm text-teal-700" />
                <span className="font-semibold text-teal-800 text-sm">{usuario?.nome || 'User'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-4 lg:p-6">
          {/* Botões de Ação */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => window.location.href = '/cadastros/atendimentos'}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                <FontAwesomeIcon icon={faList} />
                Listar
              </button>
              <button
                onClick={handleInserir}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                <FontAwesomeIcon icon={faPlus} />
                Inserir
              </button>
              <button
                onClick={handleGerarPedidoLentes}
                disabled={atendimentosOftalmoPendentes === 0}
                className={`flex items-center gap-2 px-4 py-2 text-white rounded transition-colors ${
                  atendimentosOftalmoPendentes > 0 
                    ? 'bg-purple-600 hover:bg-purple-700' 
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                <FontAwesomeIcon icon={faShoppingCart} />
                Gerar Pedido de Lentes
                {atendimentosOftalmoPendentes > 0 && (
                  <span className="bg-white text-purple-600 px-2 py-0.5 rounded-full text-xs font-bold">
                    {atendimentosOftalmoPendentes} ({atendimentosOftalmoPendentes * 2} lentes)
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <FontAwesomeIcon icon={faFilter} className="text-teal-600" />
              <h2 className="font-bold text-gray-700">Filtro de Busca</h2>
            </div>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DIGITE SUA BUSCA
                </label>
                <input
                  type="text"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500"
                  placeholder="Eleitor, Tipo..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  TIPO
                </label>
                <select
                  value={tipoFiltro}
                  onChange={(e) => setTipoFiltro(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500"
                >
                  <option value="TODOS">TODOS</option>
                  <option value="ACAO_SOCIAL">AÇÃO SOCIAL</option>
                  <option value="EMISSAO_DOCUMENTOS">EMISSÃO DOCUMENTOS</option>
                  <option value="ATENDIMENTO_JURIDICO">ATENDIMENTO JURÍDICO</option>
                  <option value="OUTROS">OUTROS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SITUAÇÃO
                </label>
                <select
                  value={situacao}
                  onChange={(e) => setSituacao(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500"
                >
                  <option value="ATIVO">ATIVO</option>
                  <option value="INATIVO">INATIVO</option>
                </select>
              </div>
              <button
                onClick={() => { setFiltro(''); setTipoFiltro('TODOS'); }}
                className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
              >
                LIMPAR
              </button>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faList} className="text-teal-600" />
                <h2 className="font-bold text-gray-700">Listagem de Atendimentos</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Quantidade de Atendimentos</span>
                <input
                  type="number"
                  value={atendimentosFiltrados.length}
                  readOnly
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                />
                <button
                  onClick={handleImprimirListagem}
                  className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                >
                  IMPRIMIR
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Código</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Tipo</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Eleitor</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Data</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Status</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Pedido</th>
                    <th className="px-4 py-2 text-center text-sm font-bold text-gray-700">Controles</th>
                  </tr>
                </thead>
                <tbody>
                  {atendimentosPaginados.map((atendimento, idx) => (
                    <tr key={atendimento.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm">{atendimento.codigo}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {atendimento.tipoEspecifico === 'OFTAMOLOGISTA' && (
                            <FontAwesomeIcon icon={faEye} className="text-blue-600" title="Oftalmologista" />
                          )}
                          <div>
                            <div className="font-medium">{atendimento.tipoAtendimento.replace(/_/g, ' ')}</div>
                            {atendimento.tipoEspecifico && (
                              <div className="text-xs text-gray-500">{atendimento.tipoEspecifico}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{atendimento.eleitor}</td>
                      <td className="px-4 py-3 text-sm">{new Date(atendimento.data).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          atendimento.status === 'REALIZADO' 
                            ? 'bg-green-100 text-green-800' 
                            : atendimento.status === 'EM_PROCESSO'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {atendimento.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {atendimento.tipoEspecifico === 'OFTAMOLOGISTA' && (
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              atendimento.statusPedido === 'PENDENTE' 
                                ? 'bg-orange-100 text-orange-800' 
                                : atendimento.statusPedido === 'ENVIADO'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {atendimento.statusPedido}
                            </span>
                            {atendimento.numeroPedido && (
                              <button
                                onClick={() => handleReimprimirPedido(atendimento.numeroPedido)}
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                title="Reimprimir pedido"
                              >
                                <FontAwesomeIcon icon={faFileArchive} />
                                {atendimento.numeroPedido}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleImprimirFicha(atendimento)}
                            className="p-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                            title="Imprimir"
                          >
                            <FontAwesomeIcon icon={faPrint} />
                          </button>
                          <button
                            onClick={() => handleEditar(atendimento.id)}
                            className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            title="Editar"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            onClick={() => handleExcluir(atendimento.id)}
                            className="p-2 bg-red-600 text-white rounded hover:bg-red-700"
                            title="Excluir"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                PÁGINAS: <span className="font-bold">{paginaAtual}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPaginaAtual(1)}
                  disabled={paginaAtual === 1}
                  className="p-2 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={faAngleDoubleLeft} />
                </button>
                <button
                  onClick={() => setPaginaAtual(Math.max(1, paginaAtual - 1))}
                  disabled={paginaAtual === 1}
                  className="p-2 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <span className="px-4 py-2 bg-gray-100 rounded">{paginaAtual}</span>
                <button
                  onClick={() => setPaginaAtual(Math.min(totalPaginas, paginaAtual + 1))}
                  disabled={paginaAtual === totalPaginas}
                  className="p-2 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
                <button
                  onClick={() => setPaginaAtual(totalPaginas)}
                  disabled={paginaAtual === totalPaginas}
                  className="p-2 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={faAngleDoubleRight} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
