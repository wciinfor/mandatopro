import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBullhorn, faPlus, faFilter, faInbox, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { CampanhaCard } from '@/components/CampanhaCard';
import AssistenteCampanha from '@/components/AssistenteCampanha';

export default function CampanhasOficiaisPage() {
  const [campanhas, setCampanhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [criando, setCriando] = useState(false);

  const carregarCampanhasReais = async () => {
    setLoading(true);
    try {
      // Busca diretamente as campanhas oficiais cadastradas
      const res = await fetch('/api/comunicacao-oficial/salvar-comunicacao');
      if (res.ok) {
        const data = await res.json();
        setCampanhas(data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar lista de campanhas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarCampanhasReais();
  }, []);

  const filtrarCampanhas = campanhas.filter((c) => 
    (c.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
    (c.template || '').toLowerCase().includes(busca.toLowerCase())
  );

  const handleSalvarNovaCampanha = async (novaCamp) => {
    try {
      const res = await fetch('/api/comunicacao-oficial/salvar-comunicacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaCamp)
      });
      if (res.ok) {
        await carregarCampanhasReais();
      }
    } catch (err) {
      console.error('Erro ao salvar comunicação oficial:', err);
    }
    setCriando(false);
  };

  return (
    <ProtectedRoute>
      <Layout titulo="Disparos Oficiais - WhatsApp Cloud API Oficial">
        {criando ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-teal-100/50">
              <h3 className="font-bold text-gray-800 text-sm">Criar Novo Disparo Oficial (Transmissão em Massa)</h3>
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
                <h3 className="text-xl font-bold text-gray-800">Disparos Oficiais & Histórico</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Gerencie transmissões ativas, crie novos envios e consulte o histórico detalhado de entregas e leituras.
                </p>
              </div>
              <div>
                <button
                  onClick={() => setCriando(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition flex items-center gap-2 shadow-sm"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Novo Disparo Oficial
                </button>
              </div>
            </div>

            {/* Barra de Filtros e Pesquisa */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar comunicação ou template..."
                className="w-full md:w-80 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
              <button className="text-gray-500 hover:text-teal-600 text-xs font-semibold flex items-center gap-1.5 transition">
                <FontAwesomeIcon icon={faFilter} /> Filtrar Status
              </button>
            </div>

            {/* Lista de cards */}
            {loading ? (
              <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
                <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-teal-600 mb-3" />
                <p className="text-sm font-semibold text-gray-600">Carregando comunicações de transmissão...</p>
              </div>
            ) : filtrarCampanhas.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtrarCampanhas.map((camp) => (
                  <CampanhaCard key={camp.id} campanha={camp} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
                <FontAwesomeIcon icon={faInbox} className="text-4xl text-gray-200 mb-3" />
                <p className="text-sm">Nenhuma comunicação atende aos filtros pesquisados.</p>
              </div>
            )}
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}
