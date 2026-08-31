import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBullhorn,
  faPlus,
  faFilter,
  faInbox,
  faSpinner,
  faTrashAlt,
  faExclamationTriangle,
  faTimes
} from '@fortawesome/free-solid-svg-icons';
import { CampanhaCard } from '@/components/CampanhaCard';
import AssistenteCampanha from '@/components/AssistenteCampanha';

export default function CampanhasOficiaisPage() {
  const router = useRouter();
  const [campanhas, setCampanhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [criando, setCriando] = useState(false);
  const [campanhaParaExcluir, setCampanhaParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [feedback, setFeedback] = useState(null);

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

  const handleExcluirCampanha = async () => {
    if (!campanhaParaExcluir || excluindo) return;
    setExcluindo(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/comunicacao-oficial/campanhas/${campanhaParaExcluir.id}/acoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'excluir' })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Falha ao excluir a campanha.');
      }

      setFeedback({ tipo: 'sucesso', texto: 'Campanha e itens da fila excluídos com sucesso!' });
      setCampanhas(prev => prev.filter(c => c.id !== campanhaParaExcluir.id));
      setCampanhaParaExcluir(null);
    } catch (err) {
      console.error('Erro ao excluir campanha:', err);
      setFeedback({ tipo: 'erro', texto: err.message || 'Não foi possível excluir a campanha.' });
    } finally {
      setExcluindo(false);
    }
  };

  const handleSalvarNovaCampanha = async (novaCamp) => {
    try {
      const res = await fetch('/api/comunicacao-oficial/salvar-comunicacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaCamp)
      });
      if (res.ok) {
        const criada = await res.json();
        if (criada?.id) {
          router.push(`/comunicacao-oficial/campanhas/${criada.id}`);
          return;
        }
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
            {/* Feedback Alert */}
            {feedback && (
              <div className={`p-4 rounded-2xl flex items-center justify-between text-xs font-semibold ${
                feedback.tipo === 'sucesso' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                <span>{feedback.texto}</span>
                <button onClick={() => setFeedback(null)} className="hover:opacity-70">
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
            )}

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
                  <CampanhaCard
                    key={camp.id}
                    campanha={camp}
                    onExcluir={setCampanhaParaExcluir}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
                <FontAwesomeIcon icon={faInbox} className="text-4xl text-gray-200 mb-3" />
                <p className="text-sm">Nenhuma comunicação atende aos filtros pesquisados.</p>
              </div>
            )}

            {/* Modal de Confirmação de Exclusão */}
            {campanhaParaExcluir && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-red-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center gap-3 text-red-600">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                      <FontAwesomeIcon icon={faExclamationTriangle} className="text-lg" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Cancelar e Excluir Disparo</h4>
                      <p className="text-xs text-gray-500">Confirmação de exclusão definitiva</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 text-xs text-gray-600 space-y-1.5">
                    <p>
                      Você está prestes a excluir a comunicação <strong>"{campanhaParaExcluir.nome}"</strong>.
                    </p>
                    <p className="text-red-700 font-medium">
                      ⚠️ O registro da campanha e todos os seus <strong>{campanhaParaExcluir.total_destinatarios || 0} contatos na fila</strong> serão cancelados e removidos definitivamente da base de dados.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setCampanhaParaExcluir(null)}
                      disabled={excluindo}
                      className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleExcluirCampanha}
                      disabled={excluindo}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                    >
                      {excluindo ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />
                          Excluindo...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faTrashAlt} className="text-xs" />
                          Sim, Cancelar e Excluir
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}
