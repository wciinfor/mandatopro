import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlug, faShieldAlt, faCheck, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

export default function WhatsAppBusinessOficial() {
  return (
    <ProtectedRoute>
      <Layout titulo="WhatsApp Business - Cloud API Oficial">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-teal-100/50">
            <h3 className="text-xl font-bold text-gray-800">WhatsApp Business Oficial</h3>
            <p className="text-sm text-gray-500 mt-1">
              Configurações do canal oficial de comunicação conectado diretamente com a infraestrutura da Meta Cloud API.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {/* Card de Configuração */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <FontAwesomeIcon icon={faPlug} className="text-teal-600" />
                  Conexão Meta Developers
                </h4>
                <p className="text-xs text-gray-500">
                  Os parâmetros abaixo definem a autenticação da aplicação e permissões com as APIs da Meta.
                </p>

                <div className="space-y-4 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Phone Number ID</label>
                    <input
                      type="text"
                      disabled
                      placeholder="Conectado via Embedded Signup ou configurado no sistema"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">WABA ID (WhatsApp Business Account)</label>
                    <input
                      type="text"
                      disabled
                      placeholder="Identificador da Conta WhatsApp Business"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar de Status */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-teal-50/60 to-emerald-50/20 border border-teal-100 rounded-2xl p-6 shadow-sm space-y-4">
                <h4 className="font-bold text-teal-900 text-sm flex items-center gap-2">
                  <FontAwesomeIcon icon={faShieldAlt} />
                  Status da Conexão
                </h4>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs border-b border-teal-100 pb-2">
                    <span className="text-teal-700">API Status</span>
                    <span className="font-bold text-green-700 flex items-center gap-1">
                      <FontAwesomeIcon icon={faCheck} className="text-[10px]" /> Ativo
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs border-b border-teal-100 pb-2">
                    <span className="text-teal-700">Webhook oficial</span>
                    <span className="font-bold text-amber-700 flex items-center gap-1">
                      <FontAwesomeIcon icon={faTriangleExclamation} className="text-[10px]" /> Não validado
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
