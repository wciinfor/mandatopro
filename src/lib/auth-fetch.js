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

  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
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
