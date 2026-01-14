import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileInvoiceDollar, faSave, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';

export default function NovaEmenda() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError } = useModal();

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.numero || !formData.autor || !formData.orgao || !formData.finalidade || !formData.valorEmpenhado) {
      showError('Preencha todos os campos obrigatórios!');
      return;
    }

    showSuccess('Emenda cadastrada com sucesso!', () => {
      router.push('/emendas/emendas');
    });
  };

  return (
    <Layout titulo="Nova Emenda">
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
          <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-teal-600 text-2xl" />
          <h2 className="text-2xl font-bold text-gray-800">Cadastrar Nova Emenda</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Número */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número da Emenda <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="numero"
                value={formData.numero}
                onChange={handleChange}
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
                onChange={handleChange}
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
                onChange={handleChange}
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
              <select
                name="orgao"
                value={formData.orgao}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
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

            {/* Finalidade */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Finalidade <span className="text-red-500">*</span>
              </label>
              <textarea
                name="finalidade"
                value={formData.finalidade}
                onChange={handleChange}
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
                onChange={handleChange}
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
                onChange={handleChange}
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
                onChange={handleChange}
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
              onClick={() => router.push('/emendas/emendas')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
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
