import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileAlt, faSearch, faCalendarAlt, faFilter, faDownload,
  faTrash, faEye, faSync, faCheckCircle, faTimesCircle,
  faExclamationTriangle, faInfoCircle
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';

const TIPOS_EVENTO = {
  LOGIN: { label: 'Login', cor: 'bg-green-100 text-green-800', icone: 'faCheckCircle' },
  LOGOUT: { label: 'Logout', cor: 'bg-blue-100 text-blue-800', icone: 'faInfoCircle' },
  CADASTRO: { label: 'Cadastro', cor: 'bg-teal-100 text-teal-800', icone: 'faPlus' },
  EDICAO: { label: 'Edição', cor: 'bg-yellow-100 text-yellow-800', icone: 'faEdit' },
  DELECAO: { label: 'Exclusão', cor: 'bg-red-100 text-red-800', icone: 'faTrash' },
  RELATORIO: { label: 'Relatório', cor: 'bg-purple-100 text-purple-800', icone: 'faFileAlt' },
  EXPORTACAO: { label: 'Exportação', cor: 'bg-indigo-100 text-indigo-800', icone: 'faDownload' },
  ACESSO: { label: 'Acesso', cor: 'bg-cyan-100 text-cyan-800', icone: 'faEye' },
  ERRO: { label: 'Erro', cor: 'bg-red-100 text-red-800', icone: 'faExclamationTriangle' },
  CONFIGURACAO: { label: 'Configuração', cor: 'bg-orange-100 text-orange-800', icone: 'faCog' }
};

const MODULOS = [
  'AUTENTICACAO',
  'ELEITORES',
  'LIDERANCAS',
  'FUNCIONARIOS',
  'ATENDIMENTOS',
  'EMENDAS',
  'FINANCEIRO',
  'COMUNICACAO',
  'AGENDA',
  'SOLICITACOES',
  'USUARIOS',
  'SISTEMA'
];

