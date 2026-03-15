import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faList, faPlus, faEdit, faTrash, faMoneyBillWave, faCalendarAlt, faUser, faFilePdf, faFileExcel
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import ProtectedRoute from '@/components/ProtectedRoute';
import { MODULES } from '@/utils/permissions';

export default function Lancamentos() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;

  const [filtro, setFiltro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('TODOS');
  const [statusFiltro, setStatusFiltro] = useState('TODOS');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  useEffect(() => {
    carregarLancamentos();
  }, [filtro, tipoFiltro, statusFiltro, dataInicio, dataFim, paginaAtual]);

  const carregarLancamentos = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('limit', String(itensPorPagina));
      params.set('offset', String((paginaAtual - 1) * itensPorPagina));
      if (filtro) params.set('search', filtro);
      if (tipoFiltro && tipoFiltro !== 'TODOS') params.set('tipo', tipoFiltro);
      if (statusFiltro && statusFiltro !== 'TODOS') params.set('status', statusFiltro);
      if (dataInicio) params.set('data_from', dataInicio);
      if (dataFim) params.set('data_to', dataFim);

      const usuario = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('usuario') || 'null')
        : null;

      const response = await fetch(`/api/financeiro/lancamentos?${params.toString()}`, {
        headers: {
          usuario: usuario ? JSON.stringify(usuario) : ''
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Erro ao carregar lancamentos');
      }

      setLancamentos(data.data || []);
      setTotalRegistros(data.total || 0);
    } catch (error) {
      showError('Erro ao carregar lancamentos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const lancamentosFiltrados = lancamentos;

  const totalLancamentos = lancamentosFiltrados.reduce((acc, l) => acc + Number(l.valor || 0), 0);
  const totalConfirmado = lancamentosFiltrados.filter(l => l.status === 'CONFIRMADO').reduce((acc, l) => acc + Number(l.valor || 0), 0);
  const totalPendente = lancamentosFiltrados.filter(l => l.status === 'PENDENTE').reduce((acc, l) => acc + Number(l.valor || 0), 0);
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / itensPorPagina));

  const irParaPagina = (pagina) => {
    if (pagina < 1 || pagina > totalPaginas) return;
    setPaginaAtual(pagina);
  };

  const formatarValor = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const formatarData = (data) => {
    if (!data) return '-';
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const handleInserir = () => {
    router.push('/financeiro/lancamentos/novo');
  };

  const handleEditar = (id) => {
    router.push(`/financeiro/lancamentos/${id}`);
  };

  const handleExcluir = (id) => {
    showConfirm('Tem certeza que deseja excluir este lançamento?', () => {
      excluirLancamento(id);
    });
  };

  const excluirLancamento = async (id) => {
    try {
      const usuario = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('usuario') || 'null')
        : null;
      const response = await fetch(`/api/financeiro/lancamentos/${id}`, {
        method: 'DELETE',
        headers: {
          usuario: usuario ? JSON.stringify(usuario) : ''
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Erro ao excluir lancamento');
      }
      showSuccess('Lancamento excluido com sucesso!');
      carregarLancamentos();
    } catch (error) {
      showError('Erro ao excluir lancamento: ' + error.message);
    }
  };

  const handleGerarRelatorio = (formato) => {
    showSuccess(`Relatório ${formato} em desenvolvimento`);
  };

  return (
    <ProtectedRoute module={MODULES.FINANCEIRO}>
    <Layout titulo="Lançamentos (Receitas)">
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

      {/* Cards Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Lançamentos</p>
              <p className="text-2xl font-bold text-blue-600">{formatarValor(totalLancamentos)}</p>
            </div>
            <FontAwesomeIcon icon={faMoneyBillWave} className="text-4xl text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Confirmados</p>
              <p className="text-2xl font-bold text-green-600">{formatarValor(totalConfirmado)}</p>
            </div>
            <FontAwesomeIcon icon={faMoneyBillWave} className="text-4xl text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600">{formatarValor(totalPendente)}</p>
            </div>
            <FontAwesomeIcon icon={faMoneyBillWave} className="text-4xl text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleInserir}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span className="hidden md:inline">Novo Lançamento</span>
          </button>
          <button
            onClick={() => handleGerarRelatorio('PDF')}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            <FontAwesomeIcon icon={faFilePdf} />
            <span className="hidden md:inline">PDF</span>
          </button>
          <button
            onClick={() => handleGerarRelatorio('Excel')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            <FontAwesomeIcon icon={faFileExcel} />
            <span className="hidden md:inline">Excel</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              type="text"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Código, doador..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todos</option>
              <option value="DOACAO">Doação</option>
              <option value="EMENDA">Emenda</option>
              <option value="OUTROS">Outros</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todos</option>
              <option value="CONFIRMADO">Confirmado</option>
              <option value="PENDENTE">Pendente</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Carregando lancamentos...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doador/Origem</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lancamentosFiltrados.map((lanc) => (
                  <tr key={lanc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {lanc.codigo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <FontAwesomeIcon icon={faCalendarAlt} className="mr-2 text-gray-400" />
                      {formatarData(lanc.data_lancamento)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        lanc.tipo === 'DOACAO' ? 'bg-blue-100 text-blue-800' :
                        lanc.tipo === 'EMENDA' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {lanc.tipo}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <FontAwesomeIcon icon={faUser} className="mr-2 text-gray-400" />
                      {lanc.parceiro_nome || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {lanc.categoria}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                      {formatarValor(lanc.valor)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        lanc.status === 'CONFIRMADO' ? 'bg-green-100 text-green-800' :
                        lanc.status === 'PENDENTE' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {lanc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditar(lanc.id)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                        title="Editar"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        onClick={() => handleExcluir(lanc.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Excluir"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && lancamentosFiltrados.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum lancamento encontrado
          </div>
        )}
      </div>

      {!loading && totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => irParaPagina(paginaAtual - 1)}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded disabled:opacity-50"
            disabled={paginaAtual <= 1}
          >
            Anterior
          </button>
          <span className="text-sm text-gray-600">
            Pagina {paginaAtual} de {totalPaginas}
          </span>
          <button
            onClick={() => irParaPagina(paginaAtual + 1)}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded disabled:opacity-50"
            disabled={paginaAtual >= totalPaginas}
          >
            Proxima
          </button>
        </div>
      )}
    </Layout>

    </ProtectedRoute>
  );
}
