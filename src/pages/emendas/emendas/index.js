import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faList, faPlus, faEdit, faTrash, faFileInvoiceDollar, faCheckCircle, faHourglassHalf, faTimesCircle, faFilePdf, faFileExcel
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { gerarPDFEmendas, gerarExcelEmendas } from '@/utils/relatorios';

export default function GerenciarEmendas() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  
  const [emendas, setEmendas] = useState([
    {
      id: 1,
      codigo: 'EMD-2024-001',
      numero: '001/2024',
      tipo: 'INDIVIDUAL',
      autor: 'Deputado José Santos',
      orgao: 'SECRETARIA MUNICIPAL DE SAÚDE',
      responsavel: 'Dr. João Silva',
      finalidade: 'Aquisição de equipamentos médicos',
      valorEmpenhado: 500000.00,
      valorExecutado: 350000.00,
      dataEmpenho: '2024-01-15',
      dataVencimento: '2024-12-31',
      status: 'EM_EXECUCAO',
      observacoes: 'Equipamentos em processo de licitação'
    },
    {
      id: 2,
      codigo: 'EMD-2024-002',
      numero: '002/2024',
      tipo: 'BANCADA',
      autor: 'Bancada Federal do Pará',
      orgao: 'SECRETARIA ESTADUAL DE EDUCAÇÃO',
      responsavel: 'Profª Maria Santos',
      finalidade: 'Construção de escola técnica',
      valorEmpenhado: 2000000.00,
      valorExecutado: 2000000.00,
      dataEmpenho: '2024-02-20',
      dataVencimento: '2024-11-30',
      status: 'EXECUTADA',
      observacoes: 'Obra concluída e inaugurada'
    },
    {
      id: 3,
      codigo: 'EMD-2024-003',
      numero: '003/2024',
      tipo: 'COMISSAO',
      autor: 'Comissão de Infraestrutura',
      orgao: 'SECRETARIA MUNICIPAL DE OBRAS',
      responsavel: 'Eng. Carlos Oliveira',
      finalidade: 'Pavimentação de vias urbanas',
      valorEmpenhado: 1500000.00,
      valorExecutado: 0.00,
      dataEmpenho: '2024-03-10',
      dataVencimento: '2024-12-31',
      status: 'PENDENTE',
      observacoes: 'Aguardando liberação de recursos'
    }
  ]);

  const [filtro, setFiltro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('TODOS');
  const [statusFiltro, setStatusFiltro] = useState('TODOS');

  const emendasFiltradas = emendas.filter(emenda => {
    const matchFiltro = filtro === '' || 
      emenda.numero.toLowerCase().includes(filtro.toLowerCase()) ||
      emenda.autor.toLowerCase().includes(filtro.toLowerCase()) ||
      emenda.finalidade.toLowerCase().includes(filtro.toLowerCase());
    const matchTipo = tipoFiltro === 'TODOS' || emenda.tipo === tipoFiltro;
    const matchStatus = statusFiltro === 'TODOS' || emenda.status === statusFiltro;
    return matchFiltro && matchTipo && matchStatus;
  });

  const formatarValor = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const calcularPercentual = (executado, empenhado) => {
    if (empenhado === 0) return 0;
    return ((executado / empenhado) * 100).toFixed(1);
  };

  const getStatusBadge = (status) => {
    const badges = {
      'PENDENTE': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: faHourglassHalf, label: 'Pendente' },
      'EM_EXECUCAO': { bg: 'bg-blue-100', text: 'text-blue-800', icon: faHourglassHalf, label: 'Em Execução' },
      'EXECUTADA': { bg: 'bg-green-100', text: 'text-green-800', icon: faCheckCircle, label: 'Executada' },
      'CANCELADA': { bg: 'bg-red-100', text: 'text-red-800', icon: faTimesCircle, label: 'Cancelada' }
    };
    const badge = badges[status] || badges['PENDENTE'];
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <FontAwesomeIcon icon={badge.icon} />
        {badge.label}
      </span>
    );
  };

  const handleInserir = () => {
    router.push('/emendas/emendas/novo');
  };

  const handleEditar = (id) => {
    router.push(`/emendas/emendas/${id}`);
  };

  const handleExcluir = (id) => {
    showConfirm('Tem certeza que deseja excluir esta emenda?', () => {
      setEmendas(emendas.filter(e => e.id !== id));
      showSuccess('Emenda excluída com sucesso!');
    });
  };

  const handleGerarRelatorio = (formato) => {
    try {
      if (formato === 'PDF') {
        gerarPDFEmendas(emendas, emendasFiltradas);
        showSuccess('Relatório PDF gerado com sucesso!');
      } else if (formato === 'Excel') {
        gerarExcelEmendas(emendas, emendasFiltradas);
        showSuccess('Relatório Excel gerado com sucesso!');
      }
    } catch (error) {
      showError('Erro ao gerar relatório: ' + error.message);
    }
  };

  const totalEmpenhado = emendasFiltradas.reduce((acc, e) => acc + e.valorEmpenhado, 0);
  const totalExecutado = emendasFiltradas.reduce((acc, e) => acc + e.valorExecutado, 0);

  return (
    <Layout titulo="Gerenciar Emendas">
      <Modal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
      />

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
          <div className="text-sm text-blue-600 font-medium">Total Empenhado</div>
          <div className="text-2xl font-bold text-blue-700">{formatarValor(totalEmpenhado)}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
          <div className="text-sm text-green-600 font-medium">Total Executado</div>
          <div className="text-2xl font-bold text-green-700">{formatarValor(totalExecutado)}</div>
        </div>
        <div className="bg-teal-50 rounded-lg p-4 border-l-4 border-teal-500">
          <div className="text-sm text-teal-600 font-medium">Percentual Executado</div>
          <div className="text-2xl font-bold text-teal-700">
            {calcularPercentual(totalExecutado, totalEmpenhado)}%
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <FontAwesomeIcon icon={faList} className="text-teal-600 text-2xl" />
            <h2 className="text-2xl font-bold text-gray-800">Lista de Emendas</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleGerarRelatorio('PDF')}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              title="Exportar PDF"
            >
              <FontAwesomeIcon icon={faFilePdf} />
              <span className="hidden md:inline">PDF</span>
            </button>
            <button
              onClick={() => handleGerarRelatorio('Excel')}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              title="Exportar Excel"
            >
              <FontAwesomeIcon icon={faFileExcel} />
              <span className="hidden md:inline">Excel</span>
            </button>
            <button
              onClick={handleInserir}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>Nova</span>
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Número, autor ou finalidade..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo
            </label>
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="TODOS">Todos os Tipos</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="BANCADA">Bancada</option>
              <option value="COMISSAO">Comissão</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="PENDENTE">Pendente</option>
              <option value="EM_EXECUCAO">Em Execução</option>
              <option value="EXECUTADA">Executada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Número
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Autor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Finalidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valores
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {emendasFiltradas.map((emenda) => (
                <tr key={emenda.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-teal-600 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{emenda.numero}</div>
                        <div className="text-sm text-gray-500">{emenda.codigo}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {emenda.tipo}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {emenda.autor}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-w-xs truncate" title={emenda.finalidade}>
                      {emenda.finalidade}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex flex-col gap-1">
                      <div className="text-gray-900 font-medium">
                        Emp: {formatarValor(emenda.valorEmpenhado)}
                      </div>
                      <div className="text-gray-600">
                        Exec: {formatarValor(emenda.valorExecutado)}
                      </div>
                      <div className="text-teal-600 font-medium">
                        {calcularPercentual(emenda.valorExecutado, emenda.valorEmpenhado)}%
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(emenda.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditar(emenda.id)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                        title="Editar"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        onClick={() => handleExcluir(emenda.id)}
                        className="text-red-600 hover:text-red-900 transition-colors"
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

          {emendasFiltradas.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nenhuma emenda encontrada com os filtros aplicados.
            </div>
          )}
        </div>

        {/* Rodapé com total */}
        <div className="mt-4 text-sm text-gray-600">
          Total de emendas: <span className="font-bold">{emendasFiltradas.length}</span>
        </div>
      </div>
    </Layout>
  );
}
