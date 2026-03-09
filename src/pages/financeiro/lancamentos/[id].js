import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';

export default function EditarLancamento() {
  const router = useRouter();
  const { id } = router.query;
  const { modalState, closeModal, showSuccess, showError } = useModal();

  const [formData, setFormData] = useState({
    codigo: '',
    data_lancamento: '',
    tipo: 'DOACAO',
    categoria: '',
    parceiro_nome: '',
    valor: '',
    forma_pagamento: '',
    descricao: '',
    status: 'PENDENTE'
  });
  const [loading, setLoading] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (id) carregarLancamento();
  }, [id]);

  const carregarLancamento = async () => {
    try {
      setCarregando(true);
      const usuario = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('usuario') || 'null')
        : null;
      const response = await fetch(`/api/financeiro/lancamentos/${id}`, {
        headers: {
          usuario: usuario ? JSON.stringify(usuario) : ''
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Erro ao carregar lancamento');
      }
      const item = data.data || {};
      setFormData({
        codigo: item.codigo || '',
        data_lancamento: item.data_lancamento || '',
        tipo: item.tipo || 'DOACAO',
        categoria: item.categoria || '',
        parceiro_nome: item.parceiro_nome || '',
        valor: item.valor || '',
        forma_pagamento: item.forma_pagamento || '',
        descricao: item.descricao || '',
        status: item.status || 'PENDENTE'
      });
    } catch (error) {
      showError('Erro ao carregar lancamento: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.data_lancamento || !formData.tipo || !formData.valor) {
      showError('Data, tipo e valor sao obrigatorios');
      return;
    }

    try {
      setLoading(true);
      const usuario = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('usuario') || 'null')
        : null;
      const response = await fetch(`/api/financeiro/lancamentos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          usuario: usuario ? JSON.stringify(usuario) : ''
        },
        body: JSON.stringify({
          ...formData,
          valor: Number(formData.valor)
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Erro ao atualizar lancamento');
      }

      showSuccess('Lancamento atualizado com sucesso!');
      router.push('/financeiro/lancamentos');
    } catch (error) {
      showError('Erro ao salvar lancamento: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout titulo="Editar Lancamento">
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
            onClick={() => router.push('/financeiro/lancamentos')}
            className="text-gray-600 hover:text-gray-900"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <h3 className="text-lg font-semibold text-gray-800">Editar Lancamento</h3>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input
                type="date"
                name="data_lancamento"
                value={formData.data_lancamento}
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
                <option value="DOACAO">Doacao</option>
                <option value="EMENDA">Emenda</option>
                <option value="PARCERIA">Parceria</option>
                <option value="OUTROS">Outros</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <input
                type="text"
                name="categoria"
                value={formData.categoria}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parceiro/Doador</label>
              <input
                type="text"
                name="parceiro_nome"
                value={formData.parceiro_nome}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
              <input
                type="number"
                step="0.01"
                name="valor"
                value={formData.valor}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento</label>
              <input
                type="text"
                name="forma_pagamento"
                value={formData.forma_pagamento}
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
                <option value="CONFIRMADO">Confirmado</option>
                <option value="PENDENTE">Pendente</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descricao</label>
              <textarea
                name="descricao"
                value={formData.descricao}
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
  );
}