export default function Logs() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();

  const [usuario, setUsuario] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logDetalhado, setLogDetalhado] = useState(null);

  // Filtros
  const [filtros, setFiltros] = useState({
    tipoEvento: '',
    modulo: '',
    usuarioNome: '',
    status: '',
    dataInicio: '',
    dataFim: '',
    busca: '',
    pagina: 1,
    limite: 50
  });

  const [paginacao, setPaginacao] = useState({
    total: 0,
    totalPaginas: 1,
    pagina: 1,
    limite: 50
  });

  // Verifica se é admin
  useEffect(() => {
    const usuarioStr = localStorage.getItem('usuario');
    if (!usuarioStr) {
      router.push('/login');
      return;
    }

    const usuarioData = JSON.parse(usuarioStr);
    if (usuarioData.nivel !== 'ADMINISTRADOR') {
      showError('Acesso negado. Apenas administradores podem acessar os logs.', () => {
        router.push('/dashboard');
      });
      return;
    }

    setUsuario(usuarioData);
    
    // Carrega logs após configurar o usuário
    setTimeout(() => {
      carregarLogs();
    }, 100);
  }, [router]);

  const carregarLogs = async (filtrosAtualizados = null) => {
    setLoading(true);
    try {
      // Garante que tem usuário
      const usuarioParaEnviar = usuario || JSON.parse(localStorage.getItem('usuario') || '{}');
      
      const filtrosAplicar = filtrosAtualizados || filtros;
      const params = new URLSearchParams();

      if (filtrosAplicar.tipoEvento) params.append('tipoEvento', filtrosAplicar.tipoEvento);
      if (filtrosAplicar.modulo) params.append('modulo', filtrosAplicar.modulo);
      if (filtrosAplicar.usuarioNome) params.append('usuarioId', filtrosAplicar.usuarioNome);
      if (filtrosAplicar.status) params.append('status', filtrosAplicar.status);
      if (filtrosAplicar.dataInicio) params.append('dataInicio', filtrosAplicar.dataInicio);
      if (filtrosAplicar.dataFim) params.append('dataFim', filtrosAplicar.dataFim);
      if (filtrosAplicar.busca) params.append('busca', filtrosAplicar.busca);
      params.append('pagina', filtrosAplicar.pagina);
      params.append('limite', filtrosAplicar.limite);

      const response = await fetch(`/api/logs?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'usuario': JSON.stringify(usuarioParaEnviar)
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.erro || `Erro ${response.status}: Erro ao carregar logs`);
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setPaginacao(data.paginacao || {});
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao carregar logs: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltroChange = (campo, valor) => {
    const novosFiltros = {
      ...filtros,
      [campo]: valor,
      pagina: 1
    };
    setFiltros(novosFiltros);
    carregarLogs(novosFiltros);
  };

  const handlePaginacao = (novaPage) => {
    const novosFiltros = { ...filtros, pagina: novaPage };
    setFiltros(novosFiltros);
    carregarLogs(novosFiltros);
  };

  const handleLimparLogs = () => {
    showConfirm(
      'Confirmar exclusão',
      'Deseja remover logs com mais de 90 dias? Esta ação não pode ser desfeita.',
      async () => {
        try {
          const usuarioParaEnviar = usuario || JSON.parse(localStorage.getItem('usuario') || '{}');
          
          const response = await fetch('/api/logs?diasRetencao=90', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'usuario': JSON.stringify(usuarioParaEnviar)
            }
          });

          if (!response.ok) {
            throw new Error('Erro ao limpar logs');
          }

          const data = await response.json();
          showSuccess(`${data.removidos} logs removidos com sucesso`);
          carregarLogs();
        } catch (error) {
          showError('Erro ao limpar logs: ' + error.message);
        }
      }
    );
  };

  const exportarLogs = () => {
    try {
      const csv = [
        ['Data', 'Tipo', 'Módulo', 'Usuário', 'Email', 'Descrição', 'Status', 'IP'],
        ...logs.map(log => [
          log.dataLocal,
          log.tipoEvento,
          log.modulo,
          log.usuarioNome,
          log.usuarioEmail,
          log.descricao,
          log.status,
          log.enderecoIP
        ])
      ]
        .map(row => row.map(cell => `"${cell || ''}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `logs-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showSuccess('Logs exportados com sucesso');
    } catch (error) {
      showError('Erro ao exportar logs');
    }
  };

  if (!usuario) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  return (
    <Layout titulo="Auditoria - Logs do Sistema">
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

      {/* Modal de Detalhes */}
      {logDetalhado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">Detalhes do Log</h3>
              <button
                onClick={() => setLogDetalhado(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Tipo de Evento</label>
                  <p className="text-sm text-gray-800">{logDetalhado.tipoEvento}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Módulo</label>
                  <p className="text-sm text-gray-800">{logDetalhado.modulo}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Usuário</label>
                  <p className="text-sm text-gray-800">{logDetalhado.usuarioNome}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Email</label>
                  <p className="text-sm text-gray-800">{logDetalhado.usuarioEmail}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Data/Hora</label>
                  <p className="text-sm text-gray-800">{logDetalhado.dataLocal}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
                  <p className="text-sm text-gray-800">{logDetalhado.status}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">IP</label>
                  <p className="text-sm text-gray-800">{logDetalhado.enderecoIP}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Browser</label>
                  <p className="text-xs text-gray-600 truncate">{logDetalhado.agenteBrowser}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Descrição</label>
                <p className="text-sm text-gray-800 mt-1">{logDetalhado.descricao}</p>
              </div>

              {logDetalhado.dados && Object.keys(logDetalhado.dados).length > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Dados Adicionais</label>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto mt-1">
                    {JSON.stringify(logDetalhado.dados, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h3 className="text-lg font-bold text-teal-700 mb-4 flex items-center gap-2">
          <FontAwesomeIcon icon={faFilter} />
          Filtros de Busca
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Busca por texto */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Busca</label>
            <div className="relative">
              <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Usuário, descrição..."
                value={filtros.busca}
                onChange={(e) => handleFiltroChange('busca', e.target.value)}
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Tipo de Evento */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Evento</label>
            <select
              value={filtros.tipoEvento}
              onChange={(e) => handleFiltroChange('tipoEvento', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Todos</option>
              {Object.entries(TIPOS_EVENTO).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </select>
          </div>

          {/* Módulo */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Módulo</label>
            <select
              value={filtros.modulo}
              onChange={(e) => handleFiltroChange('modulo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Todos</option>
              {MODULOS.map(modulo => (
                <option key={modulo} value={modulo}>{modulo}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
            <select
              value={filtros.status}
              onChange={(e) => handleFiltroChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Todos</option>
              <option value="SUCESSO">Sucesso</option>
              <option value="ERRO">Erro</option>
            </select>
          </div>

          {/* Data Início */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Data Início</label>
            <input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => handleFiltroChange('dataInicio', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Data Fim */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Data Fim</label>
            <input
              type="date"
              value={filtros.dataFim}
              onChange={(e) => handleFiltroChange('dataFim', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => carregarLogs()}
            disabled={loading}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faSync} />
            Atualizar
          </button>
          <button
            onClick={exportarLogs}
            disabled={logs.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faDownload} />
            Exportar CSV
          </button>
          <button
            onClick={handleLimparLogs}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faTrash} />
            Limpar Logs Antigos
          </button>
        </div>
      </div>

      {/* Tabela de Logs */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <FontAwesomeIcon icon={faSync} className="text-4xl text-teal-600 mb-3 animate-spin" />
              <p className="text-gray-600">Carregando logs...</p>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <FontAwesomeIcon icon={faFileAlt} className="text-4xl text-gray-400 mb-3" />
              <p className="text-gray-600">Nenhum log encontrado com os filtros selecionados</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-teal-600 to-teal-700 text-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Data/Hora</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Tipo</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Módulo</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Usuário</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Descrição</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">IP</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {log.dataLocal}
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${TIPOS_EVENTO[log.tipoEvento]?.cor || 'bg-gray-100'}`}>
                          {TIPOS_EVENTO[log.tipoEvento]?.label || log.tipoEvento}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700 font-medium">
                        {log.modulo}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700">
                        {log.usuarioNome}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700 max-w-xs truncate">
                        {log.descricao}
                      </td>
                      <td className="px-6 py-3 text-sm">
                        {log.status === 'SUCESSO' ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <FontAwesomeIcon icon={faCheckCircle} className="text-lg" />
                            Sucesso
                          </span>
                        ) : (
                          <span className="text-red-600 flex items-center gap-1">
                            <FontAwesomeIcon icon={faTimesCircle} className="text-lg" />
                            Erro
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 text-xs">
                        {log.enderecoIP}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={() => setLogDetalhado(log)}
                          className="text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1 rounded transition-colors"
                          title="Ver detalhes"
                        >
                          <FontAwesomeIcon icon={faEye} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {paginacao.totalPaginas > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Mostrando {logs.length} de {paginacao.total} registros
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePaginacao(paginacao.pagina - 1)}
                    disabled={paginacao.pagina === 1}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    ← Anterior
                  </button>
                  {Array.from({ length: Math.min(5, paginacao.totalPaginas) }, (_, i) => {
                    const pagina = Math.max(1, paginacao.pagina - 2) + i;
                    return (
                      <button
                        key={pagina}
                        onClick={() => handlePaginacao(pagina)}
                        className={`px-3 py-1 rounded ${
                          paginacao.pagina === pagina
                            ? 'bg-teal-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pagina}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => handlePaginacao(paginacao.pagina + 1)}
                    disabled={paginacao.pagina === paginacao.totalPaginas}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Próxima →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
