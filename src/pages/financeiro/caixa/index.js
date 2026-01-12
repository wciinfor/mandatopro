import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWallet, faArrowUp, faArrowDown, faChartLine, faFilePdf, faFileExcel
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';

export default function CaixaSaldo() {
  const { modalState, closeModal, showSuccess } = useModal();
  
  const [periodo, setPeriodo] = useState('MES_ATUAL');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Dados de exemplo
  const saldoAtual = 72500.00;
  const totalReceitas = 158000.00;
  const totalDespesas = 93800.00;
  const saldoPendente = 8500.00;

  const movimentacoes = [
    { id: 1, data: '2024-11-20', tipo: 'ENTRADA', descricao: 'Doação - Maria Costa', valor: 3000.00, saldo: 72500.00 },
    { id: 2, data: '2024-11-18', tipo: 'SAIDA', descricao: 'Pagamento Buffet & Eventos', valor: -1800.00, saldo: 69500.00 },
    { id: 3, data: '2024-11-18', tipo: 'ENTRADA', descricao: 'Repasse Emenda 2024-001', valor: 150000.00, saldo: 71300.00 },
    { id: 4, data: '2024-11-15', tipo: 'ENTRADA', descricao: 'Doação - João Silva', valor: 5000.00, saldo: -78700.00 },
    { id: 5, data: '2024-11-10', tipo: 'SAIDA', descricao: 'Gráfica Digital Ltda', valor: -2500.00, saldo: -83700.00 }
  ];

  const formatarValor = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const formatarData = (data) => {
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const handleGerarRelatorio = (formato) => {
    showSuccess(`Relatório ${formato} em desenvolvimento`);
  };

  return (
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
              <p className="text-2xl font-bold text-teal-600">{formatarValor(saldoAtual)}</p>
            </div>
            <FontAwesomeIcon icon={faWallet} className="text-4xl text-teal-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Receitas</p>
              <p className="text-2xl font-bold text-green-600">{formatarValor(totalReceitas)}</p>
            </div>
            <FontAwesomeIcon icon={faArrowUp} className="text-4xl text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Despesas</p>
              <p className="text-2xl font-bold text-red-600">{formatarValor(totalDespesas)}</p>
            </div>
            <FontAwesomeIcon icon={faArrowDown} className="text-4xl text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Saldo Líquido</p>
              <p className="text-2xl font-bold text-blue-600">{formatarValor(totalReceitas - totalDespesas)}</p>
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
          <h3 className="text-lg font-semibold text-gray-800">Extrato de Movimentações</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {movimentacoes.map((mov) => (
                <tr key={mov.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatarData(mov.data)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {mov.tipo === 'ENTRADA' ? (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">
                        <FontAwesomeIcon icon={faArrowUp} className="mr-1" />
                        ENTRADA
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full">
                        <FontAwesomeIcon icon={faArrowDown} className="mr-1" />
                        SAÍDA
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {mov.descricao}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-semibold ${
                    mov.tipo === 'ENTRADA' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatarValor(mov.valor)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                    {formatarValor(mov.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
