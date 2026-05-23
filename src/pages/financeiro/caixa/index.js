import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWallet, faArrowUp, faArrowDown, faChartLine, faFilePdf, faFileExcel
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import ProtectedRoute from '@/components/ProtectedRoute';
import { MODULES } from '@/utils/permissions';

export default function CaixaSaldo() {
  const { modalState, closeModal, showSuccess, showError } = useModal();
  
  const [periodo, setPeriodo] = useState('MES_ATUAL');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [resumo, setResumo] = useState({
    total_receitas: 0,
    total_despesas: 0,
    saldo_liquido: 0,
    total_pendente: 0
  });
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;
  const [totalRegistros, setTotalRegistros] = useState(0);

  useEffect(() => {
    carregarCaixa();
  }, [periodo, dataInicio, dataFim, paginaAtual]);

  const formatarDataISO = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const obterRangePeriodo = () => {
    const hoje = new Date();
    if (periodo === 'PERSONALIZADO') {
      return {
        data_from: dataInicio || '',
        data_to: dataFim || ''
      };
    }
    if (periodo === 'MES_ATUAL') {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      return { data_from: formatarDataISO(inicio), data_to: formatarDataISO(fim) };
    }
    if (periodo === 'MES_ANTERIOR') {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      return { data_from: formatarDataISO(inicio), data_to: formatarDataISO(fim) };
    }
    if (periodo === 'TRIMESTRE') {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
      return { data_from: formatarDataISO(inicio), data_to: formatarDataISO(hoje) };
    }
    if (periodo === 'ANO') {
      const inicio = new Date(hoje.getFullYear(), 0, 1);
      const fim = new Date(hoje.getFullYear(), 11, 31);
      return { data_from: formatarDataISO(inicio), data_to: formatarDataISO(fim) };
    }
    return { data_from: '', data_to: '' };
  };

  const carregarCaixa = async () => {
    try {
      setLoading(true);
      const { data_from, data_to } = obterRangePeriodo();
      const params = new URLSearchParams();
      params.set('limit', String(itensPorPagina));
      params.set('offset', String((paginaAtual - 1) * itensPorPagina));
      if (data_from) params.set('data_from', data_from);
      if (data_to) params.set('data_to', data_to);

      const usuario = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('usuario') || 'null')
        : null;

      const response = await fetch(`/api/financeiro/caixa?${params.toString()}`, {
        headers: {
          usuario: usuario ? JSON.stringify(usuario) : ''
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Erro ao carregar caixa');
      }
      setResumo(data.resumo || { total_receitas: 0, total_despesas: 0, saldo_liquido: 0, total_pendente: 0 });
      setMovimentacoes(data.movimentos || []);
      setTotalRegistros(data.total || 0);
    } catch (error) {
      showError('Erro ao carregar caixa: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

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
    return new Date(String(data).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const handleGerarRelatorio = (formato) => {
    showSuccess(`Relatório ${formato} em desenvolvimento`);
  };

  return (
    <ProtectedRoute module={MODULES.FINANCEIRO}>
    <Layout titulo="Caixa / Saldo">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-teal-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Saldo Atual</p>
              <p className="text-2xl font-bold text-teal-600">{formatarValor(resumo.saldo_liquido)}</p>
            </div>
            <FontAwesomeIcon icon={faWallet} className="text-4xl text-teal-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Receitas</p>
              <p className="text-2xl font-bold text-green-600">{formatarValor(resumo.total_receitas)}</p>
            </div>
            <FontAwesomeIcon icon={faArrowUp} className="text-4xl text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Despesas</p>
              <p className="text-2xl font-bold text-red-600">{formatarValor(resumo.total_despesas)}</p>
            </div>
            <FontAwesomeIcon icon={faArrowDown} className="text-4xl text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Saldo Líquido</p>
              <p className="text-2xl font-bold text-blue-600">{formatarValor(resumo.saldo_liquido)}</p>
            </div>
            <FontAwesomeIcon icon={faChartLine} className="text-4xl text-blue-500" />
          </div>
        </div>
      </div>

      {/* Botões e Filtros */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="MES_ATUAL">Mês Atual</option>
              <option value="MES_ANTERIOR">Mês Anterior</option>
              <option value="TRIMESTRE">Último Trimestre</option>
              <option value="ANO">Ano Atual</option>
              <option value="PERSONALIZADO">Personalizado</option>
            </select>
          </div>

          {periodo === 'PERSONALIZADO' && (
            <>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div className="flex gap-2">
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
      </div>

      {/* Extrato de Movimentações */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Extrato de Movimentacoes</h3>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Carregando movimentacoes...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descricao</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {movimentacoes.map((mov) => (
                  <tr key={`${mov.origem}-${mov.id}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatarData(mov.data_movimento)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mov.direcao === 'ENTRADA' ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">
                          <FontAwesomeIcon icon={faArrowUp} className="mr-1" />
                          ENTRADA
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full">
                          <FontAwesomeIcon icon={faArrowDown} className="mr-1" />
                          SAIDA
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {mov.descricao || mov.parceiro_nome || '-'}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-semibold ${
                      mov.direcao === 'ENTRADA' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatarValor(mov.valor)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                      {formatarValor(mov.saldo_atual)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && movimentacoes.length === 0 && (
          <div className="text-center py-8 text-gray-500">Nenhuma movimentacao encontrada</div>
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
