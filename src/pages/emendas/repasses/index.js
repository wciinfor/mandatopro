import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faList, faPlus, faEdit, faTrash, faMoneyBillWave, faCheckCircle, faHourglassHalf, faFilePdf, faFileExcel
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { gerarPDFRepasses, gerarExcelRepasses } from '@/utils/relatorios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function GerenciarRepasses() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  
  const [repasses, setRepasses] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarRepasses();
  }, []);

  const carregarRepasses = async () => {
    setCarregando(true);
    try {
      let { data, error } = await supabase
        .from('repasses')
        .select('*')
        .order('dataPrevista', { ascending: true });

      if (error) throw error;

      setRepasses(data || []);
    } catch (error) {
      console.error('Erro ao carregar repasses:', error);
      showError('Erro ao carregar repasses');
    } finally {
      setCarregando(false);
    }
  };

  const [filtro, setFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('TODOS');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');

  const repassesFiltrados = repasses.filter(repasse => {
    const matchFiltro = filtro === '' || 
      (repasse.codigo && repasse.codigo.toLowerCase().includes(filtro.toLowerCase())) ||
      (repasse.emenda && repasse.emenda.toLowerCase().includes(filtro.toLowerCase())) ||
      (repasse.orgao && repasse.orgao.toLowerCase().includes(filtro.toLowerCase()));
    const matchStatus = statusFiltro === 'TODOS' || repasse.status === statusFiltro;
    
    let matchPeriodo = true;
    if (periodoInicio && repasse.dataPrevista) {
      matchPeriodo = matchPeriodo && repasse.dataPrevista >= periodoInicio;
    }
    if (periodoFim && repasse.dataPrevista) {
      matchPeriodo = matchPeriodo && repasse.dataPrevista <= periodoFim;
    }
    
    return matchFiltro && matchStatus && matchPeriodo;
  });

  const formatarValor = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const formatarData = (data) => {
    if (!data) return '-';
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status) => {
    const badges = {
      'PENDENTE': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: faHourglassHalf, label: 'Pendente' },
      'EFETIVADO': { bg: 'bg-green-100', text: 'text-green-800', icon: faCheckCircle, label: 'Efetivado' }
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
    router.push('/emendas/repasses/novo');
  };

  const handleEditar = (id) => {
    router.push(`/emendas/repasses/${id}`);
  };

  const handleExcluir = (id) => {
    showConfirm('Tem certeza que deseja excluir este repasse?', async () => {
      try {
        const { error } = await supabase
          .from('repasses')
          .delete()
          .eq('id', id);

        if (error) throw error;

        setRepasses(repasses.filter(r => r.id !== id));
        showSuccess('Repasse excluído com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir repasse:', error);
        showError('Erro ao excluir repasse: ' + error.message);
      }
    });
  };

  const handleGerarRelatorio = (formato) => {
    try {
      if (formato === 'PDF') {
        gerarPDFRepasses(repasses, repassesFiltrados);
        showSuccess('Relatório PDF gerado com sucesso!');
      } else if (formato === 'Excel') {
        gerarExcelRepasses(repasses, repassesFiltrados);
        showSuccess('Relatório Excel gerado com sucesso!');
      }
    } catch (error) {
      showError('Erro ao gerar relatório: ' + error.message);
    }
  };

  const totalRepasses = repassesFiltrados.reduce((acc, r) => acc + r.valor, 0);
  const totalEfetivados = repassesFiltrados.filter(r => r.status === 'EFETIVADO').reduce((acc, r) => acc + r.valor, 0);
  const totalPendentes = repassesFiltrados.filter(r => r.status === 'PENDENTE').reduce((acc, r) => acc + r.valor, 0);

  if (carregando) {
    return (
      <Layout titulo="Gerenciar Repasses">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-700">Carregando repasses...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout titulo="Gerenciar Repasses">
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
          <div className="text-sm text-blue-600 font-medium">Total de Repasses</div>
          <div className="text-2xl font-bold text-blue-700">{formatarValor(totalRepasses)}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
          <div className="text-sm text-green-600 font-medium">Repasses Efetivados</div>
          <div className="text-2xl font-bold text-green-700">{formatarValor(totalEfetivados)}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 border-l-4 border-yellow-500">
          <div className="text-sm text-yellow-600 font-medium">Repasses Pendentes</div>
          <div className="text-2xl font-bold text-yellow-700">{formatarValor(totalPendentes)}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <FontAwesomeIcon icon={faList} className="text-teal-600 text-2xl" />
            <h2 className="text-2xl font-bold text-gray-800">Lista de Repasses</h2>
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
              <span>Novo</span>
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Código ou emenda..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
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
              <option value="EFETIVADO">Efetivado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período Início
            </label>
            <input
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período Fim
            </label>
            <input
              type="date"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Emenda
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parcela
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data Prevista
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data Efetivada
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
              {repassesFiltrados.map((repasse) => (
                <tr key={repasse.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FontAwesomeIcon icon={faMoneyBillWave} className="text-teal-600 mr-2" />
                      <span className="text-sm font-medium text-gray-900">{repasse.codigo}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {repasse.emenda}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {repasse.parcela}/{repasse.totalParcelas}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatarValor(repasse.valor)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatarData(repasse.dataPrevista)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatarData(repasse.dataEfetivada)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(repasse.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditar(repasse.id)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                        title="Editar"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        onClick={() => handleExcluir(repasse.id)}
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

          {repassesFiltrados.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nenhum repasse encontrado com os filtros aplicados.
            </div>
          )}
        </div>

        {/* Rodapé com total */}
        <div className="mt-4 text-sm text-gray-600">
          Total de repasses: <span className="font-bold">{repassesFiltrados.length}</span>
        </div>
      </div>
    </Layout>
  );
}
