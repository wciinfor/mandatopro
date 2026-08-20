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

function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function obterUsuarioAutenticado(req, supabaseFallback = null) {
  if (req && req._authenticatedUser) {
    return req._authenticatedUser;
  }
  if (req && req._authenticatedUserPromise) {
    return await req._authenticatedUserPromise;
  }

  const exec = async () => {
    const token = getBearerToken(req) || getAccessTokenFromCookie(req);
    const supabaseAdmin = createServiceRoleClient() || supabaseFallback;

    if (!token || !supabaseAdmin) {
      const result = { usuario: null, metodo: 'none' };
      if (req) req._authenticatedUser = result;
      return result;
    }

    const authClient = createAuthClient(token);
    let authUser = null;

    if (authClient) {
      const { data } = await authClient.auth.getUser();
      authUser = data?.user || null;
    }

    let email = authUser?.email || null;

    if (!email) {
      const { data: adminUser } = await supabaseAdmin.auth.getUser(token);
      email = adminUser?.user?.email || null;
      if (adminUser?.user) {
        authUser = adminUser.user;
      }
    }

    if (authUser?.id) {
      const { data: usuario } = await supabaseAdmin
        .from('usuarios')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .eq('ativo', true)
        .single();

      if (usuario) {
        if (usuario.email === 'analista.meta@mandatopro.local') {
          usuario.nivel = 'ANALISTA_META';
        }
        const result = { usuario, metodo: 'auth_id' };
        if (req) req._authenticatedUser = result;
        return result;
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
        if (usuario.email === 'analista.meta@mandatopro.local') {
          usuario.nivel = 'ANALISTA_META';
        }
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
  if (!['ADMINISTRADOR', 'SUPERVISOR_CONNECT', 'ATENDENTE_CONNECT'].includes(nivel)) {
    const err = new Error('Acesso restrito ao modulo Mandato Connect');
    err.statusCode = 403;
    throw err;
  }
}

export function exigirAcessoModulo(usuario, modulo) {
  exigirUsuario(usuario);

  const { hasModuleAccess } = require('@/utils/permissions');
  const nivel = String(usuario?.nivel || '').toUpperCase();

  if (!hasModuleAccess(nivel, modulo)) {
    const err = new Error(`Acesso restrito ao modulo ${modulo}`);
    err.statusCode = 403;
    throw err;
  }
}

/**
 * Valida e resolve o Mandato Ativo do usuário garantindo autorização no servidor.
 * NUNCA aceita um mandato_id solicitado se o usuário não tiver vínculo em usuarios_mandatos.
 */
export async function obterContextoMandato(req, usuario, supabase) {
  exigirUsuario(usuario);

  // Buscar vínculos do usuário
  let userMandates = usuario.mandatos || [];
  if (!userMandates.length && supabase && usuario.id) {
    const { data } = await supabase
      .from('usuarios_mandatos')
      .select('mandato_id')
      .eq('usuario_id', usuario.id);
    userMandates = (data || []).map(v => v.mandato_id);
  }

  // Mandato solicitado no header, cookie ou query
  const rawRequested = req?.headers?.['x-mandato-ativo']
    || req?.cookies?.mandato_ativo
    || req?.query?.mandato_id
    || req?.query?.mandatoAtivoId;
  const requestedId = rawRequested ? Number(rawRequested) : null;

  // Se o usuário tiver vínculo com o mandato solicitado, aceita; caso contrário, usa o 1º mandato do usuário (ou 1 por padrão)
  let mandatoAtivoId = 1;
  if (requestedId && userMandates.includes(requestedId)) {
    mandatoAtivoId = requestedId;
  } else if (userMandates.length > 0) {
    mandatoAtivoId = userMandates[0];
  }

  return {
    mandatoAtivoId,
    mandatos: userMandates,
    temAcessoMultiplo: userMandates.length > 1 || usuario.nivel === 'ADMINISTRADOR'
  };
}
