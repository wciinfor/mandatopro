import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarAlt, faMapMarkerAlt, faClock, faUsers, faCheckCircle, faEdit, faTrash, faArrowLeft, faUserCheck, faComments, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { MODULES } from '@/utils/permissions';

export default function DetalhesEvento() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [modalExcluir, setModalExcluir] = useState(false);
  const [modalConfirmar, setModalConfirmar] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [evento, setEvento] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [participantes, setParticipantes] = useState([]);

  useEffect(() => {
    if (id) {
      carregarEvento();
    }
  }, [id]);

  const carregarEvento = async () => {
    setCarregando(true);
    try {
      const res = await fetch('/api/agenda');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar evento');
      const data = (json.data || []).find(e => String(e.id) === String(id));
      if (!data) throw new Error('Evento não encontrado');

      setEvento({
        ...data,
        horaInicio: data.horaInicio || data.hora_inicio || '',
        horaFim: data.horaFim || data.hora_fim || '',
        confirmados: data.confirmados ?? 0,
        participantes: data.participantes ?? 0
      });
      setParticipantes([]);
    } catch (error) {
      console.error('Erro ao carregar evento:', error);
    } finally {
      setCarregando(false);
    }
  };

  const handleExcluir = () => {
    setModalExcluir(true);
  };

  const confirmarExclusao = async () => {
    try {
      const res = await fetch(`/api/agenda?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao excluir evento');
      router.push('/agenda');
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
    }
  };

  const handleConfirmarPresenca = () => {
    setModalConfirmar(true);
  };

  const confirmarPresenca = async () => {
    if (!evento) return;

    const novoConfirmados = (evento.confirmados || 0) + 1;

    try {
      const res = await fetch('/api/agenda', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: evento.id, confirmados: novoConfirmados })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao confirmar presença');

      setEvento({ ...evento, confirmados: novoConfirmados });
      setConfirmado(true);
      setModalConfirmar(false);
    } catch (error) {
      console.error('Erro ao confirmar presença:', error);
      setModalConfirmar(false);
    }
  };

  const formatarData = (dataStr) => {
    const data = new Date(dataStr + 'T00:00:00');
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) + ' (' + dias[data.getDay()] + ')';
  };

  const podeEditar = user?.nivel === 'ADMINISTRADOR' || evento?.criado_por_id === user?.id;

  if (carregando) {
    return (
      <ProtectedRoute module={MODULES.AGENDA}>
        <Layout titulo="Detalhes do Evento">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <FontAwesomeIcon icon={faSpinner} className="text-teal-600 text-3xl mb-3 animate-spin" />
              <p className="text-gray-600">Carregando evento...</p>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!evento) {
    return (
      <ProtectedRoute module={MODULES.AGENDA}>
        <Layout titulo="Detalhes do Evento">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <p className="text-gray-600">Evento não encontrado.</p>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute module={MODULES.AGENDA}>
      <Layout titulo="Detalhes do Evento">
        {/* Botão Voltar */}
        <button
          onClick={() => router.back()}
          className="mb-6 text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          Voltar para Agenda
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card Principal do Evento */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${
                      evento.tipo === 'PARLAMENTAR' 
                        ? 'bg-blue-100 text-blue-700' 
                        : evento.tipo === 'LOCAL'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-teal-100 text-teal-700'
                    }`}>
                      {evento.tipo === 'PARLAMENTAR'
                        ? '📋 Agenda Parlamentar'
                        : evento.tipo === 'LOCAL'
                          ? '📍 Agenda Local'
                          : '🎯 Evento'}
                    </span>
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                      {evento.categoria}
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold text-gray-800 mb-2">
                    {evento.titulo}
                  </h1>
                </div>

                {/* Ações */}
                {podeEditar && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/agenda/novo?id=${id}`)}
                      className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                      title="Editar evento"
                    >
                      <FontAwesomeIcon icon={faEdit} className="text-lg" />
                    </button>
                    <button
                      onClick={handleExcluir}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir evento"
                    >
                      <FontAwesomeIcon icon={faTrash} className="text-lg" />
                    </button>
                  </div>
                )}
              </div>

              {/* Informações Principais */}
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <FontAwesomeIcon icon={faCalendarAlt} className="text-teal-600 text-xl mt-1" />
                  <div>
                    <div className="font-semibold text-gray-700">Data</div>
                    <div className="text-gray-600">{formatarData(evento.data)}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <FontAwesomeIcon icon={faClock} className="text-teal-600 text-xl mt-1" />
                  <div>
                    <div className="font-semibold text-gray-700">Horário</div>
                    <div className="text-gray-600">{evento.horaInicio} às {evento.horaFim}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <FontAwesomeIcon icon={faMapMarkerAlt} className="text-teal-600 text-xl mt-1" />
                  <div>
                    <div className="font-semibold text-gray-700">Local</div>
                    <div className="text-gray-600">{evento.local}</div>
                    {evento.endereco && (
                      <div className="text-sm text-gray-500 mt-1">{evento.endereco}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Descrição */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FontAwesomeIcon icon={faComments} className="text-teal-600" />
                  Descrição
                </h3>
                <p className="text-gray-600 leading-relaxed">{evento.descricao}</p>
              </div>

              {/* Observações */}
              {evento.observacoes && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-semibold text-gray-700 mb-2">Observações</h3>
                  <p className="text-gray-600">{evento.observacoes}</p>
                </div>
              )}

              {/* Botão de Confirmação */}
              {!confirmado && evento.permitirConfirmacao !== false && (
                <div className="border-t pt-6 mt-6">
                  <button
                    onClick={handleConfirmarPresenca}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <FontAwesomeIcon icon={faUserCheck} />
                    Confirmar Minha Presença
                  </button>
                </div>
              )}

              {confirmado && (
                <div className="border-t pt-6 mt-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                    <FontAwesomeIcon icon={faCheckCircle} className="text-green-600 text-2xl" />
                    <div>
                      <div className="font-semibold text-green-800">Presença Confirmada!</div>
                      <div className="text-sm text-green-600">Sua presença foi registrada com sucesso.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Lista de Participantes */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faUsers} className="text-teal-600" />
                Participantes ({evento.participantes ?? 0})
              </h3>

              {/* Estatísticas */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {evento.confirmados ?? 0}
                  </div>
                  <div className="text-sm text-gray-600">Confirmados</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {Math.max((evento.participantes ?? 0) - (evento.confirmados ?? 0), 0)}
                  </div>
                  <div className="text-sm text-gray-600">Pendentes</div>
                </div>
              </div>

              {/* Lista */}
              <div className="space-y-2">
                {participantes.length === 0 ? (
                  <div className="text-sm text-gray-500">Sem participantes cadastrados.</div>
                ) : (
                  participantes.map((participante) => (
                    <div
                      key={participante.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        participante.status === 'CONFIRMADO' ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {participante.foto ? (
                          <img src={participante.foto} alt={participante.nome} className="w-10 h-10 rounded-full" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">
                              {participante.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-gray-800">{participante.nome}</div>
                          {participante.dataConfirmacao && (
                            <div className="text-xs text-gray-500">
                              Confirmado em {new Date(participante.dataConfirmacao).toLocaleDateString('pt-BR')}
                            </div>
                          )}
                        </div>
                      </div>

                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        participante.status === 'CONFIRMADO'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {participante.status === 'CONFIRMADO' ? '✓ Confirmado' : 'Pendente'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Coluna Lateral */}
          <div className="space-y-6">
            {/* Card de Informações */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-bold text-gray-800 mb-4">Informações</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-gray-600">Criado por</div>
                  <div className="font-semibold text-gray-800">
                    {evento.criado_por_id ? `Usuario #${evento.criado_por_id}` : 'Nao informado'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600">Data de criação</div>
                  <div className="font-semibold text-gray-800">
                    {evento.created_at ? new Date(evento.created_at).toLocaleString('pt-BR') : 'Nao informado'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600">Última atualização</div>
                  <div className="font-semibold text-gray-800">
                    {evento.updated_at ? new Date(evento.updated_at).toLocaleString('pt-BR') : 'Nao informado'}
                  </div>
                </div>
              </div>
            </div>

            {/* Card de Estatísticas */}
            <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-lg shadow-sm p-6 text-white">
              <h3 className="font-bold mb-4">Resumo</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Total de Participantes</span>
                  <span className="text-2xl font-bold">{evento.participantes ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Taxa de Confirmação</span>
                  <span className="text-2xl font-bold">
                    {(evento.participantes ?? 0) > 0
                      ? Math.round(((evento.confirmados ?? 0) / (evento.participantes ?? 0)) * 100)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal de Exclusão */}
        <Modal
          isOpen={modalExcluir}
          onClose={() => setModalExcluir(false)}
          onConfirm={confirmarExclusao}
          title="Excluir Evento"
          message={`Tem certeza que deseja excluir o evento "${evento.titulo}"? Esta ação não pode ser desfeita.`}
          type="confirm"
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          showCancel={true}
        />

        {/* Modal de Confirmação de Presença */}
        <Modal
          isOpen={modalConfirmar}
          onClose={() => setModalConfirmar(false)}
          onConfirm={confirmarPresenca}
          title="Confirmar Presença"
          message={`Deseja confirmar sua presença no evento "${evento.titulo}"?`}
          type="confirm"
          confirmText="Sim, Confirmar"
          cancelText="Cancelar"
          showCancel={true}
        />
      </Layout>
    </ProtectedRoute>
  );
}
