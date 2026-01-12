import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { hasModuleAccess, getAccessDeniedMessage } from '@/utils/permissions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock } from '@fortawesome/free-solid-svg-icons';

/**
 * Componente que protege rotas baseado em permissões
 * Uso: <ProtectedRoute module="financeiro">...</ProtectedRoute>
 */
export default function ProtectedRoute({ children, module, requiredRole = null }) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  // Aguardar carregamento do usuário
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Verificar autenticação
  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  // Verificar se requer um papel específico
  if (requiredRole && user.nivel !== requiredRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
          <FontAwesomeIcon icon={faLock} className="text-6xl text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acesso Negado</h2>
          <p className="text-gray-600 mb-6">
            {getAccessDeniedMessage(user.nivel, 'acessar esta página')}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Verificar acesso ao módulo
  if (module && !hasModuleAccess(user.nivel, module)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
          <FontAwesomeIcon icon={faLock} className="text-6xl text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acesso Negado</h2>
          <p className="text-gray-600 mb-6">
            {getAccessDeniedMessage(user.nivel, 'acessar este módulo')}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  return children;
}

/**
 * Componente para exibir conteúdo condicionalmente baseado em permissões
 * Uso: <Can do="edit" in="cadastros">...</Can>
 */
export function Can({ children, do: action, in: module }) {
  const { user } = useAuth();
  
  if (!user) return null;

  const { hasPermission } = require('@/utils/permissions');
  
  if (!hasPermission(user.nivel, module, action)) {
    return null;
  }

  return children;
}

/**
 * Componente para exibir conteúdo apenas para determinado papel
 * Uso: <RoleOnly role="ADMINISTRADOR">...</RoleOnly>
 */
export function RoleOnly({ children, role }) {
  const { user } = useAuth();
  
  if (!user || user.nivel !== role) return null;
  
  return children;
}
