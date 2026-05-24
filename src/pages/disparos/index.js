import { useEffect } from 'react';
import Layout from '@/components/Layout';

const disparoProSrc = `/disparo-pro/index.html?v=${Date.now()}`;

export default function Disparos() {
  useEffect(() => {
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
  }, []);

  return (
    <Layout title="Disparos">
      <div className="min-h-[calc(100vh-64px)] bg-gray-50">
        <iframe
          title="Disparo PRO"
          src={disparoProSrc}
          className="w-full h-[calc(100vh-64px)] border-0 bg-white"
        />
      </div>
    </Layout>
  );
}
