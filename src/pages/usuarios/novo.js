import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser, faSave, faTimes, faEnvelope, faKey, faCrown, faUserTie, faUserShield, faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { ROLES, ROLE_DESCRIPTIONS, getRoleColor } from '@/utils/permissions';

export default function NovoUsuario() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess } = useModal();

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    confirmarSenha: '',
    nivel: ROLES.OPERADOR,
    liderancaVinculada: '',
    status: 'ATIVO'
  });

  const [errors, setErrors] = useState({});

  // Mock de lideranças disponíveis
  const liderancas = [
    { id: 2, nome: 'João Silva Santos' },
    { id: 5, nome: 'Ana Paula Costa' },
    { id: 8, nome: 'Roberto Almeida' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpar erro do campo quando usuário começa a digitar
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome completo é obrigatório';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.senha) {
      newErrors.senha = 'Senha é obrigatória';
    } else if (formData.senha.length < 6) {
      newErrors.senha = 'Senha deve ter no mínimo 6 caracteres';
    }

    if (formData.senha !== formData.confirmarSenha) {
      newErrors.confirmarSenha = 'As senhas não coincidem';
    }

    if (formData.nivel === ROLES.OPERADOR && !formData.liderancaVinculada) {
      newErrors.liderancaVinculada = 'Operadores devem estar vinculados a uma liderança';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Aqui você faria a integração com a API
    console.log('Dados do novo usuário:', formData);
    
    showSuccess('Usuário cadastrado com sucesso!');
    
    setTimeout(() => {
      router.push('/usuarios');
    }, 1500);
  };

  const handleCancel = () => {
    router.push('/usuarios');
  };

  const getRoleIcon = (nivel) => {
    switch (nivel) {
      case ROLES.ADMINISTRADOR:
        return faCrown;
      case ROLES.LIDERANCA:
        return faUserTie;
      case ROLES.OPERADOR:
        return faUser;
      default:
        return faUser;
    }
  };

  return (
    <Layout titulo="Novo Usuário">
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

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faUser} className="text-teal-600 text-xl" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Dados do Usuário</h2>
              <p className="text-sm text-gray-600">Preencha as informações do novo usuário</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nome Completo */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                NOME COMPLETO *
              </label>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 ${
                  errors.nome ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Digite o nome completo do usuário"
              />
              {errors.nome && (
                <p className="mt-1 text-sm text-red-600">{errors.nome}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                EMAIL *
              </label>
              <div className="relative">
                <FontAwesomeIcon icon={faEnvelope} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="usuario@exemplo.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                STATUS *
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
              </select>
            </div>

            {/* Senha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SENHA *
              </label>
              <div className="relative">
                <FontAwesomeIcon icon={faKey} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="password"
                  name="senha"
                  value={formData.senha}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 ${
                    errors.senha ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              {errors.senha && (
                <p className="mt-1 text-sm text-red-600">{errors.senha}</p>
              )}
            </div>

            {/* Confirmar Senha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CONFIRMAR SENHA *
              </label>
              <div className="relative">
                <FontAwesomeIcon icon={faKey} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="password"
                  name="confirmarSenha"
                  value={formData.confirmarSenha}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 ${
                    errors.confirmarSenha ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Digite a senha novamente"
                />
              </div>
              {errors.confirmarSenha && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmarSenha}</p>
              )}
            </div>
          </div>
        </div>

        {/* Nível de Acesso */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faUserShield} className="text-purple-600 text-xl" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Nível de Acesso</h2>
              <p className="text-sm text-gray-600">Defina as permissões do usuário</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Radio buttons para níveis */}
            {Object.values(ROLES).map((role) => (
              <label
                key={role}
                className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.nivel === role
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="nivel"
                  value={role}
                  checked={formData.nivel === role}
                  onChange={handleChange}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <FontAwesomeIcon icon={getRoleIcon(role)} className="text-xl" />
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getRoleColor(role)}`}>
                      {role}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{ROLE_DESCRIPTIONS[role]}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Vinculação de Liderança (apenas para Operadores) */}
          {formData.nivel === ROLES.OPERADOR && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3 mb-4">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-blue-600 mt-1" />
                <div>
                  <h4 className="font-semibold text-blue-900 mb-1">Vinculação Obrigatória</h4>
                  <p className="text-sm text-blue-800">
                    Operadores devem estar vinculados a uma liderança para controle de acesso.
                  </p>
                </div>
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                LIDERANÇA RESPONSÁVEL *
              </label>
              <select
                name="liderancaVinculada"
                value={formData.liderancaVinculada}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 ${
                  errors.liderancaVinculada ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Selecione uma liderança</option>
                {liderancas.map((lideranca) => (
                  <option key={lideranca.id} value={lideranca.id}>
                    {lideranca.nome}
                  </option>
                ))}
              </select>
              {errors.liderancaVinculada && (
                <p className="mt-1 text-sm text-red-600">{errors.liderancaVinculada}</p>
              )}
            </div>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
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
            Salvar Usuário
          </button>
        </div>
      </form>
    </Layout>
  );
}
