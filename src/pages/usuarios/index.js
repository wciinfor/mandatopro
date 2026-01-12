import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers, faPlus, faEdit, faTrash, faSearch, faUserShield, faKey, faCrown, faUserTie, faUser, faLock, faUnlock
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { ROLES, ROLE_DESCRIPTIONS, getRoleColor } from '@/utils/permissions';

export default function Usuarios() {
  const router = useRouter();
  const { modalState, closeModal, showConfirm, showSuccess } = useModal();

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroNivel, setFiltroNivel] = useState('TODOS');
  const [filtroStatus, setFiltroStatus] = useState('ATIVO');

  // Dados mock de usuários
  const [usuarios, setUsuarios] = useState([
    {
      id: 1,
      nome: 'Admin Sistema',
      email: 'admin@mandatopro.com',
      nivel: ROLES.ADMINISTRADOR,
      status: 'ATIVO',
      liderancaVinculada: null,
      dataCadastro: '2024-01-15',
      ultimoAcesso: '2024-01-20 14:30'
    },
    {
      id: 2,
      nome: 'João Silva Santos',
      email: 'joao.silva@mandatopro.com',
      nivel: ROLES.LIDERANCA,
      status: 'ATIVO',
      liderancaVinculada: null,
      dataCadastro: '2024-02-10',
      ultimoAcesso: '2024-01-20 10:15'
    },
    {
      id: 3,
      nome: 'Maria Costa Oliveira',
      email: 'maria.costa@mandatopro.com',
      nivel: ROLES.OPERADOR,
      status: 'ATIVO',
      liderancaVinculada: 2, // Vinculado ao João Silva
      dataCadastro: '2024-03-05',
      ultimoAcesso: '2024-01-20 09:45'
    },
    {
      id: 4,
      nome: 'Carlos Mendes',
      email: 'carlos.mendes@mandatopro.com',
      nivel: ROLES.OPERADOR,
      status: 'INATIVO',
      liderancaVinculada: 2,
      dataCadastro: '2024-02-20',
      ultimoAcesso: '2024-01-15 16:20'
    }
  ]);

  const usuariosFiltrados = usuarios.filter(usuario => {
    const matchBusca = busca === '' || 
      usuario.nome.toLowerCase().includes(busca.toLowerCase()) ||
      usuario.email.toLowerCase().includes(busca.toLowerCase());
    const matchNivel = filtroNivel === 'TODOS' || usuario.nivel === filtroNivel;
    const matchStatus = usuario.status === filtroStatus;
    return matchBusca && matchNivel && matchStatus;
  });

  const totalUsuarios = usuarios.length;
  const totalAdmins = usuarios.filter(u => u.nivel === ROLES.ADMINISTRADOR).length;
  const totalLiderancas = usuarios.filter(u => u.nivel === ROLES.LIDERANCA).length;
  const totalOperadores = usuarios.filter(u => u.nivel === ROLES.OPERADOR).length;
  const totalAtivos = usuarios.filter(u => u.status === 'ATIVO').length;

  const handleNovo = () => {
    router.push('/usuarios/novo');
  };

  const handleEditar = (id) => {
    router.push(`/usuarios/${id}`);
  };

  const handleExcluir = (usuario) => {
    showConfirm(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir o usuário "${usuario.nome}"? Esta ação não poderá ser desfeita.`,
      () => {
        setUsuarios(usuarios.filter(u => u.id !== usuario.id));
        showSuccess('Usuário excluído com sucesso!');
      }
    );
  };

  const handleAlterarStatus = (usuario) => {
    const novoStatus = usuario.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    const acao = novoStatus === 'ATIVO' ? 'ativar' : 'desativar';
    
    showConfirm(
      `Confirmar ${acao.charAt(0).toUpperCase() + acao.slice(1)}`,
      `Tem certeza que deseja ${acao} o usuário "${usuario.nome}"?`,
      () => {
        setUsuarios(usuarios.map(u => 
          u.id === usuario.id ? { ...u, status: novoStatus } : u
        ));
        showSuccess(`Usuário ${novoStatus === 'ATIVO' ? 'ativado' : 'desativado'} com sucesso!`);
      }
    );
  };

  const handleResetarSenha = (usuario) => {
    showConfirm(
      'Resetar Senha',
      `Deseja resetar a senha do usuário "${usuario.nome}"? Uma nova senha temporária será gerada e enviada por email.`,
      () => {
        // Gerar senha temporária (6 caracteres aleatórios)
        const senhaTemporaria = Math.random().toString(36).slice(-8).toUpperCase();
        
        // Aqui você integraria com sua API/Supabase para:
        // 1. Atualizar a senha no banco de dados
        // 2. Enviar email com a nova senha
        
        console.log(`Senha temporária gerada para ${usuario.email}: ${senhaTemporaria}`);
        
        // Atualizar o usuário localmente (simulação)
        setUsuarios(usuarios.map(u => 
          u.id === usuario.id 
            ? { ...u, senhaTemporaria: senhaTemporaria, deveAlterarSenha: true }
            : u
        ));
        
        showSuccess(
          `Senha resetada com sucesso!\n\nSenha temporária: ${senhaTemporaria}\n\nO usuário deverá alterar a senha no próximo acesso.\n\n(Em produção, esta senha seria enviada por email)`
        );
      }
    );
  };

  const getLiderancaNome = (liderancaId) => {
    if (!liderancaId) return '-';
    const lideranca = usuarios.find(u => u.id === liderancaId);
    return lideranca ? lideranca.nome : 'Não encontrado';
  };

  const getRoleIcon = (nivel) => {
    switch (nivel) {
      case ROLES.ADMINISTRADOR:
        return faCrown;
      case ROLES.LIDERANCA:
        return faUserTie;
      case ROLES.OPERADOR:
        return faUser;
      default:
        return faUser;
    }
  };

  return (
    <Layout titulo="Gerenciamento de Usuários">
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-teal-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Usuários</p>
              <p className="text-2xl font-bold text-teal-600">{totalUsuarios}</p>
            </div>
            <FontAwesomeIcon icon={faUsers} className="text-3xl text-teal-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Administradores</p>
              <p className="text-2xl font-bold text-red-600">{totalAdmins}</p>
            </div>
            <FontAwesomeIcon icon={faCrown} className="text-3xl text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Lideranças</p>
              <p className="text-2xl font-bold text-purple-600">{totalLiderancas}</p>
            </div>
            <FontAwesomeIcon icon={faUserTie} className="text-3xl text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Operadores</p>
              <p className="text-2xl font-bold text-blue-600">{totalOperadores}</p>
            </div>
            <FontAwesomeIcon icon={faUser} className="text-3xl text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Usuários Ativos</p>
              <p className="text-2xl font-bold text-green-600">{totalAtivos}</p>
            </div>
            <FontAwesomeIcon icon={faUserShield} className="text-3xl text-green-500" />
          </div>
        </div>
      </div>

      {/* Filtros e Ações */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">BUSCAR USUÁRIO</label>
            <div className="relative">
              <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou email..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NÍVEL DE ACESSO</label>
            <select
              value={filtroNivel}
              onChange={(e) => setFiltroNivel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="TODOS">Todos os níveis</option>
              <option value={ROLES.ADMINISTRADOR}>Administrador</option>
              <option value={ROLES.LIDERANCA}>Liderança</option>
              <option value={ROLES.OPERADOR}>Operador</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">STATUS</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="ATIVO">Ativos</option>
              <option value="INATIVO">Inativos</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={handleNovo}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <FontAwesomeIcon icon={faPlus} />
            Novo Usuário
          </button>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nível de Acesso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Liderança Vinculada
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Último Acesso
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {usuariosFiltrados.map((usuario) => (
                <tr key={usuario.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-teal-100 rounded-full flex items-center justify-center">
                        <FontAwesomeIcon icon={getRoleIcon(usuario.nivel)} className="text-teal-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{usuario.nome}</div>
                        <div className="text-sm text-gray-500">ID: {usuario.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{usuario.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(usuario.nivel)}`}>
                      {usuario.nivel}
                    </span>
                    <div className="text-xs text-gray-500 mt-1">
                      {ROLE_DESCRIPTIONS[usuario.nivel]}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {getLiderancaNome(usuario.liderancaVinculada)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      usuario.status === 'ATIVO' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {usuario.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {usuario.ultimoAcesso}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEditar(usuario.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Editar"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        onClick={() => handleResetarSenha(usuario)}
                        className="text-yellow-600 hover:text-yellow-900"
                        title="Resetar Senha"
                      >
                        <FontAwesomeIcon icon={faKey} />
                      </button>
                      <button
                        onClick={() => handleAlterarStatus(usuario)}
                        className={usuario.status === 'ATIVO' ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}
                        title={usuario.status === 'ATIVO' ? 'Desativar' : 'Ativar'}
                      >
                        <FontAwesomeIcon icon={usuario.status === 'ATIVO' ? faLock : faUnlock} />
                      </button>
                      <button
                        onClick={() => handleExcluir(usuario)}
                        className="text-red-600 hover:text-red-900"
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
        </div>

        {usuariosFiltrados.length === 0 && (
          <div className="text-center py-12">
            <FontAwesomeIcon icon={faUsers} className="text-6xl text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum usuário encontrado</h3>
            <p className="text-gray-500">Tente ajustar os filtros de busca</p>
          </div>
        )}
      </div>

      {/* Informações sobre Níveis de Acesso */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
        <div className="flex items-start gap-3">
          <FontAwesomeIcon icon={faUserShield} className="text-blue-600 text-xl mt-1" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">Informações sobre Níveis de Acesso</h4>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <FontAwesomeIcon icon={faCrown} className="text-red-600 mt-1" />
                <div>
                  <strong>Administrador:</strong> Acesso total à plataforma, incluindo módulos financeiros e jurídicos. Visualiza todos os registros do sistema.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <FontAwesomeIcon icon={faUserTie} className="text-purple-600 mt-1" />
                <div>
                  <strong>Liderança:</strong> Gerencia equipes e áreas sob sua administração. Visualiza apenas registros de sua equipe, suas agendas e solicitações. Não tem acesso a módulos financeiros.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <FontAwesomeIcon icon={faUser} className="text-blue-600 mt-1" />
                <div>
                  <strong>Operador:</strong> Realiza apenas cadastros. Visualiza somente os registros que ele próprio criou. Acesso limitado aos módulos de cadastro.
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}
