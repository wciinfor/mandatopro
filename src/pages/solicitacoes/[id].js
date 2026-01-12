import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faTimes, faExclamationTriangle, faUser, faMapMarkerAlt, faHistory,
  faClock, faCheckCircle, faBan, faEdit, faFileAlt, faPaperPlane
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { MODULES } from '@/utils/permissions';

export default function DetalhesSolicitacao() {
  const router = useRouter();
  const { id } = router.query;
  const { modalState, closeModal, showSuccess, showConfirm } = useModal();

  const [modoEdicao, setModoEdicao] = useState(false);
  const [novoComentario, setNovoComentario] = useState('');

  // Mock de solicitação (viria do banco de dados)
  const [solicitacao, setSolicitacao] = useState({
    id: 1,
    protocolo: 'SOL-2024-001',
    titulo: 'Reforma de escola municipal',
    solicitante: 'Maria Silva Santos',
    tipoSolicitante: 'Liderança',
    telefone: '(91) 99999-8888',
    email: 'maria@email.com',
    categoria: 'Educação',
    prioridade: 'ALTA',
    status: 'NOVO',
    municipio: 'Belém',
    bairro: 'Pedreira',
    endereco: 'Rua das Flores, 123',
    dataAbertura: '2024-11-15T10:30:00',
    dataUltimaAtualizacao: '2024-11-20T14:15:00',
    descricao: 'Solicitação de reforma completa da Escola Municipal João Paulo II, incluindo pintura externa e interna, troca de telhas danificadas, reforma dos banheiros e adaptação para acessibilidade.',
    observacoes: 'Escola atende cerca de 300 alunos do ensino fundamental.',
    atendente: null,
    historico: [
      {
        id: 1,
        data: '2024-11-15 10:30',
        usuario: 'Sistema',
        acao: 'Solicitação criada',
        descricao: 'Solicitação registrada no sistema'
      },
      {
        id: 2,
        data: '2024-11-16 09:15',
        usuario: 'Pedro Alves',
        acao: 'Comentário adicionado',
        descricao: 'Entramos em contato com a Secretaria de Educação'
      },
      {
        id: 3,
        data: '2024-11-18 14:30',
        usuario: 'Pedro Alves',
        acao: 'Prioridade alterada',
        descricao: 'Prioridade alterada de MÉDIA para ALTA'
      }
    ]
  });

  const [formData, setFormData] = useState({ ...solicitacao });

  useEffect(() => {
    if (id) {
      // Aqui você buscaria os dados do banco de dados
      setFormData({ ...solicitacao });
    }
  }, [id]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSalvar = () => {
    showConfirm('Salvar Alterações', 'Deseja salvar as alterações realizadas?', () => {
      // Aqui você salvaria no banco de dados
      setSolicitacao({ ...formData });
      setModoEdicao(false);
      showSuccess('Solicitação atualizada com sucesso!');
    });
  };

  const handleCancelar = () => {
    setFormData({ ...solicitacao });
    setModoEdicao(false);
  };

  const handleAdicionarComentario = () => {
    if (!novoComentario.trim()) return;

    const novoHistorico = {
      id: solicitacao.historico.length + 1,
      data: new Date().toLocaleString('pt-BR'),
      usuario: 'Usuário do Sistema',
      acao: 'Comentário adicionado',
      descricao: novoComentario
    };

    setSolicitacao(prev => ({
      ...prev,
      historico: [...prev.historico, novoHistorico]
    }));

    setNovoComentario('');
    showSuccess('Comentário adicionado!');
  };

  const handleAlterarStatus = (novoStatus) => {
    showConfirm(
      'Alterar Status',
      `Deseja alterar o status para ${getStatusLabel(novoStatus)}?`,
      () => {
        const novoHistorico = {
          id: solicitacao.historico.length + 1,
          data: new Date().toLocaleString('pt-BR'),
          usuario: 'Usuário do Sistema',
          acao: 'Status alterado',
          descricao: `Status alterado de ${getStatusLabel(solicitacao.status)} para ${getStatusLabel(novoStatus)}`
        };

        setSolicitacao(prev => ({
          ...prev,
          status: novoStatus,
          historico: [...prev.historico, novoHistorico]
        }));

        setFormData(prev => ({ ...prev, status: novoStatus }));
        showSuccess('Status atualizado!');
      }
    );
  };

  const getStatusLabel = (status) => {
    const labels = {
      'NOVO': 'Novo',
      'EM_ANDAMENTO': 'Em Andamento',
      'ATENDIDO': 'Atendido',
      'RECUSADO': 'Recusado'
    };
    return labels[status] || status;
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
      <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${badge.bg} ${badge.text}`}>
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
      <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <ProtectedRoute module={MODULES.SOLICITACOES}>
      <Layout titulo={`Solicitação ${solicitacao.protocolo}`}>
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

        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna Principal */}
            <div className="lg:col-span-2 space-y-6">
              {/* Cabeçalho com Status */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Protocolo</div>
                    <h1 className="text-2xl font-bold text-gray-900">{solicitacao.protocolo}</h1>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(solicitacao.status)}
                    {getPrioridadeBadge(solicitacao.prioridade)}
                  </div>
                </div>

                <h2 className="text-xl font-semibold text-gray-800 mb-4">{solicitacao.titulo}</h2>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Categoria:</span>
                    <span className="ml-2 font-semibold text-gray-900">{solicitacao.categoria}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Data Abertura:</span>
                    <span className="ml-2 font-semibold text-gray-900">
                      {new Date(solicitacao.dataAbertura).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ações Rápidas */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">ALTERAR STATUS</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAlterarStatus('EM_ANDAMENTO')}
                      disabled={solicitacao.status === 'EM_ANDAMENTO'}
                      className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <FontAwesomeIcon icon={faClock} className="mr-1" />
                      Em Andamento
                    </button>
                    <button
                      onClick={() => handleAlterarStatus('ATENDIDO')}
                      disabled={solicitacao.status === 'ATENDIDO'}
                      className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />
                      Atendido
                    </button>
                    <button
                      onClick={() => handleAlterarStatus('RECUSADO')}
                      disabled={solicitacao.status === 'RECUSADO'}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <FontAwesomeIcon icon={faBan} className="mr-1" />
                      Recusar
                    </button>
                  </div>
                </div>
              </div>

              {/* Descrição */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Descrição</h3>
                  {!modoEdicao && (
                    <button
                      onClick={() => setModoEdicao(true)}
                      className="text-teal-600 hover:text-teal-700 text-sm flex items-center gap-1"
                    >
                      <FontAwesomeIcon icon={faEdit} />
                      Editar
                    </button>
                  )}
                </div>

                {modoEdicao ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                      <textarea
                        value={formData.descricao}
                        onChange={(e) => handleChange('descricao', e.target.value)}
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                      <textarea
                        value={formData.observacoes}
                        onChange={(e) => handleChange('observacoes', e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSalvar}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
                      >
                        <FontAwesomeIcon icon={faSave} />
                        Salvar
                      </button>
                      <button
                        onClick={handleCancelar}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        <FontAwesomeIcon icon={faTimes} />
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{solicitacao.descricao}</p>
                    {solicitacao.observacoes && (
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                        <p className="text-sm text-gray-700">{solicitacao.observacoes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Histórico */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FontAwesomeIcon icon={faHistory} className="text-teal-600" />
                  Histórico de Alterações
                </h3>

                <div className="space-y-4">
                  {solicitacao.historico.map((item) => (
                    <div key={item.id} className="flex gap-4 pb-4 border-b last:border-b-0">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                          <FontAwesomeIcon icon={faFileAlt} className="text-teal-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">{item.acao}</p>
                            <p className="text-sm text-gray-600">{item.descricao}</p>
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {item.usuario} • {item.data}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Adicionar Comentário */}
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-semibold text-gray-800 mb-3">Adicionar Comentário</h4>
                  <div className="flex gap-2">
                    <textarea
                      value={novoComentario}
                      onChange={(e) => setNovoComentario(e.target.value)}
                      rows={2}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="Digite seu comentário..."
                    />
                    <button
                      onClick={handleAdicionarComentario}
                      disabled={!novoComentario.trim()}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FontAwesomeIcon icon={faPaperPlane} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna Lateral */}
            <div className="space-y-6">
              {/* Solicitante */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FontAwesomeIcon icon={faUser} className="text-blue-600" />
                  Solicitante
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-500">Nome</div>
                    <div className="font-semibold text-gray-900">{solicitacao.solicitante}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Tipo</div>
                    <div className="font-semibold text-gray-900">{solicitacao.tipoSolicitante}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Telefone</div>
                    <div className="font-semibold text-gray-900">{solicitacao.telefone}</div>
                  </div>
                  {solicitacao.email && (
                    <div>
                      <div className="text-sm text-gray-500">E-mail</div>
                      <div className="font-semibold text-gray-900 text-sm break-all">{solicitacao.email}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Localização */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FontAwesomeIcon icon={faMapMarkerAlt} className="text-purple-600" />
                  Localização
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-500">Município</div>
                    <div className="font-semibold text-gray-900">{solicitacao.municipio}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Bairro</div>
                    <div className="font-semibold text-gray-900">{solicitacao.bairro}</div>
                  </div>
                  {solicitacao.endereco && (
                    <div>
                      <div className="text-sm text-gray-500">Endereço</div>
                      <div className="font-semibold text-gray-900 text-sm">{solicitacao.endereco}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Atendente */}
              {solicitacao.atendente && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Atendente Responsável</h3>
                  <div className="font-semibold text-gray-900">{solicitacao.atendente}</div>
                </div>
              )}
            </div>
          </div>

          {/* Botão Voltar */}
          <div className="mt-6">
            <button
              onClick={() => router.push('/solicitacoes')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <FontAwesomeIcon icon={faTimes} className="mr-2" />
              Voltar para Lista
            </button>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
