import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faTimes, faExclamationTriangle, faUser, faMapMarkerAlt, 
  faAlignLeft, faFileAlt, faTags, faFlag
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { MODULES } from '@/utils/permissions';

export default function NovaSolicitacao() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess } = useModal();

  const [formData, setFormData] = useState({
    titulo: '',
    solicitante: '',
    tipoSolicitante: 'Morador',
    telefone: '',
    email: '',
    categoria: 'Educação',
    prioridade: 'MÉDIA',
    municipio: 'Belém',
    bairro: '',
    endereco: '',
    descricao: '',
    observacoes: '',
    documentos: []
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validações
    if (!formData.titulo || !formData.solicitante || !formData.descricao) {
      alert('Preencha todos os campos obrigatórios!');
      return;
    }

    // Gerar protocolo
    const protocolo = `SOL-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

    // Aqui você salvaria no banco de dados
    console.log('Nova Solicitação:', { ...formData, protocolo });

    showSuccess('Solicitação cadastrada com sucesso!');
    
    setTimeout(() => {
      router.push('/solicitacoes');
    }, 1500);
  };

  const handleCancelar = () => {
    router.push('/solicitacoes');
  };

  return (
    <ProtectedRoute module={MODULES.SOLICITACOES}>
      <Layout titulo="Nova Solicitação">
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

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          {/* Informações da Solicitação */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-teal-600 text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Informações da Solicitação</h2>
                <p className="text-sm text-gray-600">Dados principais do pedido</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  TÍTULO DA SOLICITAÇÃO *
                </label>
                <input
                  type="text"
                  value={formData.titulo}
                  onChange={(e) => handleChange('titulo', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="Ex: Reforma de escola municipal"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CATEGORIA *
                </label>
                <select
                  value={formData.categoria}
                  onChange={(e) => handleChange('categoria', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  required
                >
                  <option value="Educação">Educação</option>
                  <option value="Saúde">Saúde</option>
                  <option value="Infraestrutura">Infraestrutura</option>
                  <option value="Meio Ambiente">Meio Ambiente</option>
                  <option value="Esporte e Lazer">Esporte e Lazer</option>
                  <option value="Assistência Social">Assistência Social</option>
                  <option value="Segurança">Segurança</option>
                  <option value="Transporte">Transporte</option>
                  <option value="Cultura">Cultura</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PRIORIDADE *
                </label>
                <select
                  value={formData.prioridade}
                  onChange={(e) => handleChange('prioridade', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  required
                >
                  <option value="BAIXA">Baixa</option>
                  <option value="MÉDIA">Média</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Urgente</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  DESCRIÇÃO DETALHADA *
                </label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => handleChange('descricao', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="Descreva detalhadamente a solicitação..."
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  OBSERVAÇÕES
                </label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => handleChange('observacoes', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="Observações adicionais (opcional)"
                />
              </div>
            </div>
          </div>

          {/* Dados do Solicitante */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faUser} className="text-blue-600 text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Dados do Solicitante</h2>
                <p className="text-sm text-gray-600">Informações de quem está fazendo o pedido</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  NOME COMPLETO *
                </label>
                <input
                  type="text"
                  value={formData.solicitante}
                  onChange={(e) => handleChange('solicitante', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="Nome do solicitante"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  TIPO DE SOLICITANTE *
                </label>
                <select
                  value={formData.tipoSolicitante}
                  onChange={(e) => handleChange('tipoSolicitante', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  required
                >
                  <option value="Eleitor">Eleitor</option>
                  <option value="Liderança">Liderança</option>
                  <option value="Morador">Morador</option>
                  <option value="Entidade">Entidade/Organização</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  TELEFONE *
                </label>
                <input
                  type="tel"
                  value={formData.telefone}
                  onChange={(e) => handleChange('telefone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="(00) 00000-0000"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-MAIL
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>
          </div>

          {/* Localização */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faMapMarkerAlt} className="text-purple-600 text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Localização</h2>
                <p className="text-sm text-gray-600">Onde está localizada a solicitação</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  MUNICÍPIO *
                </label>
                <select
                  value={formData.municipio}
                  onChange={(e) => handleChange('municipio', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  required
                >
                  <option value="Belém">Belém</option>
                  <option value="Ananindeua">Ananindeua</option>
                  <option value="Marituba">Marituba</option>
                  <option value="Benevides">Benevides</option>
                  <option value="Santa Bárbara">Santa Bárbara</option>
                  <option value="Castanhal">Castanhal</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  BAIRRO *
                </label>
                <input
                  type="text"
                  value={formData.bairro}
                  onChange={(e) => handleChange('bairro', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="Nome do bairro"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ENDEREÇO COMPLETO
                </label>
                <input
                  type="text"
                  value={formData.endereco}
                  onChange={(e) => handleChange('endereco', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="Rua, número, complemento (opcional)"
                />
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelar}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faTimes} />
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faSave} />
              Salvar Solicitação
            </button>
          </div>
        </form>
      </Layout>
    </ProtectedRoute>
  );
}
