import { createClient } from '@/lib/supabaseClient';

let installed = false;

function isInternalApiRequest(input) {
  const url = typeof input === 'string' ? input : input?.url;
  if (!url) return false;

  if (url.startsWith('/api/')) return true;

  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

async function getAccessToken() {
  const supabase = createClient();
  if (!supabase?.auth) return '';

  const timeoutMs = 2000;
  const timeoutPromise = new Promise((resolve) =>
    setTimeout(() => resolve({ data: { session: null } }), timeoutMs)
  );

  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      timeoutPromise
    ]);

    return result?.data?.session?.access_token || getAccessTokenFromStorage();
  } catch {
    return getAccessTokenFromStorage();
  }
}

function getAccessTokenFromStorage() {
  if (typeof window === 'undefined') return '';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const ref = url.replace(/^https?:\/\//, '').split('.')[0];
  if (!ref) return '';
  const key = `sb-${ref}-auth-token`;
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.access_token || '';
  } catch {
    return '';
  }
}

function mergeAuthorization(init, token) {
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return { ...(init || {}), headers };
}

export function installAuthenticatedFetch() {
  if (typeof window === 'undefined' || installed || !window.fetch) {
    return;
  }

  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    if (!isInternalApiRequest(input)) {
      return originalFetch(input, init);
    }

    const token = await getAccessToken();
    const nextInit = mergeAuthorization(init, token);
    return originalFetch(input, nextInit);
  };
}
