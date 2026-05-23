import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkedAlt } from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';

export default function GeolocalizacaoRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/geolocalizacao/mapa-calor');
  }, [router]);

  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-xl w-full bg-white border border-teal-100 rounded-xl shadow-lg p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center">
            <FontAwesomeIcon icon={faMapMarkedAlt} className="text-2xl" />
          </div>

          <h1 className="text-2xl font-bold text-gray-800 mb-2">Geolocalizacao</h1>
          <p className="text-gray-600 mb-4">Abrindo a visao principal com metricas do Supabase.</p>

          <div className="inline-flex items-center gap-2 text-sm text-teal-700 font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
            Redirecionando para o mapa de calor...
          </div>
        </div>
      </div>
    </Layout>
  );
}
