import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import CentralInbox from '@/components/CentralInbox';

export default function CentralAtendimentoPage() {
  return (
    <ProtectedRoute>
      <Layout titulo="Central de Atendimento">
        <CentralInbox />
      </Layout>
    </ProtectedRoute>
  );
}
