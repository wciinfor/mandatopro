import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PDFGenerator from '@/utils/pdfGenerator';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import {
  faList, faPlus, faFilter, faPrint, faEdit, faTrash, faChevronLeft, faChevronRight, 
  faAngleDoubleLeft, faAngleDoubleRight
} from '@fortawesome/free-solid-svg-icons';

export default function GerenciarEleitores() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  const [usuario, setUsuario] = useState(null);
  const [moduloAtivo, setModuloAtivo] = useState('Cadastros - Eleitores');
  const [menusAbertos, setMenusAbertos] = useState({ Cadastros: true });
  const [sidebarAberto, setSidebarAberto] = useState(false);
  
  const [eleitores, setEleitores] = useState([
    {
      id: 1,
      codigo: 1,
      nome: 'JOÃO DA SILVA SANTOS',
      cpf: '12345678900',
      tituloEleitoral: '123456789012',
      situacaoTSE: 'ATIVO',
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

  const eleitoresFiltrados = eleitores.filter(el => {
    const matchFiltro = filtro === '' || 
      el.nome.toLowerCase().includes(filtro.toLowerCase()) ||
      el.cpf.includes(filtro) ||
      el.tituloEleitoral.includes(filtro);
    const matchSituacao = situacao === 'ATIVO' ? el.status === 'ATIVO' : el.status !== 'ATIVO';
    return matchFiltro && matchSituacao;
  });

  const totalPaginas = Math.ceil(eleitoresFiltrados.length / itensPorPagina);
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const indiceFim = indiceInicio + itensPorPagina;
  const eleitoresPaginados = eleitoresFiltrados.slice(indiceInicio, indiceFim);

  const handleInserir = () => {
    router.push('/cadastros/eleitores/novo');
  };

  const handleEditar = (id) => {
    router.push(`/cadastros/eleitores/${id}`);
  };

  const handleExcluir = (id) => {
    showConfirm('Tem certeza que deseja excluir este eleitor?', () => {
      setEleitores(eleitores.filter(e => e.id !== id));
      showSuccess('Eleitor excluído com sucesso!');
    });
  };

  const handleImprimirListagem = () => {
    const pdfGen = new PDFGenerator();
    pdfGen.initDoc();
    pdfGen.addHeader('LISTAGEM DE ELEITORES');
    
    const tableData = eleitoresFiltrados.map(el => [
      el.codigo,
      el.nome,
      el.cpf,
      el.tituloEleitoral,
      el.situacaoTSE,
      el.telefone,
      el.status
    ]);
    
    pdfGen.doc.autoTable({
      head: [['Código', 'Nome', 'CPF', 'Título Eleitoral', 'Situação TSE', 'Telefone', 'Status']],
      body: tableData,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [10, 76, 83], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    
    pdfGen.addFooter();
    pdfGen.doc.save(`listagem-eleitores-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleImprimirFicha = (eleitor) => {
    const dadosFicha = {
      nome: eleitor.nome,
      cpf: eleitor.cpf,
      tituloEleitoral: eleitor.tituloEleitoral,
      situacaoTSE: eleitor.situacaoTSE,
      telefone: eleitor.telefone,
      status: eleitor.status,
      dataEmissao: new Date().toLocaleDateString('pt-BR')
    };
    
    const pdfGen = new PDFGenerator();
    pdfGen.gerarRelatorioEleitor(dadosFicha);
  };

  return (
    <Layout titulo="Gerenciar Eleitores">
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

      {/* Botões de Ação */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => window.location.href = '/cadastros/eleitores'}
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
                  placeholder="Nome, CPF, Título..."
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
                <h2 className="font-bold text-gray-700">Listagem de Eleitores</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Quantidade de Eleitores</span>
                <input
                  type="number"
                  value={eleitoresFiltrados.length}
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
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Título Eleitoral</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Situação TSE</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Telefone</th>
                    <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Status</th>
                    <th className="px-4 py-2 text-center text-sm font-bold text-gray-700">Controles</th>
                  </tr>
                </thead>
                <tbody>
                  {eleitoresPaginados.map((eleitor, idx) => (
                    <tr key={eleitor.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm">{eleitor.codigo}</td>
                      <td className="px-4 py-3 text-sm font-medium">{eleitor.nome}</td>
                      <td className="px-4 py-3 text-sm">{eleitor.cpf}</td>
                      <td className="px-4 py-3 text-sm">{eleitor.tituloEleitoral}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          eleitor.situacaoTSE === 'ATIVO' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {eleitor.situacaoTSE}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{eleitor.telefone}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          eleitor.status === 'ATIVO' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {eleitor.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleImprimirFicha(eleitor)}
                            className="p-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                            title="Imprimir"
                          >
                            <FontAwesomeIcon icon={faPrint} />
                          </button>
                          <button
                            onClick={() => handleEditar(eleitor.id)}
                            className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            title="Editar"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            onClick={() => handleExcluir(eleitor.id)}
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
    </Layout>
  );
}
