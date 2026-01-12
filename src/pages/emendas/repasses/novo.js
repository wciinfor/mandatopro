import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoneyBillWave, faSave, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';

export default function NovoRepasse() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError } = useModal();

  const [formData, setFormData] = useState({
    codigo: `REP-2024-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.emenda || !formData.valor || !formData.dataPrevista) {
      showError('Preencha todos os campos obrigatórios!');
      return;
    }

    showSuccess('Repasse cadastrado com sucesso!', () => {
      router.push('/emendas/repasses');
    });
  };

  return (
    <Layout titulo="Novo Repasse">
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
          <h2 className="text-2xl font-bold text-gray-800">Cadastrar Novo Repasse</h2>
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
              <select
                name="emenda"
                value={formData.emenda}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              >
                <option value="">Selecione...</option>
                <option value="EMD-2024-001 - 001/2024">EMD-2024-001 - 001/2024</option>
                <option value="EMD-2024-002 - 002/2024">EMD-2024-002 - 002/2024</option>
                <option value="EMD-2024-003 - 003/2024">EMD-2024-003 - 003/2024</option>
              </select>
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
                placeholder="0.00"
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
              <select
                name="orgao"
                value={formData.orgao}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">Selecione...</option>
                <option value="SECRETARIA MUNICIPAL DE SAÚDE">Secretaria Municipal de Saúde</option>
                <option value="SECRETARIA ESTADUAL DE EDUCAÇÃO">Secretaria Estadual de Educação</option>
                <option value="SECRETARIA MUNICIPAL DE OBRAS">Secretaria Municipal de Obras</option>
              </select>
            </div>

            {/* Responsável */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Responsável
              </label>
              <select
                name="responsavel"
                value={formData.responsavel}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">Selecione...</option>
                <option value="Dr. João Silva">Dr. João Silva</option>
                <option value="Profª Maria Santos">Profª Maria Santos</option>
                <option value="Eng. Carlos Oliveira">Eng. Carlos Oliveira</option>
              </select>
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
                onChange={handleChange}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-4 mt-6">
            <button
              type="submit"
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <FontAwesomeIcon icon={faSave} />
              <span>Salvar</span>
            </button>
            <button
              type="button"
              onClick={() => router.push('/emendas/repasses')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span>Voltar</span>
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
