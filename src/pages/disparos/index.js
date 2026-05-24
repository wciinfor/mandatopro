import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { createClient } from '@/lib/supabaseClient';

function buildDisparoProSrc(accessToken = '') {
  const hash = accessToken ? `#mandato_token=${encodeURIComponent(accessToken)}` : '';
  return `/disparo-pro/index.html?v=${Date.now()}${hash}`;
}

export default function Disparos() {
  const [iframeSrc, setIframeSrc] = useState('');

  useEffect(() => {
    let active = true;

    async function prepareIframe() {
      const supabase = createClient();
      const { data } = await supabase?.auth?.getSession?.() || {};
      const accessToken = data?.session?.access_token || '';

      if (active) {
        setIframeSrc(buildDisparoProSrc(accessToken));
      }
    }

    prepareIframe().catch((error) => {
      console.warn('Falha ao preparar sessao do Disparo PRO:', error);
      if (active) {
        setIframeSrc(buildDisparoProSrc());
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
        console.warn('Falha ao remover service worker do Disparo PRO:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <Layout title="Disparos">
      <div className="min-h-[calc(100vh-64px)] bg-gray-50">
        {iframeSrc ? (
          <iframe
            title="Disparo PRO"
            src={iframeSrc}
            className="w-full h-[calc(100vh-64px)] border-0 bg-white"
          />
        ) : null}
      </div>
    </Layout>
  );
}
