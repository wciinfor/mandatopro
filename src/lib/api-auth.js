import { createClient } from '@supabase/supabase-js';

function getBearerToken(req) {
  const authorization = req?.headers?.authorization || '';
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

function parseCookies(req) {
  const header = String(req?.headers?.cookie || '');
  if (!header) return {};

  return header.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = rest.join('=');
    return acc;
  }, {});
}

function getAccessTokenFromCookie(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const ref = url.replace(/^https?:\/\//, '').split('.')[0];
  if (!ref) return '';

  const cookieName = `sb-${ref}-auth-token`;
  const cookies = parseCookies(req);
  const raw = cookies[cookieName];
  if (!raw) return '';

  const value = raw.startsWith('base64-') ? raw.slice('base64-'.length) : raw;
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    const parsed = decoded ? JSON.parse(decoded) : null;
    return parsed?.access_token || '';
  } catch {
    return '';
  }
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
  const accessToken = getBearerToken(req) || getAccessTokenFromCookie(req);

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

export function exigirAdministradorOuSupervisorConnect(usuario) {
  exigirUsuario(usuario);

  const nivel = String(usuario?.nivel || '').toUpperCase();
  if (!['ADMINISTRADOR', 'SUPERVISOR_CONNECT'].includes(nivel)) {
    const err = new Error('Acesso restrito ao administrador ou supervisor do Mandato Connect');
    err.statusCode = 403;
    throw err;
  }
}

export function exigirAcessoMandatoConnect(usuario) {
  exigirUsuario(usuario);

  const nivel = String(usuario?.nivel || '').toUpperCase();
  if (!['ADMINISTRADOR', 'LIDERANCA', 'SUPERVISOR_CONNECT'].includes(nivel)) {
    const err = new Error('Acesso restrito ao Mandato Connect');
    err.statusCode = 403;
    throw err;
  }
}
