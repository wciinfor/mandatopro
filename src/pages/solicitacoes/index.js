import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faExclamationTriangle, faSearch, faPlus, faEdit, faEye, faTrash, faCheckCircle,
  faClock, faBan, faFileAlt, faUser, faMapMarkerAlt, faCalendarAlt, faFilter
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { MODULES } from '@/utils/permissions';

export default function Solicitacoes() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showConfirm } = useModal();

  // Mock de solicitações (viria do banco de dados)
  const [solicitacoes] = useState([
    {
      id: 1,
      protocolo: 'SOL-2024-001',
      titulo: 'Reforma de escola municipal',
      solicitante: 'Maria Silva Santos',
      tipoSolicitante: 'Liderança',
      categoria: 'Educação',
      prioridade: 'ALTA',
      status: 'NOVO',
      municipio: 'Belém',
      bairro: 'Pedreira',
      dataAbertura: '2024-11-15',
      descricao: 'Solicitação de reforma completa da Escola Municipal João Paulo II, incluindo pintura, troca de telhas e reforma dos banheiros.',
      observacoes: null,
      atendente: null
    },
    {
      id: 2,
      protocolo: 'SOL-2024-002',
      titulo: 'Iluminação pública na Rua das Flores',
      solicitante: 'João Costa Oliveira',
      tipoSolicitante: 'Morador',
      categoria: 'Infraestrutura',
      prioridade: 'MÉDIA',
      status: 'EM_ANDAMENTO',
      municipio: 'Ananindeua',
      bairro: 'Cidade Nova',
      dataAbertura: '2024-11-10',
      descricao: 'Instalação de postes de iluminação na Rua das Flores, trecho entre Av. Principal e Rua 2.',
      observacoes: 'Em análise pela Secretaria de Infraestrutura',
      atendente: 'Pedro Alves'
    },
    {
      id: 3,
      protocolo: 'SOL-2024-003',
      titulo: 'Consulta médica especializada',
      solicitante: 'Ana Paula Santos',
      tipoSolicitante: 'Eleitor',
      categoria: 'Saúde',
      prioridade: 'URGENTE',
      status: 'NOVO',
      municipio: 'Belém',
      bairro: 'Marco',
      dataAbertura: '2024-11-18',
      descricao: 'Solicitação de encaminhamento para consulta com cardiologista.',
      observacoes: null,
      atendente: null
    },
    {
      id: 4,
      protocolo: 'SOL-2024-004',
      titulo: 'Construção de quadra esportiva',
      solicitante: 'Carlos Oliveira',
      tipoSolicitante: 'Liderança',
      categoria: 'Esporte e Lazer',
      prioridade: 'BAIXA',
      status: 'ATENDIDO',
      municipio: 'Marituba',
      bairro: 'Centro',
      dataAbertura: '2024-10-20',
      descricao: 'Construção de quadra poliesportiva no bairro Centro.',
      observacoes: 'Emenda aprovada e em execução',
      atendente: 'Julia Fernandes'
    },
    {
      id: 5,
      protocolo: 'SOL-2024-005',
      titulo: 'Coleta de lixo irregular',
      solicitante: 'Francisca Lima',
      tipoSolicitante: 'Morador',
      categoria: 'Meio Ambiente',
      prioridade: 'MÉDIA',
      status: 'RECUSADO',
      municipio: 'Belém',
      bairro: 'Guamá',
      dataAbertura: '2024-11-05',
      descricao: 'Reclamação sobre coleta de lixo irregular na rua.',
      observacoes: 'Competência municipal - encaminhado para prefeitura',
      atendente: 'Pedro Alves'
    }
  ]);

  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [prioridadeFiltro, setPrioridadeFiltro] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');

  const solicitacoesFiltradas = solicitacoes.filter(sol => {
    const matchBusca = sol.titulo.toLowerCase().includes(busca.toLowerCase()) ||
                       sol.solicitante.toLowerCase().includes(busca.toLowerCase()) ||
                       sol.protocolo.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = statusFiltro === '' || sol.status === statusFiltro;
    const matchPrioridade = prioridadeFiltro === '' || sol.prioridade === prioridadeFiltro;
    const matchCategoria = categoriaFiltro === '' || sol.categoria === categoriaFiltro;
    
    return matchBusca && matchStatus && matchPrioridade && matchCategoria;
  });

  // Estatísticas
  const stats = {
    total: solicitacoes.length,
    novas: solicitacoes.filter(s => s.status === 'NOVO').length,
    emAndamento: solicitacoes.filter(s => s.status === 'EM_ANDAMENTO').length,
    atendidas: solicitacoes.filter(s => s.status === 'ATENDIDO').length,
    recusadas: solicitacoes.filter(s => s.status === 'RECUSADO').length
  };

  const handleNovaSolicitacao = () => {
    router.push('/solicitacoes/novo');
  };

  const handleVisualizarSolicitacao = (id) => {
    router.push(`/solicitacoes/${id}`);
  };

  const handleExcluirSolicitacao = (solicitacao) => {
    showConfirm(
      'Excluir Solicitação',
      `Deseja realmente excluir a solicitação "${solicitacao.titulo}"?`,
      () => {
        // Aqui você implementaria a exclusão no banco de dados
        showSuccess('Solicitação excluída com sucesso!');
      }
    );
  };

  const getStatusBadge = (status) => {
    const badges = {
      'NOVO': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Novo' },
      'EM_ANDAMENTO': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Em Andamento' },
      'ATENDIDO': { bg: 'bg-green-100', text: 'text-green-800', label: 'Atendido' },
      'RECUSADO': { bg: 'bg-red-100', text: 'text-red-800', label: 'Recusado' }
    };
    const badge = badges[status] || badges['NOVO'];
    return (
      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getPrioridadeBadge = (prioridade) => {
    const badges = {
      'URGENTE': { bg: 'bg-red-500', text: 'text-white', label: 'Urgente' },
      'ALTA': { bg: 'bg-orange-500', text: 'text-white', label: 'Alta' },
      'MÉDIA': { bg: 'bg-yellow-500', text: 'text-white', label: 'Média' },
      'BAIXA': { bg: 'bg-green-500', text: 'text-white', label: 'Baixa' }
    };
    const badge = badges[prioridade] || badges['MÉDIA'];
    return (
      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <ProtectedRoute module={MODULES.SOLICITACOES}>
      <Layout titulo="Solicitações">
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

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div 
            className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-gray-400"
            onClick={() => setStatusFiltro('')}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faFileAlt} className="text-gray-600 text-xl" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-blue-400"
            onClick={() => setStatusFiltro(statusFiltro === 'NOVO' ? '' : 'NOVO')}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-blue-600 text-xl" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{stats.novas}</div>
                <div className="text-sm text-gray-600">Novas</div>
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-yellow-400"
            onClick={() => setStatusFiltro(statusFiltro === 'EM_ANDAMENTO' ? '' : 'EM_ANDAMENTO')}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faClock} className="text-yellow-600 text-xl" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{stats.emAndamento}</div>
                <div className="text-sm text-gray-600">Em Andamento</div>
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-green-400"
            onClick={() => setStatusFiltro(statusFiltro === 'ATENDIDO' ? '' : 'ATENDIDO')}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faCheckCircle} className="text-green-600 text-xl" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{stats.atendidas}</div>
                <div className="text-sm text-gray-600">Atendidas</div>
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-red-400"
            onClick={() => setStatusFiltro(statusFiltro === 'RECUSADO' ? '' : 'RECUSADO')}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faBan} className="text-red-600 text-xl" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{stats.recusadas}</div>
                <div className="text-sm text-gray-600">Recusadas</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <FontAwesomeIcon 
                  icon={faSearch} 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Buscar por título, solicitante ou protocolo..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Todas as Categorias</option>
              <option value="Educação">Educação</option>
              <option value="Saúde">Saúde</option>
              <option value="Infraestrutura">Infraestrutura</option>
              <option value="Meio Ambiente">Meio Ambiente</option>
              <option value="Esporte e Lazer">Esporte e Lazer</option>
              <option value="Assistência Social">Assistência Social</option>
              <option value="Outros">Outros</option>
            </select>

            <select
              value={prioridadeFiltro}
              onChange={(e) => setPrioridadeFiltro(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Todas as Prioridades</option>
              <option value="URGENTE">Urgente</option>
              <option value="ALTA">Alta</option>
              <option value="MÉDIA">Média</option>
              <option value="BAIXA">Baixa</option>
            </select>

            <button
              onClick={handleNovaSolicitacao}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center justify-center gap-2 font-semibold"
            >
              <FontAwesomeIcon icon={faPlus} />
              Nova Solicitação
            </button>
          </div>

          {(statusFiltro || prioridadeFiltro || categoriaFiltro) && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">Filtros ativos:</span>
              {statusFiltro && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                  Status: {statusFiltro.replace('_', ' ')}
                </span>
              )}
              {prioridadeFiltro && (
                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
                  Prioridade: {prioridadeFiltro}
                </span>
              )}
              {categoriaFiltro && (
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                  Categoria: {categoriaFiltro}
                </span>
              )}
              <button
                onClick={() => {
                  setStatusFiltro('');
                  setPrioridadeFiltro('');
                  setCategoriaFiltro('');
                }}
                className="text-sm text-red-600 hover:text-red-700 font-semibold"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        {/* Lista de Solicitações */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Protocolo / Título
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Solicitante
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoria
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Local
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prioridade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {solicitacoesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-5xl text-gray-300" />
                        <p className="text-gray-500 text-lg">Nenhuma solicitação encontrada</p>
                        <p className="text-gray-400 text-sm">Tente ajustar os filtros ou criar uma nova solicitação</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  solicitacoesFiltradas.map((solicitacao) => (
                    <tr key={solicitacao.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{solicitacao.protocolo}</div>
                        <div className="text-sm text-gray-500">{solicitacao.titulo}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{solicitacao.solicitante}</div>
                        <div className="text-xs text-gray-500">{solicitacao.tipoSolicitante}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{solicitacao.categoria}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{solicitacao.municipio}</div>
                        <div className="text-xs text-gray-500">{solicitacao.bairro}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getPrioridadeBadge(solicitacao.prioridade)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(solicitacao.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(solicitacao.dataAbertura).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleVisualizarSolicitacao(solicitacao.id)}
                            className="text-teal-600 hover:text-teal-900"
                            title="Visualizar"
                          >
                            <FontAwesomeIcon icon={faEye} />
                          </button>
                          <button
                            onClick={() => router.push(`/solicitacoes/${solicitacao.id}`)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Editar"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            onClick={() => handleExcluirSolicitacao(solicitacao)}
                            className="text-red-600 hover:text-red-900"
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
        </div>

        {/* Rodapé com contagem */}
        <div className="mt-4 text-sm text-gray-600 text-center">
          Mostrando {solicitacoesFiltradas.length} de {solicitacoes.length} solicitações
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
