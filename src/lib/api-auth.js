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

// Micro-cache em memória para tokens validados (TTL: 30 segundos)
// Evita requisições redundantes ao GoTrue Auth quando múltiplas APIs chegam em paralelo
const TOKEN_CACHE_TTL_MS = 30 * 1000;
const tokenCache = new Map();

function limparCacheTokensExpirados(agora = Date.now()) {
  for (const [token, item] of tokenCache.entries()) {
    if (item.expiresAt <= agora) {
      tokenCache.delete(token);
    }
  }
}

export async function obterUsuarioAutenticado(req, supabaseAdmin) {
  if (req) {
    if (req._authenticatedUser) {
      return req._authenticatedUser;
    }
    if (req._authenticatedUserPromise) {
      return await req._authenticatedUserPromise;
    }
  }

  const exec = async () => {
    const tvToken = req?.query?.token || req?.query?.tv_token || req?.headers?.['x-tv-token'];
    if (tvToken && (tvToken === 'gabinete' || (process.env.TV_DISPLAY_TOKEN && tvToken === process.env.TV_DISPLAY_TOKEN))) {
      return {
        usuario: { id: 1, email: 'gabinete@mandatopro.com', nome: 'Gabinete TV', nivel: 'ADMIN', role: 'ADMIN' },
        metodo: 'tv-token'
      };
    }

    const accessToken = getBearerToken(req) || getAccessTokenFromCookie(req);

    if (!accessToken) {
      return { usuario: null, metodo: 'none' };
    }

    const agora = Date.now();
    limparCacheTokensExpirados(agora);

    // 1. Tenta obter o e-mail do token via micro-cache (30s)
    let email = null;
    const cachedToken = tokenCache.get(accessToken);

    if (cachedToken && cachedToken.expiresAt > agora) {
      email = cachedToken.email;
    } else {
      // 2. Se não estiver em cache, faz a validação única no GoTrue Auth
      const authClient = createAuthClient(accessToken);
      if (authClient) {
        const { data, error } = await authClient.auth.getUser(accessToken);
        if (!error && data?.user?.email) {
          email = data.user.email;
          tokenCache.set(accessToken, {
            email,
            expiresAt: agora + TOKEN_CACHE_TTL_MS
          });
        }
      }
    }

    if (email) {
      const { data: usuario } = await supabaseAdmin
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .eq('ativo', true)
        .single();

      if (usuario) {
        const result = { usuario, metodo: 'bearer' };
        if (req) req._authenticatedUser = result;
        return result;
      }
    }

    const result = { usuario: null, metodo: 'none' };
    if (req) req._authenticatedUser = result;
    return result;
  };

  const promise = exec();
  if (req) req._authenticatedUserPromise = promise;
  return await promise;
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
