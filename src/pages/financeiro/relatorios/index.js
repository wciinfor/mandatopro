import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartPie, faChartBar, faFileAlt, faFilePdf, faFileExcel, faCalendarAlt, faDownload,
  faArrowUp, faArrowDown, faBalanceScale, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import ProtectedRoute from '@/components/ProtectedRoute';
import { MODULES } from '@/utils/permissions';

export default function RelatoriosFinanceiros() {
  const { modalState, closeModal, showSuccess, showError } = useModal();
  
  const [tipoRelatorio, setTipoRelatorio] = useState('COMPLETO');
  const [periodo, setPeriodo] = useState('MES_ATUAL');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [agrupamento, setAgrupamento] = useState('CATEGORIA');
  const [preview, setPreview] = useState(null);
  const [resumo, setResumo] = useState(null);
  const [loadingResumo, setLoadingResumo] = useState(true);

  useEffect(() => {
    carregarResumoMesAtual();
  }, []);

  const carregarResumoMesAtual = async () => {
    try {
      setLoadingResumo(true);
      const hoje = new Date();
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      const fmt = (d) => d.toISOString().slice(0, 10);

      const usuario = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('usuario') || 'null')
        : null;

      const params = new URLSearchParams({
        tipo: 'totais_periodo',
        data_from: fmt(inicio),
        data_to: fmt(fim)
      });

      const response = await fetch(`/api/financeiro/relatorios?${params.toString()}`, {
        headers: { usuario: usuario ? JSON.stringify(usuario) : '' }
      });
      const data = await response.json();
      if (response.ok) setResumo(data.data);
    } catch {
      // silencioso — cards mostram zero se falhar
    } finally {
      setLoadingResumo(false);
    }
  };

  const relatoriosDisponiveis = [
    {
      id: 1,
      nome: 'Relatório Completo',
      tipo: 'COMPLETO',
      descricao: 'Visão geral de todas as receitas e despesas',
      icone: faFileAlt,
      cor: 'blue'
    },
    {
      id: 2,
      nome: 'Receitas por Categoria',
      tipo: 'RECEITAS_CATEGORIA',
      descricao: 'Análise detalhada das receitas agrupadas por categoria',
      icone: faChartPie,
      cor: 'green'
    },
    {
      id: 3,
      nome: 'Despesas por Categoria',
      tipo: 'DESPESAS_CATEGORIA',
      descricao: 'Análise detalhada das despesas agrupadas por categoria',
      icone: faChartPie,
      cor: 'red'
    },
    {
      id: 4,
      nome: 'Fluxo de Caixa',
      tipo: 'FLUXO_CAIXA',
      descricao: 'Movimentações diárias de entrada e saída',
      icone: faChartBar,
      cor: 'purple'
    },
    {
      id: 5,
      nome: 'Doações de Campanha',
      tipo: 'DOACOES',
      descricao: 'Relatório específico de doações recebidas',
      icone: faFileAlt,
      cor: 'yellow'
    },
    {
      id: 6,
      nome: 'Emendas Parlamentares',
      tipo: 'EMENDAS',
      descricao: 'Movimentação financeira das emendas',
      icone: faFileAlt,
      cor: 'indigo'
    },
    {
      id: 7,
      nome: 'Comparativo Mensal',
      tipo: 'COMPARATIVO',
      descricao: 'Comparação entre meses do ano',
      icone: faChartBar,
      cor: 'teal'
    },
    {
      id: 8,
      nome: 'Prestação de Contas',
      tipo: 'PRESTACAO_CONTAS',
      descricao: 'Relatório completo para prestação de contas',
      icone: faFileAlt,
      cor: 'gray'
    }
  ];

  const formatarDataISO = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const obterRangePeriodo = () => {
    const hoje = new Date();
    if (periodo === 'PERSONALIZADO') {
      return { data_from: dataInicio || '', data_to: dataFim || '' };
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
    if (periodo === 'SEMESTRE') {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
      return { data_from: formatarDataISO(inicio), data_to: formatarDataISO(hoje) };
    }
    if (periodo === 'ANO') {
      const inicio = new Date(hoje.getFullYear(), 0, 1);
      const fim = new Date(hoje.getFullYear(), 11, 31);
      return { data_from: formatarDataISO(inicio), data_to: formatarDataISO(fim) };
    }
    return { data_from: '', data_to: '' };
  };

  const handleGerarRelatorio = (tipo, formato) => {
    showSuccess(`Gerando relatorio ${tipo} em formato ${formato}...`);
  };

  const handleVisualizarPrevia = async (tipo) => {
    try {
      const { data_from, data_to } = obterRangePeriodo();
      const params = new URLSearchParams();
      if (tipo === 'FLUXO_CAIXA') params.set('tipo', 'fluxo_caixa');
      else if (tipo === 'DESPESAS_CATEGORIA' || tipo === 'RECEITAS_CATEGORIA') params.set('tipo', 'por_categoria');
      else params.set('tipo', 'totais_periodo');
      if (data_from) params.set('data_from', data_from);
      if (data_to) params.set('data_to', data_to);

      const usuario = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('usuario') || 'null')
        : null;

      const response = await fetch(`/api/financeiro/relatorios?${params.toString()}`, {
        headers: { usuario: usuario ? JSON.stringify(usuario) : '' }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Erro ao gerar previa');
      }

      setPreview({ tipo, data: data.data });
    } catch (error) {
      showError('Erro ao carregar previa: ' + error.message);
    }
  };

  const corClasses = {
    blue: 'border-blue-500 bg-blue-50 hover:bg-blue-100',
    green: 'border-green-500 bg-green-50 hover:bg-green-100',
    red: 'border-red-500 bg-red-50 hover:bg-red-100',
    purple: 'border-purple-500 bg-purple-50 hover:bg-purple-100',
    yellow: 'border-yellow-500 bg-yellow-50 hover:bg-yellow-100',
    indigo: 'border-indigo-500 bg-indigo-50 hover:bg-indigo-100',
    teal: 'border-teal-500 bg-teal-50 hover:bg-teal-100',
    gray: 'border-gray-500 bg-gray-50 hover:bg-gray-100'
  };

  const iconeCorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
    yellow: 'text-yellow-600',
    indigo: 'text-indigo-600',
    teal: 'text-teal-600',
    gray: 'text-gray-600'
  };

  return (
    <ProtectedRoute module={MODULES.FINANCEIRO}>
    <Layout titulo="Relatórios Financeiros">
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

      {/* Resumo do Mês Atual */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border-l-4 border-emerald-500 p-5 flex items-center gap-4">
          <div className="bg-emerald-100 rounded-full p-3">
            <FontAwesomeIcon icon={faArrowUp} className="text-emerald-600 text-xl" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Receitas (Mês Atual)</p>
            {loadingResumo ? (
              <FontAwesomeIcon icon={faSpinner} className="text-gray-400 animate-spin mt-1" />
            ) : (
              <p className="text-xl font-bold text-emerald-600">
                {(resumo?.total_receitas || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border-l-4 border-rose-500 p-5 flex items-center gap-4">
          <div className="bg-rose-100 rounded-full p-3">
            <FontAwesomeIcon icon={faArrowDown} className="text-rose-600 text-xl" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Despesas (Mês Atual)</p>
            {loadingResumo ? (
              <FontAwesomeIcon icon={faSpinner} className="text-gray-400 animate-spin mt-1" />
            ) : (
              <p className="text-xl font-bold text-rose-600">
                {(resumo?.total_despesas || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            )}
          </div>
        </div>

        <div className={`bg-white rounded-lg shadow-sm border-l-4 p-5 flex items-center gap-4 ${
          !loadingResumo && (resumo?.saldo_liquido || 0) < 0 ? 'border-rose-500' : 'border-teal-500'
        }`}>
          <div className={`rounded-full p-3 ${
            !loadingResumo && (resumo?.saldo_liquido || 0) < 0 ? 'bg-rose-100' : 'bg-teal-100'
          }`}>
            <FontAwesomeIcon icon={faBalanceScale} className={`text-xl ${
              !loadingResumo && (resumo?.saldo_liquido || 0) < 0 ? 'text-rose-600' : 'text-teal-600'
            }`} />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Saldo Líquido (Mês Atual)</p>
            {loadingResumo ? (
              <FontAwesomeIcon icon={faSpinner} className="text-gray-400 animate-spin mt-1" />
            ) : (
              <p className={`text-xl font-bold ${
                (resumo?.saldo_liquido || 0) < 0 ? 'text-rose-600' : 'text-teal-600'
              }`}>
                {(resumo?.saldo_liquido || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Filtros Globais */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FontAwesomeIcon icon={faCalendarAlt} />
          Configurações de Período
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="MES_ATUAL">Mês Atual</option>
              <option value="MES_ANTERIOR">Mês Anterior</option>
              <option value="TRIMESTRE">Último Trimestre</option>
              <option value="SEMESTRE">Último Semestre</option>
              <option value="ANO">Ano Atual</option>
              <option value="PERSONALIZADO">Personalizado</option>
            </select>
          </div>

          {periodo === 'PERSONALIZADO' && (
            <>
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
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agrupar por</label>
            <select
              value={agrupamento}
              onChange={(e) => setAgrupamento(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="CATEGORIA">Categoria</option>
              <option value="TIPO">Tipo</option>
              <option value="FORNECEDOR">Fornecedor/Doador</option>
              <option value="MES">Mês</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cards de Relatórios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {relatoriosDisponiveis.map((relatorio) => (
          <div
            key={relatorio.id}
            className={`bg-white rounded-lg shadow-sm border-l-4 p-6 transition-all ${corClasses[relatorio.cor]}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <FontAwesomeIcon
                  icon={relatorio.icone}
                  className={`text-3xl ${iconeCorClasses[relatorio.cor]}`}
                />
                <div>
                  <h4 className="text-lg font-semibold text-gray-800">{relatorio.nome}</h4>
                  <p className="text-sm text-gray-600 mt-1">{relatorio.descricao}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-4">
              <button
                onClick={() => handleVisualizarPrevia(relatorio.tipo)}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center justify-center gap-2"
              >
                <FontAwesomeIcon icon={faFileAlt} />
                Visualizar Prévia
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleGerarRelatorio(relatorio.tipo, 'PDF')}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faFilePdf} />
                  <span className="hidden lg:inline">PDF</span>
                </button>

                <button
                  onClick={() => handleGerarRelatorio(relatorio.tipo, 'Excel')}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faFileExcel} />
                  <span className="hidden lg:inline">Excel</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Previa do Relatorio</h3>
          {Array.isArray(preview.data) ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {preview.tipo === 'FLUXO_CAIXA' ? (
                      <>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Entradas</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Saidas</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Entradas</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Saidas</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.data.map((item, index) => (
                    <tr key={`prev-${index}`}>
                      {preview.tipo === 'FLUXO_CAIXA' ? (
                        <>
                          <td className="px-4 py-2 text-sm text-gray-700">{item.data}</td>
                          <td className="px-4 py-2 text-sm text-right text-green-700">{item.entradas?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td className="px-4 py-2 text-sm text-right text-red-700">{item.saidas?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td className="px-4 py-2 text-sm text-right text-gray-800">{item.saldo?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2 text-sm text-gray-700">{item.categoria}</td>
                          <td className="px-4 py-2 text-sm text-right text-green-700">{item.entradas?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td className="px-4 py-2 text-sm text-right text-red-700">{item.saidas?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td className="px-4 py-2 text-sm text-right text-gray-800">{item.saldo?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Total Receitas</p>
                <p className="text-lg font-semibold text-green-700">
                  {(preview.data?.total_receitas || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Total Despesas</p>
                <p className="text-lg font-semibold text-red-700">
                  {(preview.data?.total_despesas || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Saldo Liquido</p>
                <p className="text-lg font-semibold text-gray-800">
                  {(preview.data?.saldo_liquido || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Informações Adicionais */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mt-6 rounded-lg">
        <div className="flex items-start gap-3">
          <FontAwesomeIcon icon={faDownload} className="text-2xl text-blue-600 mt-1" />
          <div>
            <h4 className="text-lg font-semibold text-blue-900 mb-2">Sobre os Relatórios</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Os relatórios podem ser gerados em PDF (para impressão) ou Excel (para análise de dados)</li>
              <li>• Use a prévia para verificar o conteúdo antes de gerar o relatório completo</li>
              <li>• Os relatórios respeitam os filtros de período selecionados</li>
              <li>• Relatórios de Prestação de Contas incluem todos os comprovantes anexados</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>

    </ProtectedRoute>
  );
}
