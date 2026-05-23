import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faArrowLeft, faFileInvoiceDollar, faEdit, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import supabase from '@/lib/supabaseClient';

export default function EditarEmenda() {
  const router = useRouter();
  const { id } = router.query;
  const { modalState, closeModal, showSuccess, showError, showWarning } = useModal();

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [formData, setFormData] = useState({
    numero: '',
    tipo: 'INDIVIDUAL',
    autor: '',
    orgao: '',
    responsavel: '',
    finalidade: '',
    valorEmpenhado: '',
    valorExecutado: '0',
    dataEmpenho: '',
    dataVencimento: '',
    status: 'PENDENTE',
    observacoes: ''
  });

  useEffect(() => {
    if (id) {
      carregarEmenda();
    }
  }, [id]);

  const carregarEmenda = async () => {
    setCarregando(true);
    try {
      let { data, error } = await supabase
        .from('emendas')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          numero: data.numero || '',
          tipo: data.tipo || 'INDIVIDUAL',
          autor: data.autor || '',
          orgao: data.orgao || '',
          responsavel: data.responsavel || '',
          finalidade: data.finalidade || '',
          valorEmpenhado: data.valorEmpenhado || '',
          valorExecutado: data.valorExecutado || '0',
          dataEmpenho: data.dataEmpenho || '',
          dataVencimento: data.dataVencimento || '',
          status: data.status || 'PENDENTE',
          observacoes: data.observacoes || ''
        });
      }
    } catch (error) {
      console.error('Erro ao carregar emenda:', error);
      showError('Erro ao carregar dados da emenda');
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
    if (!formData.numero || !formData.tipo || !formData.autor || !formData.orgao || !formData.finalidade || !formData.valorEmpenhado) {
      showWarning('Preencha todos os campos obrigatórios!');
      return;
    }

    setSalvando(true);

    try {
      let { error } = await supabase
        .from('emendas')
        .update({
          numero: formData.numero,
          tipo: formData.tipo,
          autor: formData.autor,
          orgao: formData.orgao,
          responsavel: formData.responsavel || null,
          finalidade: formData.finalidade,
          valorEmpenhado: parseFloat(formData.valorEmpenhado) || null,
          valorExecutado: parseFloat(formData.valorExecutado) || 0,
          dataEmpenho: formData.dataEmpenho || null,
          dataVencimento: formData.dataVencimento || null,
          status: formData.status,
          observacoes: formData.observacoes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      showSuccess('Emenda atualizada com sucesso!');
      setTimeout(() => {
        router.push('/emendas/emendas');
      }, 2000);
    } catch (error) {
      console.error('Erro ao atualizar emenda:', error);
      showError('Erro ao atualizar emenda. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <Layout titulo="Editar Emenda">
        <div className="flex items-center justify-center h-screen">
          <FontAwesomeIcon icon={faSpinner} className="text-4xl animate-spin text-teal-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout titulo="Editar Emenda">
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
          <h2 className="text-2xl font-bold text-gray-800">Editar Emenda</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Número */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número da Emenda <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="numero"
                value={formData.numero}
                onChange={handleInputChange}
                placeholder="Ex: 001/2024"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo <span className="text-red-500">*</span>
              </label>
              <select
                name="tipo"
                value={formData.tipo}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              >
                <option value="INDIVIDUAL">Individual</option>
                <option value="BANCADA">Bancada</option>
                <option value="COMISSAO">Comissão</option>
              </select>
            </div>

            {/* Autor */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Autor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="autor"
                value={formData.autor}
                onChange={handleInputChange}
                placeholder="Ex: Deputado José Santos"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            {/* Órgão */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Órgão Beneficiário <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="orgao"
                value={formData.orgao}
                onChange={handleInputChange}
                placeholder="Nome do órgão"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            {/* Responsável */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Responsável
              </label>
              <input
                type="text"
                name="responsavel"
                value={formData.responsavel}
                onChange={handleInputChange}
                placeholder="Nome do responsável"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Finalidade */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Finalidade <span className="text-red-500">*</span>
              </label>
              <textarea
                name="finalidade"
                value={formData.finalidade}
                onChange={handleInputChange}
                rows="2"
                placeholder="Descreva a finalidade da emenda..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            {/* Valor Empenhado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor Empenhado <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="valorEmpenhado"
                value={formData.valorEmpenhado}
                onChange={handleInputChange}
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            {/* Valor Executado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor Executado
              </label>
              <input
                type="number"
                name="valorExecutado"
                value={formData.valorExecutado}
                onChange={handleInputChange}
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Data Empenho */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data do Empenho
              </label>
              <input
                type="date"
                name="dataEmpenho"
                value={formData.dataEmpenho}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Data Vencimento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Vencimento
              </label>
              <input
                type="date"
                name="dataVencimento"
                value={formData.dataVencimento}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              >
                <option value="PENDENTE">Pendente</option>
                <option value="EM_EXECUCAO">Em Execução</option>
                <option value="EXECUTADA">Executada</option>
                <option value="CANCELADA">Cancelada</option>
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
              onClick={() => router.push('/emendas/emendas')}
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
