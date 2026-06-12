import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabaseClient';

const SECOES_MANDATO_CONNECT = new Set([
  'dashboard',
  'contatos',
  'instancias',
  'configuracoes',
  'campanha',
  'progresso',
  'resultados',
  'historico'
]);

function normalizarSecao(section) {
  const value = Array.isArray(section) ? section[0] : section;
  return SECOES_MANDATO_CONNECT.has(value) ? value : 'dashboard';
}

function buildDisparoProSrc(accessToken = '', section = 'dashboard') {
  const hash = accessToken ? `#mandato_token=${encodeURIComponent(accessToken)}` : '';
  const params = new URLSearchParams({ v: String(Date.now()), section });
  return `/disparo-pro/index.html?${params.toString()}${hash}`;
}

function getSupabaseTokenFromStorage() {
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

export default function Disparos() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const iframeRef = useRef(null);
  const [iframeSrc, setIframeSrc] = useState('');
  const activeSection = useMemo(() => normalizarSecao(router.query.section), [router.query.section]);
  const nivelUsuario = String(user?.nivel || '').toUpperCase();
  const podeAcessarMandatoConnect = ['ADMINISTRADOR', 'LIDERANCA', 'SUPERVISOR_CONNECT'].includes(nivelUsuario);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (!podeAcessarMandatoConnect) {
      router.replace('/atendimento-connect');
    }
  }, [loading, podeAcessarMandatoConnect, router, user]);

  useEffect(() => {
    if (!router.isReady || loading || !podeAcessarMandatoConnect) return undefined;

    let active = true;
    const initialSection = normalizarSecao(router.query.section);

    async function prepareIframe() {
      const supabase = createClient();
      const { data } = await supabase?.auth?.getSession?.() || {};
      const accessToken = data?.session?.access_token || getSupabaseTokenFromStorage();

      if (active) {
        setIframeSrc(buildDisparoProSrc(accessToken, initialSection));
      }
    }

    prepareIframe().catch((error) => {
      console.warn('Falha ao preparar sessao do Mandato Connect:', error);
      if (active) {
        setIframeSrc(buildDisparoProSrc('', initialSection));
      }
    });

    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(
        registrations
          .filter((registration) => registration.scope.includes('/disparo-pro'))
          .map((registration) => registration.unregister())
      ))
      .catch((error) => {
        console.warn('Falha ao remover service worker do Mandato Connect:', error);
      });

    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, podeAcessarMandatoConnect, router.isReady]);

  useEffect(() => {
    if (!podeAcessarMandatoConnect) return;

    iframeRef.current?.contentWindow?.postMessage({
      type: 'mandato-connect:navigate',
      section: activeSection
    }, window.location.origin);
  }, [activeSection, iframeSrc, podeAcessarMandatoConnect]);

  if (loading || !user || !podeAcessarMandatoConnect) {
    return null;
  }

  return (
    <Layout titulo="Mandato Connect">
      <div className="-m-4 lg:-m-6 min-h-[calc(100vh-64px)] bg-gray-50">
        {iframeSrc ? (
          <iframe
            ref={iframeRef}
            title="Mandato Connect"
            src={iframeSrc}
            onLoad={() => {
              iframeRef.current?.contentWindow?.postMessage({
                type: 'mandato-connect:navigate',
                section: activeSection
              }, window.location.origin);
            }}
            className="w-full h-[calc(100vh-64px)] border-0 bg-white block"
          />
        ) : null}
      </div>
    </Layout>
  );
}
