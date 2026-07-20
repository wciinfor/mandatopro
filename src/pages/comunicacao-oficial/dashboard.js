import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardExecutivo from '@/components/DashboardExecutivo';

export default function DashboardOficial() {
  return (
    <ProtectedRoute>
      <Layout titulo="Dashboard - WhatsApp Cloud API Oficial">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-teal-100/50">
            <h3 className="text-xl font-bold text-gray-800">Painel Executivo de Comunicação</h3>
            <p className="text-sm text-gray-500 mt-1">
              Indicadores de performance, estatísticas multicanal e acompanhamento de equipe em tempo real.
            </p>
          </div>

          <DashboardExecutivo />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
