import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faUserPlus, faFilter } from '@fortawesome/free-solid-svg-icons';

export default function ContatosOficiais() {
  return (
    <ProtectedRoute>
      <Layout titulo="Contatos - WhatsApp Cloud API Oficial">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-2xl p-6 shadow-sm border border-teal-100/50 gap-4">
            <div>
              <h3 className="text-xl font-bold text-gray-800">Contatos Autorizados (Opt-in)</h3>
              <p className="text-sm text-gray-500 mt-1">
                Lista de destinatários com consentimento ativo para receber comunicados via API Oficial.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition flex items-center gap-2">
                <FontAwesomeIcon icon={faUserPlus} />
                Novo Contato
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Lista de Contatos</span>
              <button className="text-gray-500 hover:text-teal-600 text-xs font-semibold flex items-center gap-1.5 transition">
                <FontAwesomeIcon icon={faFilter} /> Filtrar
              </button>
            </div>
            <div className="p-8 text-center text-gray-400 text-sm">
              <FontAwesomeIcon icon={faUsers} className="text-4xl text-gray-200 mb-3" />
              <p>Nenhum contato cadastrado com opt-in para a API oficial ainda.</p>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
