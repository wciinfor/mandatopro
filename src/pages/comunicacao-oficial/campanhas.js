import { useState } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBullhorn, faPlus, faFilter, faInbox } from '@fortawesome/free-solid-svg-icons';
import { CampanhaCard } from '@/components/CampanhaCard';
import AssistenteCampanha from '@/components/AssistenteCampanha';

// Mocks de campanhas estruturadas
const MOCK_CAMPANHAS = [
  {
    id: 'camp-1',
    nome: 'Informativo Obras Verão',
    canal: 'whatsapp',
    template: 'obras_praca_central',
    publico: 'Bairro Centro - Opt-in',
    status: 'concluido',
    agendamento: null,
    total_destinatarios: 450,
    enviadas: 450,
    entregues: 442,
    lidas: 380,
    falhas: 8,
    created_at: new Date().toISOString()
  },
  {
    id: 'camp-2',
    nome: 'Gabinete Itinerante - Convite',
    canal: 'whatsapp',
    template: 'convite_gabinete_bairro',
    publico: 'Bairro Liberdade - Geral',
    status: 'agendado',
    agendamento: new Date(Date.now() + 86400000 * 2).toISOString(),
    total_destinatarios: 1200,
    enviadas: 0,
    entregues: 0,
    lidas: 0,
    falhas: 0,
    created_at: new Date().toISOString()
  }
];

export default function CampanhasOficiaisPage() {
  const [campanhas, setCampanhas] = useState(MOCK_CAMPANHAS);
  const [busca, setBusca] = useState('');
  const [criando, setCriando] = useState(false);

  const filtrarCampanhas = campanhas.filter((c) => 
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.template.toLowerCase().includes(busca.toLowerCase())
  );

  const handleSalvarNovaCampanha = (novaCamp) => {
    const campanhaCompleta = {
      id: `camp-${Date.now()}`,
      created_at: new Date().toISOString(),
      ...novaCamp
    };
    setCampanhas([campanhaCompleta, ...campanhas]);
    setCriando(false);
  };

  return (
    <ProtectedRoute>
      <Layout titulo="Campanhas - WhatsApp Cloud API Oficial">
        {criando ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-teal-100/50">
              <h3 className="font-bold text-gray-800 text-sm">Criar Nova Campanha de Transmissão Oficial</h3>
            </div>
            <AssistenteCampanha
              onCancel={() => setCriando(false)}
              onSave={handleSalvarNovaCampanha}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cabeçalho */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-2xl p-6 shadow-sm border border-teal-100/50 gap-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Campanhas de Disparos</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Monitore e gerencie disparos em massa utilizando templates de mensagens HSM homologados.
                </p>
              </div>
              <div>
                <button
                  onClick={() => setCriando(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition flex items-center gap-2 shadow-sm"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Nova Campanha
                </button>
              </div>
            </div>

            {/* Barra de Filtros e Pesquisa */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar campanha ou template..."
                className="w-full md:w-80 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
              <button className="text-gray-500 hover:text-teal-600 text-xs font-semibold flex items-center gap-1.5 transition">
                <FontAwesomeIcon icon={faFilter} /> Filtrar Status
              </button>
            </div>

            {/* Lista de cards */}
            {filtrarCampanhas.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtrarCampanhas.map((camp) => (
                  <CampanhaCard key={camp.id} campanha={camp} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
                <FontAwesomeIcon icon={faInbox} className="text-4xl text-gray-200 mb-3" />
                <p className="text-sm">Nenhuma campanha atende aos filtros pesquisados.</p>
              </div>
            )}
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}
