import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faArrowLeft, faUserTie, faEdit, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import supabase from '@/lib/supabaseClient';

export default function EditarResponsavel() {
  const router = useRouter();
  const { id } = router.query;
  const { modalState, closeModal, showSuccess, showError, showWarning } = useModal();

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    cargo: '',
    orgao: '',
    cpf: '',
    telefone: '',
    email: '',
    whatsapp: '',
    observacoes: '',
    status: 'ATIVO'
  });

  useEffect(() => {
    if (id) {
      carregarResponsavel();
    }
  }, [id]);

  const carregarResponsavel = async () => {
    setCarregando(true);
    try {
      let { data, error } = await supabase
        .from('responsaveis_emendas')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          nome: data.nome || '',
          cargo: data.cargo || '',
          orgao: data.orgao || '',
          cpf: data.cpf || '',
          telefone: data.telefone || '',
          email: data.email || '',
          whatsapp: data.whatsapp || '',
          observacoes: data.observacoes || '',
          status: data.status || 'ATIVO'
        });
      }
    } catch (error) {
      console.error('Erro ao carregar responsável:', error);
      showError('Erro ao carregar dados do responsável');
    } finally {
      setCarregando(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validações
    if (!formData.nome || !formData.cargo || !formData.orgao) {
      showWarning('Preencha todos os campos obrigatórios: Nome, Cargo e Órgão!');
      return;
    }

    setSalvando(true);

    try {
      let { error } = await supabase
        .from('responsaveis_emendas')
        .update({
          nome: formData.nome,
          cargo: formData.cargo,
          orgao: formData.orgao,
          cpf: formData.cpf || null,
          telefone: formData.telefone || null,
          email: formData.email || null,
          whatsapp: formData.whatsapp || null,
          observacoes: formData.observacoes || null,
          status: formData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      showSuccess('Responsável atualizado com sucesso!');
      setTimeout(() => {
        router.push('/emendas/responsaveis');
      }, 2000);
    } catch (error) {
      console.error('Erro ao atualizar responsável:', error);
      showError('Erro ao atualizar responsável. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <Layout titulo="Editar Responsável">
        <div className="flex items-center justify-center h-screen">
          <FontAwesomeIcon icon={faSpinner} className="text-4xl animate-spin text-teal-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout titulo="Editar Responsável">
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

      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <FontAwesomeIcon icon={faEdit} className="text-teal-600 text-2xl" />
          <h2 className="text-2xl font-bold text-gray-800">Editar Responsável</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nome */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            {/* Cargo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cargo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="cargo"
                value={formData.cargo}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            {/* Órgão */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Órgão <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="orgao"
                value={formData.orgao}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            {/* CPF */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CPF
              </label>
              <input
                type="text"
                name="cpf"
                value={formData.cpf}
                onChange={handleInputChange}
                placeholder="000.000.000-00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Telefone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefone
              </label>
              <input
                type="text"
                name="telefone"
                value={formData.telefone}
                onChange={handleInputChange}
                placeholder="(00) 0000-0000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                E-mail
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* WhatsApp */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                WhatsApp
              </label>
              <input
                type="text"
                name="whatsapp"
                value={formData.whatsapp}
                onChange={handleInputChange}
                placeholder="(00) 00000-0000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
              </select>
            </div>

            {/* Observações */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observações
              </label>
              <textarea
                name="observacoes"
                value={formData.observacoes}
                onChange={handleInputChange}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-4 justify-end pt-6 border-t">
            <button
              type="button"
              onClick={() => router.push('/emendas/responsaveis')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
              disabled={salvando}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              Voltar para Lista
            </button>

            <button
              type="submit"
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
              disabled={salvando}
            >
              <FontAwesomeIcon icon={faSave} />
              {salvando ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
