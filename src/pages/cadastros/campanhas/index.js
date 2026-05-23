import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PDFGenerator from '@/utils/pdfGenerator';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import {
  faList, faPlus, faFilter, faPrint, faEdit, faTrash, faChevronLeft, faChevronRight,
  faAngleDoubleLeft, faAngleDoubleRight, faEye, faCalendarAlt, faMapMarkerAlt
} from '@fortawesome/free-solid-svg-icons';

export default function GerenciarCampanhas() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();

  const [campanhas, setCampanhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [status, setStatus] = useState('');
  const [localidade, setLocalidade] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(10);

  // Carregar campanhas ao montar
  useEffect(() => {
    carregarCampanhas();
  }, []);

  const carregarCampanhas = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtro) params.append('search', filtro);
      if (status) params.append('status', status);
      if (localidade) params.append('localidade', localidade);
      if (dataInicio) params.append('dataInicio', dataInicio);
      if (dataFim) params.append('dataFim', dataFim);

      const response = await fetch(`/api/cadastros/campanhas?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Erro ao carregar campanhas');
      }

      const data = await response.json();
      setCampanhas(data.data || []);
    } catch (error) {
      showError('Erro ao carregar campanhas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const campanhasFiltradas = campanhas.filter(campanha => {
    return true; // Filtros já aplicados na API
  });

  const totalPaginas = Math.ceil(campanhasFiltradas.length / itensPorPagina);
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const indiceFim = indiceInicio + itensPorPagina;
  const campanhasPaginadas = campanhasFiltradas.slice(indiceInicio, indiceFim);

  const handleInserir = () => {
    router.push('/cadastros/campanhas/novo');
  };

  const handleEditar = (id) => {
    router.push(`/cadastros/campanhas/${id}`);
  };

  const handleVisualizar = (campanha) => {
    // Construir conteúdo estruturado para o modal
    const resumoServicos = (campanha.campanhas_servicos || []).reduce(
      (acc, cs) => {
        acc.total += cs.quantidade || 0;
        acc.usados += cs.quantidade_usada || 0;
        acc.disponiveis += cs.quantidade_disponivel ?? Math.max((cs.quantidade || 0) - (cs.quantidade_usada || 0), 0);
        return acc;
      },
      { total: 0, usados: 0, disponiveis: 0 }
    );

    const conteudo = (
      <div className="space-y-3">
        <div>
          <span className="font-bold">Campanha:</span> {campanha.nome}
        </div>
        
        <div>
          <span className="font-bold">Local:</span> {campanha.local}
        </div>
        
        <div>
          <span className="font-bold">Data:</span> {new Date(campanha.data_campanha).toLocaleDateString('pt-BR')}
        </div>
        
        <div>
          <span className="font-bold">Horário:</span> {campanha.hora_inicio || '--:--'} às {campanha.hora_fim || '--:--'}
        </div>
        
        <div>
          <span className="font-bold">Status:</span> {campanha.status}
        </div>
        
        <div>
          <div className="font-bold mb-2">Lideranças:</div>
          {campanha.campanhas_liderancas && campanha.campanhas_liderancas.length > 0 ? (
            <ul className="list-disc list-inside space-y-1 ml-2">
              {campanha.campanhas_liderancas.map((cl, idx) => (
                <li key={idx}>{cl.liderancas.nome} ({cl.papel})</li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600 ml-2">Nenhuma liderança cadastrada</p>
          )}
        </div>
        
        <div>
          <div className="font-bold mb-2">Serviços:</div>
          {campanha.campanhas_servicos && campanha.campanhas_servicos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Serviço</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Disponíveis</th>
                  </tr>
                </thead>
                <tbody>
                  {campanha.campanhas_servicos.map((cs, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2 text-gray-700">{cs.categorias_servicos.nome}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{cs.quantidade || 0}</td>
                      <td className="px-3 py-2 text-right text-red-600 font-semibold">
                        {cs.quantidade_disponivel ?? Math.max((cs.quantidade || 0) - (cs.quantidade_usada || 0), 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-600 ml-2">Nenhum serviço cadastrado</p>
          )}
          {campanha.campanhas_servicos && campanha.campanhas_servicos.length > 0 && (
            <div className="mt-3 text-sm text-gray-700 ml-2">
              <span className="font-semibold">Resumo:</span> Total {resumoServicos.total} | Usados {resumoServicos.usados} | Disponíveis <span className="text-red-600 font-semibold">{resumoServicos.disponiveis}</span>
            </div>
          )}
        </div>
      </div>
    );

    showSuccess(conteudo, null, 'Detalhes da Campanha');
  };

  const handleExcluir = (id) => {
    showConfirm('Tem certeza que deseja excluir esta campanha?', async () => {
      try {
        const response = await fetch(`/api/cadastros/campanhas/${id}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new Error('Erro ao excluir campanha');
        }

        setCampanhas(campanhas.filter(c => c.id !== id));
        showSuccess('Campanha excluída com sucesso!');
      } catch (error) {
        showError('Erro ao excluir: ' + error.message);
      }
    });
  };

  const handleImprimirListagem = () => {
    const pdfGen = new PDFGenerator();
    pdfGen.initDoc();
    pdfGen.addHeader('LISTAGEM DE CAMPANHAS');

    const tableData = campanhasFiltradas.map(campanha => [
      campanha.id,
      campanha.nome,
      campanha.local,
      new Date(campanha.data_campanha).toLocaleDateString('pt-BR'),
      campanha.status || 'PLANEJAMENTO'
    ]);

    pdfGen.doc.autoTable({
      head: [['ID', 'Nome', 'Local', 'Data', 'Status']],
      body: tableData,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [10, 76, 83], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    pdfGen.addFooter();
    pdfGen.doc.save(`listagem-campanhas-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleLimparFiltros = () => {
    setFiltro('');
    setStatus('');
    setLocalidade('');
    setDataInicio('');
    setDataFim('');
    setPaginaAtual(1);
  };

  const aplicarFiltros = () => {
    setPaginaAtual(1);
    carregarCampanhas();
  };

  const getStatusColor = (status) => {
    const cores = {
      'PLANEJAMENTO': 'bg-blue-100 text-blue-800',
      'EXECUCAO': 'bg-amber-100 text-amber-800',
      'CONCLUIDA': 'bg-green-100 text-green-800',
      'CANCELADA': 'bg-red-100 text-red-800'
    };
    return cores[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Layout titulo="Gerenciar Campanhas">
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

        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Campanhas</h1>
            <p className="text-gray-600">Gerencie as campanhas de atendimento à população</p>
          </div>
          <button
            onClick={handleInserir}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2 shadow-lg transition-all"
          >
            <FontAwesomeIcon icon={faPlus} />
            Nova Campanha
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <FontAwesomeIcon icon={faFilter} className="text-teal-600 text-xl" />
            <h3 className="text-lg font-bold text-gray-800">Filtros</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Busca */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Buscar Campanha
              </label>
              <input
                type="text"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Nome ou descrição..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Localidade */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-2" />
                Localidade
              </label>
              <input
                type="text"
                value={localidade}
                onChange={(e) => setLocalidade(e.target.value)}
                placeholder="Bairro, Região..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                <option value="PLANEJAMENTO">📋 Planejamento</option>
                <option value="EXECUCAO">🚀 Em Execução</option>
                <option value="CONCLUIDA">✅ Concluída</option>
                <option value="CANCELADA">❌ Cancelada</option>
              </select>
            </div>

            {/* Data Início */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <FontAwesomeIcon icon={faCalendarAlt} className="mr-2" />
                De
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Data Fim */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Até</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={aplicarFiltros}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-6 rounded-lg transition-all"
            >
              <FontAwesomeIcon icon={faFilter} className="mr-2" />
              Aplicar Filtros
            </button>
            <button
              onClick={handleLimparFiltros}
              className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg transition-all"
            >
              Limpar Filtros
            </button>
            <button
              onClick={handleImprimirListagem}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-all ml-auto"
            >
              <FontAwesomeIcon icon={faPrint} className="mr-2" />
              Imprimir
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-teal-600 text-white">
                  <th className="px-6 py-3 text-left text-sm font-semibold">#</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Nome</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Local</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Data</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Lideranças</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Serviços</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-4 text-center text-gray-600">
                      Carregando campanhas...
                    </td>
                  </tr>
                ) : campanhasPaginadas.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-4 text-center text-gray-600">
                      Nenhuma campanha encontrada
                    </td>
                  </tr>
                ) : (
                  campanhasPaginadas.map((campanha, index) => (
                    <tr key={campanha.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-600">{campanha.id.slice(0, 8)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">{campanha.nome}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">📍 {campanha.local}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(campanha.data_campanha).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <span className="badge badge-sm badge-info">
                          {campanha.campanhas_liderancas?.length || 0} líderes
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {(() => {
                          const resumo = (campanha.campanhas_servicos || []).reduce(
                            (acc, cs) => {
                              acc.total += cs.quantidade || 0;
                              acc.usados += cs.quantidade_usada || 0;
                              acc.disponiveis += cs.quantidade_disponivel ?? Math.max((cs.quantidade || 0) - (cs.quantidade_usada || 0), 0);
                              return acc;
                            },
                            { total: 0, usados: 0, disponiveis: 0 }
                          );

                          if (!campanha.campanhas_servicos || campanha.campanhas_servicos.length === 0) {
                            return <span className="text-gray-600">-</span>;
                          }

                          return (
                            <span className="inline-flex items-center gap-2">
                              <span className="text-gray-700">{resumo.disponiveis}/{resumo.total}</span>
                              <span className="text-xs text-gray-500">(usados {resumo.usados})</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(campanha.status)}`}>
                          {campanha.status || 'PLANEJAMENTO'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleVisualizar(campanha)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Visualizar"
                          >
                            <FontAwesomeIcon icon={faEye} />
                          </button>
                          <button
                            onClick={() => handleEditar(campanha.id)}
                            className="text-amber-600 hover:text-amber-800 transition-colors"
                            title="Editar"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            onClick={() => handleExcluir(campanha.id)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                            title="Excluir"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
              <span className="text-sm text-gray-600">
                Exibindo {indiceInicio + 1} a {Math.min(indiceFim, campanhasFiltradas.length)} de {campanhasFiltradas.length} campanhas
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() => setPaginaAtual(1)}
                  disabled={paginaAtual === 1}
                  className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50"
                  title="Primeira página"
                >
                  <FontAwesomeIcon icon={faAngleDoubleLeft} />
                </button>
                <button
                  onClick={() => setPaginaAtual(Math.max(1, paginaAtual - 1))}
                  disabled={paginaAtual === 1}
                  className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50"
                  title="Página anterior"
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>

                {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(num => (
                  <button
                    key={num}
                    onClick={() => setPaginaAtual(num)}
                    className={`px-3 py-1 rounded transition-colors ${
                      paginaAtual === num
                        ? 'bg-teal-600 text-white'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}

                <button
                  onClick={() => setPaginaAtual(Math.min(totalPaginas, paginaAtual + 1))}
                  disabled={paginaAtual === totalPaginas}
                  className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50"
                  title="Próxima página"
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
                <button
                  onClick={() => setPaginaAtual(totalPaginas)}
                  disabled={paginaAtual === totalPaginas}
                  className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50"
                  title="Última página"
                >
                  <FontAwesomeIcon icon={faAngleDoubleRight} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
