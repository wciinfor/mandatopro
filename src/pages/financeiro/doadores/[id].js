import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { applyMask, onlyDigits } from '@/utils/inputMasks';
import ProtectedRoute from '@/components/ProtectedRoute';
import { MODULES } from '@/utils/permissions';

export default function EditarDoador() {
  const router = useRouter();
  const { id } = router.query;
  const { modalState, closeModal, showSuccess, showError } = useModal();

  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    tipo: 'PESSOA_FISICA',
    cpf: '',
    cnpj: '',
    email: '',
    telefone: '',
    endereco: '',
    status: 'ATIVO',
    observacoes: ''
  });
  const [loading, setLoading] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (id) carregarDoador();
  }, [id]);

  const carregarDoador = async () => {
    try {
      setCarregando(true);
      const usuario = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('usuario') || 'null')
        : null;
      const response = await fetch(`/api/financeiro/parceiros/${id}`, {
        headers: { usuario: usuario ? JSON.stringify(usuario) : '' }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Erro ao carregar doador');
      }
      const item = data.data || {};
      setFormData({
        codigo: item.codigo || '',
        nome: item.nome || '',
        tipo: item.tipo || 'PESSOA_FISICA',
        cpf: applyMask('cpf', item.cpf || ''),
        cnpj: item.cnpj || '',
        email: item.email || '',
        telefone: applyMask('telefone', item.telefone || ''),
        endereco: item.endereco || '',
        status: item.status || 'ATIVO',
        observacoes: item.observacoes || ''
      });
    } catch (error) {
      showError('Erro ao carregar doador: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const maskedValue = applyMask(name, value);
    setFormData((prev) => ({ ...prev, [name]: maskedValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome || !formData.tipo) {
      showError('Nome e tipo sao obrigatorios');
      return;
    }

    try {
      setLoading(true);
      const usuario = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('usuario') || 'null')
        : null;
      const response = await fetch(`/api/financeiro/parceiros/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          usuario: usuario ? JSON.stringify(usuario) : ''
        },
        body: JSON.stringify({
          ...formData,
          cpf: onlyDigits(formData.cpf),
          telefone: onlyDigits(formData.telefone)
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Erro ao atualizar doador');
      }

      showSuccess('Doador atualizado com sucesso!');
      router.push('/financeiro/doadores');
    } catch (error) {
      showError('Erro ao salvar doador: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute module={MODULES.FINANCEIRO}>
    <Layout titulo="Editar Doador">
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

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => router.push('/financeiro/doadores')}
            className="text-gray-600 hover:text-gray-900"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <h3 className="text-lg font-semibold text-gray-800">Editar Doador/Parceiro</h3>
        </div>

        {carregando ? (
          <div className="text-center py-6 text-gray-500">Carregando...</div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Codigo</label>
              <input
                type="text"
                name="codigo"
                value={formData.codigo}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                name="tipo"
                value={formData.tipo}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="PESSOA_FISICA">Pessoa Fisica</option>
                <option value="PESSOA_JURIDICA">Pessoa Juridica</option>
                <option value="OUTROS">Outros</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
              <input
                type="text"
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
              <input
                type="text"
                name="cnpj"
                value={formData.cnpj}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                type="text"
                name="telefone"
                value={formData.telefone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Endereco</label>
              <input
                type="text"
                name="endereco"
                value={formData.endereco}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observacoes</label>
              <textarea
                name="observacoes"
                value={formData.observacoes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faSave} />
                Salvar
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
    </ProtectedRoute>
  );
}
