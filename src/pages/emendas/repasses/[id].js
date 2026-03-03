import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoneyBillWave, faSave, faArrowLeft, faSpinner } from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function EditarRepasse() {
  const router = useRouter();
  const { id } = router.query;
  const { modalState, closeModal, showSuccess, showError } = useModal();
  
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [formData, setFormData] = useState({
    codigo: '',
    emenda: '',
    parcela: 1,
    totalParcelas: 1,
    valor: '',
    dataPrevista: '',
    dataEfetivada: '',
    orgao: '',
    responsavel: '',
    status: 'PENDENTE',
    observacoes: ''
  });

  useEffect(() => {
    if (id) {
      carregarRepasse();
    }
  }, [id]);

  const carregarRepasse = async () => {
    setCarregando(true);
    try {
      let { data, error } = await supabase
        .from('repasses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setFormData({
        codigo: data.codigo || '',
        emenda: data.emenda || '',
        parcela: data.parcela || 1,
        totalParcelas: data.totalParcelas || 1,
        valor: data.valor || '',
        dataPrevista: data.dataPrevista || '',
        dataEfetivada: data.dataEfetivada || '',
        orgao: data.orgao || '',
        responsavel: data.responsavel || '',
        status: data.status || 'PENDENTE',
        observacoes: data.observacoes || ''
      });
    } catch (error) {
      console.error('Erro ao carregar repasse:', error);
      showError('Erro ao carregar repasse');
    } finally {
      setCarregando(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.emenda || !formData.valor || !formData.dataPrevista) {
      showError('Preencha todos os campos obrigatórios!');
      return;
    }

    setSalvando(true);

    try {
      const { error } = await supabase
        .from('repasses')
        .update({
          codigo: formData.codigo,
          emenda: formData.emenda,
          parcela: parseInt(formData.parcela) || 1,
          totalParcelas: parseInt(formData.totalParcelas) || 1,
          valor: parseFloat(formData.valor) || null,
          dataPrevista: formData.dataPrevista || null,
          dataEfetivada: formData.dataEfetivada || null,
          orgao: formData.orgao || null,
          responsavel: formData.responsavel || null,
          status: formData.status,
          observacoes: formData.observacoes || null,
          updated_at: new Date()
        })
        .eq('id', id);

      if (error) throw error;

      showSuccess('Repasse atualizado com sucesso!', () => {
        router.push('/emendas/repasses');
      });
    } catch (error) {
      console.error('Erro ao atualizar repasse:', error);
      showError('Erro ao atualizar repasse: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <Layout titulo="Editar Repasse">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <FontAwesomeIcon icon={faSpinner} className="text-teal-600 text-4xl mb-4 animate-spin" />
            <p className="text-lg font-semibold text-gray-700">Carregando repasse...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout titulo="Editar Repasse">
      <Modal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
      />

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <FontAwesomeIcon icon={faMoneyBillWave} className="text-teal-600 text-2xl" />
          <h2 className="text-2xl font-bold text-gray-800">Editar Repasse</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Código */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código
              </label>
              <input
                type="text"
                name="codigo"
                value={formData.codigo}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                readOnly
              />
            </div>

            {/* Emenda */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Emenda <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="emenda"
                value={formData.emenda}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            {/* Parcela */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parcela
              </label>
              <input
                type="number"
                name="parcela"
                value={formData.parcela}
                onChange={handleChange}
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Total de Parcelas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total de Parcelas
              </label>
              <input
                type="number"
                name="totalParcelas"
                value={formData.totalParcelas}
                onChange={handleChange}
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Valor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="valor"
                value={formData.valor}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            {/* Data Prevista */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Prevista <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="dataPrevista"
                value={formData.dataPrevista}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            {/* Data Efetivada */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Efetivada
              </label>
              <input
                type="date"
                name="dataEfetivada"
                value={formData.dataEfetivada}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Órgão */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Órgão
              </label>
              <input
                type="text"
                name="orgao"
                value={formData.orgao}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                onChange={handleChange}
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
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="PENDENTE">Pendente</option>
                <option value="EFETIVADO">Efetivado</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Observações */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observações
            </label>
            <textarea
              name="observacoes"
              value={formData.observacoes}
              onChange={handleChange}
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            ></textarea>
          </div>

          {/* Botões */}
          <div className="flex gap-4 mt-6">
            <button
              type="submit"
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
              disabled={salvando}
            >
              <FontAwesomeIcon icon={faSave} />
              <span>{salvando ? 'Salvando...' : 'Salvar'}</span>
            </button>
            <button
              type="button"
              onClick={() => router.push('/emendas/repasses')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
              disabled={salvando}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span>Voltar para Lista</span>
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
