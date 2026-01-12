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
  faAngleDoubleLeft, faAngleDoubleRight, faUserTie, faIdCard
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

export default function GerenciarLiderancas() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  const [usuario, setUsuario] = useState(null);
  const [moduloAtivo, setModuloAtivo] = useState('Cadastros - Lideranças');
  const [menusAbertos, setMenusAbertos] = useState({ Cadastros: true });
  const [sidebarAberto, setSidebarAberto] = useState(false);
  
  const [liderancas, setLiderancas] = useState([
    {
      id: 1,
      codigo: 1,
      nomeSocial: 'PR ASSIS ALCANTARA',
      cpf: '96448972387',
      uf: 'PA',
      cidade: 'ANANINDEUA',
      bairro: 'ATALAIA',
      telefone: '91993129501',
      status: 'ATIVO'
    }
  ]);
  const [filtro, setFiltro] = useState('');
  const [situacao, setSituacao] = useState('ATIVO');
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

  const liderancasFiltradas = liderancas.filter(lid => {
    const matchFiltro = filtro === '' || 
      lid.nomeSocial.toLowerCase().includes(filtro.toLowerCase()) ||
      lid.cpf.includes(filtro) ||
      lid.cidade.toLowerCase().includes(filtro.toLowerCase());
    const matchSituacao = situacao === 'ATIVO' ? lid.status === 'ATIVO' : lid.status !== 'ATIVO';
    return matchFiltro && matchSituacao;
  });

  const totalPaginas = Math.ceil(liderancasFiltradas.length / itensPorPagina);
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const indiceFim = indiceInicio + itensPorPagina;
  const liderancasPaginadas = liderancasFiltradas.slice(indiceInicio, indiceFim);

  const handleInserir = () => {
    router.push('/cadastros/liderancas/novo');
  };

  const handleEditar = (id) => {
    router.push(`/cadastros/liderancas/${id}`);
  };

  const handleExcluir = (id) => {
    showConfirm('Tem certeza que deseja excluir esta liderança?', () => {
      setLiderancas(liderancas.filter(l => l.id !== id));
      showSuccess('Liderança excluída com sucesso!');
    });
  };

  const handleGerarCracha = (lideranca) => {
    const pdfGenerator = new PDFGenerator();
    pdfGenerator.gerarCrachaLideranca(lideranca);
    showSuccess('Crachá gerado com sucesso!');
  };

  const handleImprimirListagem = () => {
    const pdfGen = new PDFGenerator();
    pdfGen.initDoc();
    pdfGen.addHeader('LISTAGEM DE LIDERANÇAS');
    
    const tableData = liderancasFiltradas.map(lid => [
      lid.codigo,
      lid.nomeSocial,
      lid.cpf,
      lid.uf,
      lid.cidade,
      lid.bairro,
      lid.telefone,
      lid.status
    ]);
    
    pdfGen.doc.autoTable({
      head: [['Código', 'Nome Social', 'CPF', 'UF', 'Cidade', 'Bairro', 'Telefone', 'Status']],
      body: tableData,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [10, 76, 83], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    
    pdfGen.addFooter();
    pdfGen.doc.save(`listagem-liderancas-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleImprimirFicha = (lideranca) => {
    const dadosFicha = {
      tipo: 'LOCAL',
      nome: lideranca.nomeSocial,
      cpf: lideranca.cpf,
      telefone: lideranca.telefone,
      endereco: {
        bairro: lideranca.bairro,
        cidade: lideranca.cidade,
        uf: lideranca.uf
      },
      status: lideranca.status,
      dataEmissao: new Date().toLocaleDateString('pt-BR')
    };
    
    const pdfGen = new PDFGenerator();
    pdfGen.gerarRelatorioLideranca(dadosFicha);
  };

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
                  Gerenciar Lideranças
                </h2>
                <p className="text-xs text-gray-600">Listagem e controle de lideranças</p>
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
            <div className="flex gap-2">
              <button
                onClick={() => window.location.href = '/cadastros/liderancas'}
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
                  placeholder="Nome, CPF, Cidade..."
                />
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
                onClick={() => setFiltro('')}
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
                <h2 className="font-bold text-gray-700">Listagem de Lideranças</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Quantidade de Líderes</span>
                <input
                  type="number"
                  value={liderancasFiltradas.length}
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
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Nome Social</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">CPF</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">UF</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Cidade</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Bairro</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Telefone</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Status</th>
                    <th className="px-4 py-2 text-center text-sm font-bold text-gray-700">Controles</th>
                  </tr>
                </thead>
                <tbody>
                  {liderancasPaginadas.map((lideranca, idx) => (
                    <tr key={lideranca.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm">{lideranca.codigo}</td>
                      <td className="px-4 py-3 text-sm font-medium">{lideranca.nomeSocial}</td>
                      <td className="px-4 py-3 text-sm">{lideranca.cpf}</td>
                      <td className="px-4 py-3 text-sm">{lideranca.uf}</td>
                      <td className="px-4 py-3 text-sm">{lideranca.cidade}</td>
                      <td className="px-4 py-3 text-sm">{lideranca.bairro}</td>
                      <td className="px-4 py-3 text-sm">{lideranca.telefone}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          lideranca.status === 'ATIVO' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {lideranca.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleImprimirFicha(lideranca)}
                            className="p-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                            title="Imprimir"
                          >
                            <FontAwesomeIcon icon={faPrint} />
                          </button>
                          <button
                            onClick={() => handleGerarCracha(lideranca)}
                            className="p-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                            title="Gerar Crachá"
                          >
                            <FontAwesomeIcon icon={faIdCard} />
                          </button>
                          <button
                            onClick={() => handleEditar(lideranca.id)}
                            className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            title="Editar"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            onClick={() => handleExcluir(lideranca.id)}
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
