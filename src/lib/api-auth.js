import { createClient } from '@supabase/supabase-js';

function getBearerToken(req) {
  const authorization = req?.headers?.authorization || '';
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

function createAuthClient(accessToken) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function obterUsuarioAutenticado(req, supabaseAdmin) {
  const accessToken = getBearerToken(req);

  if (accessToken) {
    const authClient = createAuthClient(accessToken);
    if (authClient) {
      const { data, error } = await authClient.auth.getUser(accessToken);
      if (!error && data?.user?.email) {
        const { data: usuario } = await supabaseAdmin
          .from('usuarios')
          .select('*')
          .eq('email', data.user.email)
          .eq('ativo', true)
          .single();

        if (usuario) {
          return { usuario, metodo: 'bearer' };
        }
      }
    }
  }

  return { usuario: null, metodo: 'none' };
}

export function exigirUsuario(usuario) {
  if (!usuario) {
    const err = new Error('Autenticacao obrigatoria');
    err.statusCode = 401;
    throw err;
  }
}

export function exigirAdministrador(usuario) {
  exigirUsuario(usuario);

  if (String(usuario?.nivel || '').toUpperCase() !== 'ADMINISTRADOR') {
    const err = new Error('Acesso restrito ao administrador');
    err.statusCode = 403;
    throw err;
  }
}
