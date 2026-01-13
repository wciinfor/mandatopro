import { useState, createContext, useContext, useEffect } from 'react';
import { useRouter } from 'next/router';
import createClient from '@/lib/supabaseClient';
import { ROLES } from '@/utils/permissions';
import { registrarLogAuditoria } from '@/services/database';

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
          } else {
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
    try {
      const supabase = getSupabaseClient();
      
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
      console.error('Erro ao carregar usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = (userData) => {
    localStorage.setItem('usuario', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    try {
      const supabase = getSupabaseClient();
      
      // Registrar logout nos logs
      if (user) {
        await registrarLogAuditoria({
          usuario_id: user.id,
          acao: 'LOGOUT',
          modulo: 'AUTENTICACAO',
          descricao: 'Usuário fez logout',
          status: 'SUCESSO'
        });
      }

      // Fazer logout no Supabase (se configurado)
      if (supabase && supabase.auth) {
        await supabase.auth.signOut();
      }
      
      localStorage.removeItem('usuario');
      setUser(null);
      router.push('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
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
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('ativo', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erro ao obter usuário logado:', error);
    return null;
  }
}

// Função de login com Supabase
export async function loginUser(email, senha) {
  try {
    const supabase = getSupabaseClient();
    
    // Verificar se Supabase está configurado
    if (!supabase || !supabase.auth) {
      throw new Error('Supabase não está configurado. Verifique as variáveis de ambiente.');
    }

    // Tentar fazer login com Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha
    });

    if (error) {
      throw new Error(error.message);
    }

    // Buscar dados do usuário no banco de dados
    const usuario = await obterUsuarioLogado(email);

    if (!usuario) {
      throw new Error('Usuário não encontrado no banco de dados');
    }

    if (usuario.status !== 'ATIVO') {
      throw new Error('Usuário inativo ou bloqueado');
    }

    // Atualizar último acesso
    await supabase
      .from('usuarios')
      .update({ ultimo_acesso: new Date() })
      .eq('id', usuario.id);

    // Registrar login nos logs
    await registrarLogAuditoria({
      usuario_id: usuario.id,
      acao: 'LOGIN',
      modulo: 'AUTENTICACAO',
      descricao: `${usuario.nome} fez login no sistema`,
      status: 'SUCESSO'
    });

    return usuario;
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    throw error;
  }
}

// Função para criar novo usuário (apenas administrador)
export async function criarUsuario(dados) {
  try {
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      throw new Error('Supabase não está configurado');
    }

    // Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: dados.email,
      password: dados.senha,
      email_confirm: true
    });

    if (authError) {
      throw authError;
    }

    // Criar registro de usuário no banco de dados
    const { data: userData, error: dbError } = await supabase
      .from('usuarios')
      .insert([{
        email: dados.email,
        nome: dados.nome,
        nivel: dados.nivel,
        status: dados.status || 'ATIVO',
        lideranca_id: dados.lideranca_id || null
      }])
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    return userData;
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    throw error;
  }
}

// Função para redefinir senha
export async function redefinirSenha(email) {
  try {
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      throw new Error('Supabase não está configurado');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      throw error;
    }

    return { sucesso: true, mensagem: 'Email de recuperação enviado' };
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    throw error;
  }
}
