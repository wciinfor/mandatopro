import { useState } from 'react';
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
  
  const [atendimentos, setAtendimentos] = useState([
    {
      id: 1,
      codigo: 1,
      tipoAtendimento: 'ACAO_SOCIAL',
      eleitor: 'JOÃO DA SILVA SANTOS',
      eleitorCpf: '123.456.789-00',
      dataAtendimento: '2025-11-20',
      status: 'REALIZADO',
      statusPedido: 'PENDENTE',
      notificacao: 'EMAIL'
    }
  ]);
  const [filtro, setFiltro] = useState('');
  const [situacao, setSituacao] = useState('REALIZADO');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(10);

  const atendimentosFiltrados = atendimentos.filter(at => {
    const matchFiltro = filtro === '' || 
      at.eleitor.toLowerCase().includes(filtro.toLowerCase()) ||
      at.eleitorCpf.includes(filtro) ||
      at.tipoAtendimento.toLowerCase().includes(filtro.toLowerCase());
    const matchSituacao = situacao === 'REALIZADO' ? at.status === 'REALIZADO' : at.status !== 'REALIZADO';
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
    router.push(`/cadastros/atendimentos/${id}/editar`);
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
      at.tipoAtendimento,
      at.eleitor,
      at.dataAtendimento,
      at.status,
      at.statusPedido
    ]);
    
    pdfGen.doc.autoTable({
      head: [['Código', 'Tipo', 'Eleitor', 'Data', 'Status', 'Pedido']],
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
                <option value="REALIZADO">REALIZADO</option>
                <option value="PENDENTE">PENDENTE</option>
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
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Código</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Tipo</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Eleitor</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">CPF</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Data</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Pedido</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {atendimentosPaginados.map((atendimento, idx) => (
                  <tr key={atendimento.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-teal-50 transition`}>
                    <td className="px-4 py-3 text-sm">{atendimento.codigo}</td>
                    <td className="px-4 py-3 text-sm font-medium">{atendimento.tipoAtendimento}</td>
                    <td className="px-4 py-3 text-sm">{atendimento.eleitor}</td>
                    <td className="px-4 py-3 text-sm">{atendimento.eleitorCpf}</td>
                    <td className="px-4 py-3 text-sm">{new Date(atendimento.dataAtendimento).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        atendimento.status === 'REALIZADO' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {atendimento.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        atendimento.statusPedido === 'RECEBIDO'
                          ? 'bg-green-100 text-green-800'
                          : atendimento.statusPedido === 'ENVIADO'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {atendimento.statusPedido}
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
