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

export default function GerenciarFuncionarios() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  const [usuario, setUsuario] = useState(null);
  const [moduloAtivo, setModuloAtivo] = useState('Cadastros - Funcionários');
  const [menusAbertos, setMenusAbertos] = useState({ Cadastros: true });
  const [sidebarAberto, setSidebarAberto] = useState(false);
  
  const [funcionarios, setFuncionarios] = useState([
    {
      id: 1,
      codigo: 1,
      nome: 'MARIA OLIVEIRA SANTOS',
      cpf: '98765432100',
      cargo: 'Assessor Parlamentar',
      departamento: 'Gabinete',
      telefone: '11987654321',
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

  const funcionariosFiltrados = funcionarios.filter(func => {
    const matchFiltro = filtro === '' || 
      func.nome.toLowerCase().includes(filtro.toLowerCase()) ||
      func.cpf.includes(filtro) ||
      func.cargo.toLowerCase().includes(filtro.toLowerCase());
    const matchSituacao = situacao === 'ATIVO' ? func.status === 'ATIVO' : func.status !== 'ATIVO';
    return matchFiltro && matchSituacao;
  });

  const totalPaginas = Math.ceil(funcionariosFiltrados.length / itensPorPagina);
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const indiceFim = indiceInicio + itensPorPagina;
  const funcionariosPaginados = funcionariosFiltrados.slice(indiceInicio, indiceFim);

  const handleInserir = () => {
    router.push('/cadastros/funcionarios/novo');
  };

  const handleEditar = (id) => {
    router.push(`/cadastros/funcionarios/${id}`);
  };

  const handleExcluir = (id) => {
    showConfirm('Tem certeza que deseja excluir este funcionário?', () => {
      setFuncionarios(funcionarios.filter(f => f.id !== id));
      showSuccess('Funcionário excluído com sucesso!');
    });
  };

  const handleGerarCracha = (funcionario) => {
    const pdfGenerator = new PDFGenerator();
    pdfGenerator.gerarCrachaFuncionario(funcionario);
    showSuccess('Crachá gerado com sucesso!');
  };

  const handleImprimirListagem = () => {
    const pdfGen = new PDFGenerator();
    pdfGen.initDoc();
    pdfGen.addHeader('LISTAGEM DE FUNCIONÁRIOS');
    
    const tableData = funcionariosFiltrados.map(func => [
      func.codigo,
      func.nome,
      func.cpf,
      func.cargo,
      func.departamento,
      func.telefone,
      func.status
    ]);
    
    pdfGen.doc.autoTable({
      head: [['Código', 'Nome', 'CPF', 'Cargo', 'Departamento', 'Telefone', 'Status']],
      body: tableData,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [10, 76, 83], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    
    pdfGen.addFooter();
    pdfGen.doc.save(`listagem-funcionarios-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleImprimirFicha = (funcionario) => {
    const pdfGen = new PDFGenerator();
    pdfGen.initDoc();
    pdfGen.addHeader('FICHA DE FUNCIONÁRIO');
    
    let yPos = 60;
    pdfGen.doc.setFontSize(12);
    pdfGen.doc.text(`Código: ${funcionario.codigo}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Nome: ${funcionario.nome}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`CPF: ${funcionario.cpf}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Cargo: ${funcionario.cargo}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Departamento: ${funcionario.departamento}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Telefone: ${funcionario.telefone}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Status: ${funcionario.status}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 20, yPos);
    
    pdfGen.addFooter();
    pdfGen.doc.save(`ficha-funcionario-${funcionario.codigo}.pdf`);
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
                  Gerenciar Funcionários
                </h2>
                <p className="text-xs text-gray-600">Listagem e controle de funcionários</p>
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
                onClick={() => window.location.href = '/cadastros/funcionarios'}
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
                  placeholder="Nome, CPF, Cargo..."
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
                <h2 className="font-bold text-gray-700">Listagem de Funcionários</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Quantidade de Funcionários</span>
                <input
                  type="number"
                  value={funcionariosFiltrados.length}
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
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Nome</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">CPF</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Cargo</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Departamento</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Telefone</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Status</th>
                    <th className="px-4 py-2 text-center text-sm font-bold text-gray-700">Controles</th>
                  </tr>
                </thead>
                <tbody>
                  {funcionariosPaginados.map((funcionario, idx) => (
                    <tr key={funcionario.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm">{funcionario.codigo}</td>
                      <td className="px-4 py-3 text-sm font-medium">{funcionario.nome}</td>
                      <td className="px-4 py-3 text-sm">{funcionario.cpf}</td>
                      <td className="px-4 py-3 text-sm">{funcionario.cargo}</td>
                      <td className="px-4 py-3 text-sm">{funcionario.departamento}</td>
                      <td className="px-4 py-3 text-sm">{funcionario.telefone}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          funcionario.status === 'ATIVO' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {funcionario.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleImprimirFicha(funcionario)}
                            className="p-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                            title="Imprimir"
                          >
                            <FontAwesomeIcon icon={faPrint} />
                          </button>
                          <button
                            onClick={() => handleGerarCracha(funcionario)}
                            className="p-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                            title="Gerar Crachá"
                          >
                            <FontAwesomeIcon icon={faIdCard} />
                          </button>
                          <button
                            onClick={() => handleEditar(funcionario.id)}
                            className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            title="Editar"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            onClick={() => handleExcluir(funcionario.id)}
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
