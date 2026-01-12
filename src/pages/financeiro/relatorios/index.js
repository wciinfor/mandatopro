import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartPie, faChartBar, faFileAlt, faFilePdf, faFileExcel, faCalendarAlt, faDownload
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';

export default function RelatoriosFinanceiros() {
  const { modalState, closeModal, showSuccess } = useModal();
  
  const [tipoRelatorio, setTipoRelatorio] = useState('COMPLETO');
  const [periodo, setPeriodo] = useState('MES_ATUAL');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [agrupamento, setAgrupamento] = useState('CATEGORIA');

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

  const handleGerarRelatorio = (tipo, formato) => {
    showSuccess(`Gerando relatório ${tipo} em formato ${formato}...`);
  };

  const handleVisualizarPrevia = (tipo) => {
    showSuccess(`Abrindo prévia do relatório ${tipo}...`);
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
  );
}
