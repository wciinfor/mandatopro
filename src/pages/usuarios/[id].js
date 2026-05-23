import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser, faSave, faTimes, faEnvelope, faKey, faCrown, faUserTie, faUserShield, faExclamationTriangle, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROLES, ROLE_DESCRIPTIONS, getRoleColor, MODULES } from '@/utils/permissions';

export default function EditarUsuario() {
  const router = useRouter();
  const { id } = router.query;
  const { modalState, closeModal, showSuccess, showError } = useModal();

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [carregandoLiderancas, setCarregandoLiderancas] = useState(false);
  const [liderancas, setLiderancas] = useState([]);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    nivel: ROLES.OPERADOR,
    liderancaVinculada: '',
    status: 'ATIVO'
  });

  const [alterarSenha, setAlterarSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');

  const [errors, setErrors] = useState({});

  const obterUsuarioHeader = () => {
    if (typeof window === 'undefined') {
      return null;
    }

    return JSON.parse(localStorage.getItem('usuario') || 'null');
  };

  const carregarUsuario = async () => {
    const usuarioLocal = obterUsuarioHeader();
    const response = await fetch(`/api/usuarios/${id}`, {
      headers: {
        usuario: usuarioLocal ? JSON.stringify(usuarioLocal) : ''
      }
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(body?.message || 'Erro ao carregar usuario');
    }

    const usuario = body?.data;
    if (!usuario) {
      throw new Error('Usuario nao encontrado');
    }

    setFormData({
      nome: usuario.nome || '',
      email: usuario.email || '',
      nivel: usuario.nivel || ROLES.OPERADOR,
      liderancaVinculada: usuario.lideranca_id || '',
      status: usuario.status || 'ATIVO'
    });
  };

  const carregarLiderancas = async () => {
    try {
      setCarregandoLiderancas(true);
      const usuarioLocal = obterUsuarioHeader();

      const response = await fetch('/api/usuarios/liderancas-opcoes', {
        headers: {
          usuario: usuarioLocal ? JSON.stringify(usuarioLocal) : ''
        }
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.message || 'Erro ao carregar liderancas');
      }

      setLiderancas(Array.isArray(body?.data) ? body.data : []);
    } catch (error) {
      showError('Erro ao carregar liderancas: ' + error.message);
    } finally {
      setCarregandoLiderancas(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    let ativo = true;

    const carregar = async () => {
      try {
        setLoading(true);
        await Promise.all([carregarUsuario(), carregarLiderancas()]);
      } catch (error) {
        if (!ativo) {
          return;
        }
        showError('Erro ao carregar usuario: ' + error.message);
        router.push('/usuarios');
      } finally {
        if (ativo) {
          setLoading(false);
        }
      }
    };

    carregar();

    return () => {
      ativo = false;
    };
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
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

    if (alterarSenha) {
      if (!novaSenha) {
        newErrors.novaSenha = 'Nova senha é obrigatória';
      } else if (novaSenha.length < 6) {
        newErrors.novaSenha = 'Senha deve ter no mínimo 6 caracteres';
      }

      if (novaSenha !== confirmarNovaSenha) {
        newErrors.confirmarNovaSenha = 'As senhas não coincidem';
      }
    }

    if (formData.nivel === ROLES.OPERADOR && !formData.liderancaVinculada) {
      newErrors.liderancaVinculada = 'Operadores devem estar vinculados a uma liderança';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSalvando(true);
      const usuarioLocal = obterUsuarioHeader();

      const payload = {
        nome: formData.nome,
        email: formData.email,
        nivel: formData.nivel,
        status: formData.status,
        lideranca_id: formData.nivel === ROLES.OPERADOR
          ? Number(formData.liderancaVinculada)
          : null,
        ...(alterarSenha ? { senha: novaSenha } : {})
      };

      const response = await fetch(`/api/usuarios/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          usuario: usuarioLocal ? JSON.stringify(usuarioLocal) : ''
        },
        body: JSON.stringify(payload)
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.message || 'Erro ao atualizar usuario');
      }

      showSuccess('Usuário atualizado com sucesso!');
      setTimeout(() => {
        router.push('/usuarios');
      }, 1200);
    } catch (error) {
      showError('Erro ao atualizar usuario: ' + error.message);
    } finally {
      setSalvando(false);
    }
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

  if (loading) {
    return (
      <Layout titulo="Editar Usuário">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <FontAwesomeIcon icon={faSpinner} className="text-6xl text-teal-400 mb-4 animate-spin" />
            <h4 className="text-xl font-semibold text-gray-700">Carregando dados...</h4>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <ProtectedRoute module={MODULES.USUARIOS}>
    <Layout titulo="Editar Usuário">
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
              <p className="text-sm text-gray-600">Edite as informações do usuário</p>
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
          </div>
        </div>

        {/* Alterar Senha */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faKey} className="text-yellow-600 text-xl" />
              <div>
                <h3 className="text-lg font-bold text-gray-800">Alterar Senha</h3>
                <p className="text-sm text-gray-600">Deixe em branco para manter a senha atual</p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={alterarSenha}
                onChange={(e) => setAlterarSenha(e.target.checked)}
                className="w-5 h-5 text-teal-600 rounded focus:ring-2 focus:ring-teal-500"
              />
              <span className="text-sm font-medium text-gray-700">Alterar senha</span>
            </label>
          </div>

          {alterarSenha && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nova Senha */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  NOVA SENHA *
                </label>
                <div className="relative">
                  <FontAwesomeIcon icon={faKey} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 ${
                      errors.novaSenha ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                {errors.novaSenha && (
                  <p className="mt-1 text-sm text-red-600">{errors.novaSenha}</p>
                )}
              </div>

              {/* Confirmar Nova Senha */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CONFIRMAR NOVA SENHA *
                </label>
                <div className="relative">
                  <FontAwesomeIcon icon={faKey} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="password"
                    value={confirmarNovaSenha}
                    onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 ${
                      errors.confirmarNovaSenha ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Digite a senha novamente"
                  />
                </div>
                {errors.confirmarNovaSenha && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmarNovaSenha}</p>
                )}
              </div>
            </div>
          )}
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
              {carregandoLiderancas && (
                <p className="mt-1 text-xs text-gray-500">Carregando liderancas...</p>
              )}
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
            disabled={salvando}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2 disabled:opacity-60"
          >
            <FontAwesomeIcon icon={faSave} />
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </Layout>
    </ProtectedRoute>
  );
}
