import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faList, faPlus, faEdit, faTrash, faUser, faPhone, faEnvelope, faMoneyBillWave, faFilePdf, faFileExcel
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';

export default function Doadores() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  
  const [doadores, setDoadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;

  const [filtro, setFiltro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('TODOS');

  useEffect(() => {
    carregarDoadores();
  }, [filtro, tipoFiltro, paginaAtual]);

  const carregarDoadores = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('limit', String(itensPorPagina));
      params.set('offset', String((paginaAtual - 1) * itensPorPagina));
      if (filtro) params.set('search', filtro);
      if (tipoFiltro && tipoFiltro !== 'TODOS') params.set('tipo', tipoFiltro);

      const usuario = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('usuario') || 'null')
        : null;

      const response = await fetch(`/api/financeiro/parceiros?${params.toString()}`, {
        headers: {
          usuario: usuario ? JSON.stringify(usuario) : ''
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Erro ao carregar doadores');
      }

      setDoadores(data.data || []);
      setTotalRegistros(data.total || 0);
    } catch (error) {
      showError('Erro ao carregar doadores: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const doadoresFiltrados = doadores;

  const totalDoadores = doadoresFiltrados.length;
  const totalDoadoPessoaFisica = doadoresFiltrados
    .filter(d => d.tipo === 'PESSOA_FISICA')
    .reduce((acc, d) => acc + Number(d.total_doado || 0), 0);
  const totalDoadoPessoaJuridica = doadoresFiltrados
    .filter(d => d.tipo === 'PESSOA_JURIDICA')
    .reduce((acc, d) => acc + Number(d.total_doado || 0), 0);
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
    router.push('/financeiro/doadores/novo');
  };

  const handleEditar = (id) => {
    router.push(`/financeiro/doadores/${id}`);
  };

  const handleExcluir = (id) => {
    showConfirm('Tem certeza que deseja excluir este doador?', () => {
      excluirDoador(id);
    });
  };

  const excluirDoador = async (id) => {
    try {
      const usuario = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('usuario') || 'null')
        : null;
      const response = await fetch(`/api/financeiro/parceiros/${id}`, {
        method: 'DELETE',
        headers: {
          usuario: usuario ? JSON.stringify(usuario) : ''
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Erro ao excluir doador');
      }
      showSuccess('Doador excluido com sucesso!');
      carregarDoadores();
    } catch (error) {
      showError('Erro ao excluir doador: ' + error.message);
    }
  };

  const handleGerarRelatorio = (formato) => {
    showSuccess(`Relatório ${formato} em desenvolvimento`);
  };

  return (
    <Layout titulo="Doadores / Parceiros">
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
              <p className="text-sm text-gray-600">Total de Doadores</p>
              <p className="text-2xl font-bold text-blue-600">{totalDoadores}</p>
            </div>
            <FontAwesomeIcon icon={faUser} className="text-4xl text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pessoa Física</p>
              <p className="text-2xl font-bold text-green-600">{formatarValor(totalDoadoPessoaFisica)}</p>
            </div>
            <FontAwesomeIcon icon={faMoneyBillWave} className="text-4xl text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pessoa Jurídica</p>
              <p className="text-2xl font-bold text-purple-600">{formatarValor(totalDoadoPessoaJuridica)}</p>
            </div>
            <FontAwesomeIcon icon={faMoneyBillWave} className="text-4xl text-purple-500" />
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
            <span className="hidden md:inline">Novo Doador</span>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              type="text"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Nome, CPF, CNPJ..."
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
              <option value="PESSOA_FISICA">Pessoa Física</option>
              <option value="PESSOA_JURIDICA">Pessoa Jurídica</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Carregando doadores...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPF/CNPJ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contato</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Doado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ultima Doacao</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acoes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {doadoresFiltrados.map((doador) => (
                  <tr key={doador.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {doador.codigo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <FontAwesomeIcon icon={faUser} className="mr-2 text-gray-400" />
                      {doador.nome}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        doador.tipo === 'PESSOA_FISICA' ? 'bg-blue-100 text-blue-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {doador.tipo === 'PESSOA_FISICA' ? 'PF' : 'PJ'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {doador.cpf || doador.cnpj || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="flex flex-col">
                        <span>
                          <FontAwesomeIcon icon={faPhone} className="mr-1 text-gray-400" />
                          {doador.telefone || '-'}
                        </span>
                        <span>
                          <FontAwesomeIcon icon={faEnvelope} className="mr-1 text-gray-400" />
                          {doador.email || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                      {formatarValor(doador.total_doado || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatarData(doador.ultima_doacao)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditar(doador.id)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                        title="Editar"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        onClick={() => handleExcluir(doador.id)}
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

        {!loading && doadoresFiltrados.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum doador encontrado
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
  );
}
