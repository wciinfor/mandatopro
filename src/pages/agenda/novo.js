import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarAlt, faSave, faTimes, faArrowLeft
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { MODULES } from '@/utils/permissions';

export default function NovoEvento() {
  const router = useRouter();
  const { user } = useAuth();
  const [modalSucesso, setModalSucesso] = useState(false);

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    data: '',
    horaInicio: '',
    horaFim: '',
    local: '',
    endereco: '',
    tipo: user?.nivel === 'ADMINISTRADOR' ? 'PARLAMENTAR' : 'LOCAL',
    categoria: 'Reunião',
    observacoes: '',
    permitirConfirmacao: true
  });

  const categorias = [
    'Reunião',
    'Evento Público',
    'Atendimento',
    'Evento Religioso',
    'Inauguração',
    'Visita Técnica',
    'Audiência Pública',
    'Sessão Ordinária',
    'Sessão Extraordinária',
    'Outros'
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validações
    if (!formData.titulo || !formData.data || !formData.horaInicio || !formData.horaFim || !formData.local) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    console.log('Salvando evento:', formData);
    setModalSucesso(true);
  };

  const handleSucessoClose = () => {
    setModalSucesso(false);
    router.push('/agenda');
  };

  return (
    <ProtectedRoute module={MODULES.AGENDA}>
      <Layout titulo="Novo Evento">
        {/* Botão Voltar */}
        <button
          onClick={() => router.back()}
          className="mb-6 text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          Voltar para Agenda
        </button>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna Principal */}
            <div className="lg:col-span-2 space-y-6">
              {/* Informações Básicas */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                    <FontAwesomeIcon icon={faCalendarAlt} className="text-teal-600 text-xl" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Informações do Evento</h2>
                    <p className="text-sm text-gray-600">Preencha os dados principais do evento</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Tipo de Evento */}
                  {user?.nivel === 'ADMINISTRADOR' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        TIPO DE EVENTO <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="tipo"
                        value={formData.tipo}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="PARLAMENTAR">📋 Agenda Parlamentar (visível para todos)</option>
                        <option value="LOCAL">📍 Agenda Local (visível apenas para sua equipe)</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.tipo === 'PARLAMENTAR' 
                          ? 'Este evento será visível para todos os usuários do sistema'
                          : 'Este evento será visível apenas para você e seus operadores'}
                      </p>
                    </div>
                  )}

                  {user?.nivel === 'LIDERANCA' && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <p className="text-sm text-purple-800">
                        <strong>📍 Agenda Local:</strong> Este evento será visível apenas para você e seus operadores.
                      </p>
                    </div>
                  )}

                  {/* Título */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      TÍTULO DO EVENTO <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="titulo"
                      value={formData.titulo}
                      onChange={handleChange}
                      required
                      placeholder="Ex: Reunião com Líderes Comunitários"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  {/* Categoria */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CATEGORIA <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="categoria"
                      value={formData.categoria}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    >
                      {categorias.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Descrição */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      DESCRIÇÃO
                    </label>
                    <textarea
                      name="descricao"
                      value={formData.descricao}
                      onChange={handleChange}
                      rows={4}
                      placeholder="Descreva os detalhes do evento..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Data e Horário */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Data e Horário</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Data */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      DATA <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="data"
                      value={formData.data}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  {/* Hora Início */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      HORA INÍCIO <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      name="horaInicio"
                      value={formData.horaInicio}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  {/* Hora Fim */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      HORA FIM <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      name="horaFim"
                      value={formData.horaFim}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Localização */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Localização</h3>
                <div className="space-y-4">
                  {/* Local */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      LOCAL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="local"
                      value={formData.local}
                      onChange={handleChange}
                      required
                      placeholder="Ex: Salão Paroquial - Pedreira"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  {/* Endereço Completo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ENDEREÇO COMPLETO
                    </label>
                    <input
                      type="text"
                      name="endereco"
                      value={formData.endereco}
                      onChange={handleChange}
                      placeholder="Rua, número, bairro, cidade - UF"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Observações Adicionais</h3>
                <textarea
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Informações adicionais, instruções, materiais necessários, etc..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Coluna Lateral */}
            <div className="space-y-6">
              {/* Card de Configurações */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="font-bold text-gray-800 mb-4">Configurações</h3>
                
                {/* Permitir Confirmação */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="permitirConfirmacao"
                    name="permitirConfirmacao"
                    checked={formData.permitirConfirmacao}
                    onChange={handleChange}
                    className="mt-1 w-4 h-4 text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="permitirConfirmacao" className="text-sm text-gray-700">
                    <div className="font-semibold">Permitir confirmação de presença</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Participantes poderão confirmar presença no evento
                    </div>
                  </label>
                </div>
              </div>

              {/* Card de Ajuda */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-bold text-blue-900 mb-2">💡 Dicas</h3>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li>• Seja claro e objetivo no título</li>
                  <li>• Adicione todos os detalhes importantes na descrição</li>
                  <li>• Inclua o endereço completo para facilitar a localização</li>
                  <li>• Use observações para instruções especiais</li>
                </ul>
              </div>

              {/* Botões de Ação */}
              <div className="bg-white rounded-lg shadow-sm p-6 space-y-3">
                <button
                  type="submit"
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <FontAwesomeIcon icon={faSave} />
                  Salvar Evento
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <FontAwesomeIcon icon={faTimes} />
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Modal de Sucesso */}
        <Modal
          isOpen={modalSucesso}
          onClose={handleSucessoClose}
          title="Evento Criado!"
          message="O evento foi criado com sucesso e já está disponível na agenda."
          type="success"
          confirmText="Ir para Agenda"
        />
      </Layout>
    </ProtectedRoute>
  );
}
