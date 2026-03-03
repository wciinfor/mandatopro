import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faArrowLeft, faBuilding, faEdit, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const estadosBrasileiros = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export default function EditarOrgao() {
  const router = useRouter();
  const { id } = router.query;
  const { modalState, closeModal, showSuccess, showError, showWarning } = useModal();

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    tipo: 'MUNICIPAL',
    cnpj: '',
    endereco: '',
    municipio: '',
    uf: 'PA',
    telefone: '',
    email: '',
    responsavel: '',
    contato: '',
    observacoes: '',
    status: 'ATIVO',
    sigla: ''
  });

  useEffect(() => {
    if (id) {
      carregarOrgao();
    }
  }, [id]);

  const carregarOrgao = async () => {
    setCarregando(true);
    try {
      let { data, error } = await supabase
        .from('orgaos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          codigo: data.codigo || '',
          nome: data.nome || '',
          tipo: data.tipo || 'MUNICIPAL',
          cnpj: data.cnpj || '',
          endereco: data.endereco || '',
          municipio: data.municipio || '',
          uf: data.uf || 'PA',
          telefone: data.telefone || '',
          email: data.email || '',
          responsavel: data.responsavel || '',
          contato: data.contato || '',
          observacoes: data.observacoes || '',
          status: data.status || 'ATIVO',
          sigla: data.sigla || ''
        });
      }
    } catch (error) {
      console.error('Erro ao carregar órgão:', error);
      showError('Erro ao carregar dados do órgão');
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
    if (!formData.nome || !formData.cnpj || !formData.municipio) {
      showWarning('Preencha todos os campos obrigatórios: Nome, CNPJ e Município!');
      return;
    }

    setSalvando(true);

    try {
      let { error } = await supabase
        .from('orgaos')
        .update({
          codigo: formData.codigo ? parseInt(formData.codigo) : null,
          nome: formData.nome,
          tipo: formData.tipo,
          cnpj: formData.cnpj,
          endereco: formData.endereco || null,
          municipio: formData.municipio,
          uf: formData.uf,
          telefone: formData.telefone || null,
          email: formData.email || null,
          responsavel: formData.responsavel || null,
          contato: formData.contato || null,
          observacoes: formData.observacoes || null,
          status: formData.status,
          sigla: formData.sigla || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      showSuccess('Órgão atualizado com sucesso!');
      setTimeout(() => {
        router.push('/emendas/orgaos');
      }, 2000);
    } catch (error) {
      console.error('Erro ao atualizar órgão:', error);
      showError('Erro ao atualizar órgão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <Layout titulo="Editar Órgão">
        <div className="flex items-center justify-center h-screen">
          <FontAwesomeIcon icon={faSpinner} className="text-4xl animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout titulo="Editar Órgão">
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

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center gap-3">
            <FontAwesomeIcon icon={faEdit} className="text-3xl" />
            <h3 className="text-2xl font-bold">EDITAR ÓRGÃO</h3>
          </div>
        </div>

        {/* Dados do Órgão */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faBuilding} className="text-blue-600" />
            DADOS DO ÓRGÃO
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="codigo"
                value={formData.codigo}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sigla
              </label>
              <input
                type="text"
                name="sigla"
                value={formData.sigla}
                onChange={handleInputChange}
                maxLength="20"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: SMS"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Órgão / Entidade <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Secretaria Municipal de Saúde"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo <span className="text-red-500">*</span>
              </label>
              <select
                name="tipo"
                value={formData.tipo}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="FEDERAL">Federal</option>
                <option value="ESTADUAL">Estadual</option>
                <option value="MUNICIPAL">Municipal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CNPJ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="cnpj"
                value={formData.cnpj}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="00.000.000/0000-00"
                required
              />
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">ENDEREÇO</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Endereço Completo
              </label>
              <input
                type="text"
                name="endereco"
                value={formData.endereco}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Rua, número, bairro..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Município <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="municipio"
                  value={formData.municipio}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  UF <span className="text-red-500">*</span>
                </label>
                <select
                  name="uf"
                  value={formData.uf}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {estadosBrasileiros.map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Contato */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">CONTATO</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefone
              </label>
              <input
                type="text"
                name="telefone"
                value={formData.telefone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="(00) 0000-0000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-mail
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="email@orgao.gov.br"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Responsável pelo Convênio
              </label>
              <input
                type="text"
                name="responsavel"
                value={formData.responsavel}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Nome do responsável"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contato do Responsável
              </label>
              <input
                type="text"
                name="contato"
                value={formData.contato}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">STATUS</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Situação <span className="text-red-500">*</span>
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
            </select>
          </div>
        </div>

        {/* Observações */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">OBSERVAÇÕES</h3>

          <textarea
            name="observacoes"
            value={formData.observacoes}
            onChange={handleInputChange}
            rows="4"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Observações gerais sobre o órgão..."
          />
        </div>

        {/* Botões */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex gap-4 justify-end">
            <button
              type="button"
              onClick={() => router.push('/emendas/orgaos')}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold transition-colors flex items-center gap-2"
              disabled={salvando}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              Voltar para Lista
            </button>

            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
              disabled={salvando}
            >
              <FontAwesomeIcon icon={faSave} />
              {salvando ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </form>
    </Layout>
  );
}
