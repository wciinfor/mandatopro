import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PDFGenerator from '@/utils/pdfGenerator';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import {
  faList, faPlus, faFilter, faPrint, faEdit, faTrash, faChevronLeft, faChevronRight, 
  faAngleDoubleLeft, faAngleDoubleRight, faEye
} from '@fortawesome/free-solid-svg-icons';

export default function GerenciarAtendimentos() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  
  const [atendimentos, setAtendimentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [situacao, setSituacao] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(10);

  // Buscar atendimentos do Supabase
  useEffect(() => {
    carregarAtendimentos();
  }, []);

  const carregarAtendimentos = async () => {
    try {
      setCarregando(true);
      const response = await fetch('/api/cadastros/atendimentos');
      const data = await response.json();
      setAtendimentos(data || []);
    } catch (error) {
      console.error('Erro ao carregar atendimentos:', error);
      showError('Erro ao carregar atendimentos do banco de dados');
    } finally {
      setCarregando(false);
    }
  };

  const atendimentosFiltrados = atendimentos.filter(at => {
    const matchFiltro = filtro === '' || 
      (at.eleitores?.nome?.toLowerCase() || '').includes(filtro.toLowerCase()) ||
      (at.eleitores?.cpf || '').includes(filtro) ||
      (at.tipo_atendimento?.toLowerCase() || '').includes(filtro.toLowerCase()) ||
      (at.protocolo?.toLowerCase() || '').includes(filtro.toLowerCase());
    const matchSituacao = situacao === '' || at.status === situacao;
    return matchFiltro && matchSituacao;
  });

  const totalPaginas = Math.ceil(atendimentosFiltrados.length / itensPorPagina);
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const indiceFim = indiceInicio + itensPorPagina;
  const atendimentosPaginados = atendimentosFiltrados.slice(indiceInicio, indiceFim);

  const handleInserir = () => {
    router.push('/cadastros/atendimentos/novo');
  };

  const handleVisualizar = (id) => {
    router.push(`/cadastros/atendimentos/${id}`);
  };

  const handleEditar = (id) => {
    router.push(`/cadastros/atendimentos/${id}`);
  };

  const handleExcluir = (id) => {
    showConfirm('Tem certeza que deseja excluir este atendimento?', async () => {
      try {
        const response = await fetch(`/api/cadastros/atendimentos/${id}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          showSuccess('Atendimento excluído com sucesso!');
          carregarAtendimentos(); // Recarregar lista
        } else {
          showError('Erro ao excluir atendimento');
        }
      } catch (error) {
        console.error('Erro:', error);
        showError('Erro ao excluir atendimento');
      }
    });
  };

  const handleImprimirListagem = () => {
    const pdfGen = new PDFGenerator();
    pdfGen.initDoc();
    pdfGen.addHeader('LISTAGEM DE ATENDIMENTOS');
    
    const tableData = atendimentosFiltrados.map(at => [
      at.protocolo,
      at.tipo_atendimento || '-',
      at.eleitores?.nome || '-',
      new Date(at.data_atendimento).toLocaleDateString('pt-BR'),
      at.status || '-'
    ]);
    
    pdfGen.doc.autoTable({
      head: [['Protocolo', 'Tipo', 'Eleitor', 'Data', 'Status']],
      body: tableData,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [10, 76, 83], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    
    pdfGen.addFooter();
    pdfGen.doc.save(`listagem-atendimentos-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <Layout titulo="Gerenciar Atendimentos">
      <div className="max-w-7xl mx-auto">
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
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-3">
            <button
              onClick={handleInserir}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
            >
              <FontAwesomeIcon icon={faPlus} />
              Inserir
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FontAwesomeIcon icon={faFilter} className="text-teal-600 text-lg" />
            <h2 className="text-lg font-bold text-gray-700">Filtros de Busca</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                BUSCAR POR ELEITOR, CPF, TIPO...
              </label>
              <input
                type="text"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Digite sua busca..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SITUAÇÃO
              </label>
              <select
                value={situacao}
                onChange={(e) => setSituacao(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">TODAS</option>
                <option value="REALIZADO">REALIZADO</option>
                <option value="AGENDADO">AGENDADO</option>
                <option value="CANCELADO">CANCELADO</option>
              </select>
            </div>
            <button
              onClick={() => setFiltro('')}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium"
            >
              LIMPAR FILTROS
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faList} className="text-teal-600 text-lg" />
              <h2 className="text-lg font-bold text-gray-700">Listagem de Atendimentos</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Total:</span>
                <span className="font-bold text-lg text-teal-600">{atendimentosFiltrados.length}</span>
              </div>
              <button
                onClick={handleImprimirListagem}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faPrint} />
                IMPRIMIR
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {carregando ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Carregando atendimentos...</p>
              </div>
            ) : atendimentosPaginados.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Nenhum atendimento encontrado</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Protocolo</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Eleitor</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">CPF</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Tipo</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Data</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {atendimentosPaginados.map((atendimento, idx) => (
                    <tr key={atendimento.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-teal-50 transition`}>
                      <td className="px-4 py-3 text-sm font-mono">{atendimento.id}</td>
                      <td className="px-4 py-3 text-sm font-medium">{atendimento.protocolo}</td>
                      <td className="px-4 py-3 text-sm">{atendimento.eleitores?.nome || '-'}</td>
                      <td className="px-4 py-3 text-sm">{atendimento.eleitores?.cpf || '-'}</td>
                      <td className="px-4 py-3 text-sm">{atendimento.tipo_atendimento || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(atendimento.data_atendimento).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          atendimento.status === 'REALIZADO' 
                            ? 'bg-green-100 text-green-800' 
                            : atendimento.status === 'AGENDADO'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {atendimento.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleVisualizar(atendimento.id)}
                            className="p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                            title="Visualizar"
                          >
                            <FontAwesomeIcon icon={faEye} />
                          </button>
                          <button
                            onClick={() => handleEditar(atendimento.id)}
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            title="Editar"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            onClick={() => handleExcluir(atendimento.id)}
                            className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
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
            )}
          </div>

          {/* Paginação */}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Página <span className="font-bold">{paginaAtual}</span> de <span className="font-bold">{totalPaginas || 1}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPaginaAtual(1)}
                disabled={paginaAtual === 1}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                title="Primeira página"
              >
                <FontAwesomeIcon icon={faAngleDoubleLeft} />
              </button>
              <button
                onClick={() => setPaginaAtual(Math.max(1, paginaAtual - 1))}
                disabled={paginaAtual === 1}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                title="Página anterior"
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <span className="px-4 py-2 bg-teal-100 rounded-lg font-semibold text-teal-700">{paginaAtual}</span>
              <button
                onClick={() => setPaginaAtual(Math.min(totalPaginas, paginaAtual + 1))}
                disabled={paginaAtual === totalPaginas}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                title="Próxima página"
              >
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
              <button
                onClick={() => setPaginaAtual(totalPaginas)}
                disabled={paginaAtual === totalPaginas}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                title="Última página"
              >
                <FontAwesomeIcon icon={faAngleDoubleRight} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
