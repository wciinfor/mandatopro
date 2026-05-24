import { useState, createContext, useContext, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@/lib/supabaseClient';
import { ROLES } from '@/utils/permissions';
import { registrarLogAuditoria } from '@/services/auditService';

function isAbortError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.name === 'AbortError' || message.includes('aborted');
}
// Contexto de autenticação
const AuthContext = createContext();

// Provider de autenticação
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Carregar usuário ao montar o componente
    loadUser();

    // Listener para mudanças de autenticação (se Supabase está configurado)
    const supabase = createClient();
    
    if (!supabase || !supabase.auth) {
      setLoading(false);
      return;
    }

    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (session) {
            // Buscar dados do usuário no banco de dados
            const usuario = await obterUsuarioLogado(session.user.email);
            if (usuario) {
              setUser(usuario);
              localStorage.setItem('usuario', JSON.stringify(usuario));
            }
          } else if (event === 'SIGNED_OUT') {
            // Apenas no evento explícito de logout do Supabase
            setUser(null);
            localStorage.removeItem('usuario');
          }
        }
      );

      return () => {
        subscription?.unsubscribe();
      };
    } catch (err) {
      console.error('Erro ao configurar auth listener:', err);
      setLoading(false);
    }
  }, []);

  const loadUser = async () => {
    let loadingResolved = false;
    try {
      const supabase = createClient();
      
      // Se Supabase não está configurado, apenas carregar localStorage
      if (!supabase) {
        const userData = localStorage.getItem('usuario');
        if (userData) {
          const user = JSON.parse(userData);
          setUser(user);
        }
        setLoading(false);
        return;
      }

      const userData = localStorage.getItem('usuario');
      if (userData) {
        const user = JSON.parse(userData);
        setUser(user);
        setLoading(false);
        loadingResolved = true;
      }

      // Verificar sessão do Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !userData) {
        const usuario = await obterUsuarioLogado(session.user.email);
        if (usuario) {
          setUser(usuario);
          localStorage.setItem('usuario', JSON.stringify(usuario));
        }
      }
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Erro ao carregar usuário:', error);
      }
    } finally {
      if (!loadingResolved) {
        setLoading(false);
      }
    }
  };

  const login = (userData) => {
    localStorage.setItem('usuario', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    // Registrar log (sem bloquear o logout em caso de erro)
    try {
      if (user) {
        await registrarLogAuditoria({
          usuario_id: user.id,
          acao: 'LOGOUT',
          modulo: 'AUTENTICACAO',
          descricao: 'Usuário fez logout',
          status: 'SUCESSO'
        });
      }
    } catch (logError) {
      console.error('Erro ao registrar log de logout:', logError);
    }

    // Fazer logout de forma garantida
    try {
      const supabase = createClient();
      if (supabase && supabase.auth) {
        await supabase.auth.signOut();
      }
    } catch (signOutError) {
      console.error('Erro ao fazer signOut no Supabase:', signOutError);
    }

    localStorage.removeItem('usuario');
    setUser(null);
    router.push('/login');
  };

  const updateUser = (userData) => {
    localStorage.setItem('usuario', JSON.stringify(userData));
    setUser(userData);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    updateUser,
    isAuthenticated: !!user,
    isAdmin: user?.nivel === ROLES.ADMINISTRADOR,
    isLideranca: user?.nivel === ROLES.LIDERANCA,
    isOperador: user?.nivel === ROLES.OPERADOR
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook para usar o contexto de autenticação
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Função para obter usuário logado do banco de dados
async function obterUsuarioLogado(email) {
  try {
    const response = await fetch('/api/usuarios/me');
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Erro ao obter usuario logado');
    }

    if (email && result.data?.email && result.data.email !== email) {
      return null;
    }

    return result.data;
  } catch (error) {
    console.error('Erro ao obter usuário logado:', error);
    return null;
  }
}
