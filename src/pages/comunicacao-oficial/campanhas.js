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
  faTimes,
  faList,
  faLayerGroup,
  faCheckCircle,
  faClock,
  faPaperPlane,
  faEye,
  faCalendarAlt
} from '@fortawesome/free-solid-svg-icons';
import { CampanhaCard } from '@/components/CampanhaCard';
import AssistenteCampanha from '@/components/AssistenteCampanha';

export default function CampanhasOficiaisPage() {
  const router = useRouter();
  const [campanhas, setCampanhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [criando, setCriando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('fila'); // 'fila' | 'historico'
  const [filtroStatusHistorico, setFiltroStatusHistorico] = useState('todos');
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

  // Campanhas na Fila ou rascunho (não iniciadas)
  const campanhasFila = campanhas.filter(c => ['Na Fila', 'rascunho', 'agendado'].includes(c.status));

  // Campanhas já iniciadas/executadas/entregues/concluídas/pausadas/canceladas
  const campanhasHistorico = campanhas.filter(c => !['Na Fila', 'rascunho', 'agendado'].includes(c.status));

  // Filtragem da aba 'Fila'
  const campanhasFilaFiltradas = campanhasFila.filter((c) =>
    (c.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
    (c.template || '').toLowerCase().includes(busca.toLowerCase())
  );

  // Filtragem da aba 'Histórico'
  const campanhasHistoricoFiltradas = campanhasHistorico.filter((c) => {
    const matchBusca = (c.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
      (c.template || '').toLowerCase().includes(busca.toLowerCase()) ||
      (c.publico || '').toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatusHistorico === 'todos' || c.status === filtroStatusHistorico;
    return matchBusca && matchStatus;
  });

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

  const getBadgeStatus = (status) => {
    switch (status) {
      case 'Executando':
      case 'processando':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">Executando</span>;
      case 'concluido':
      case 'enviado':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">Concluído</span>;
      case 'Pausada':
        return <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">Pausada</span>;
      case 'Cancelada':
        return <span className="bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-bold px-2 py-0.5 rounded-full">Cancelada</span>;
      default:
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full">{status}</span>;
    }
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
                  Gerencie transmissões pendentes na fila e consulte o histórico de campanhas executadas e entregues.
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

            {/* Navegação por Abas (Fila vs Entregues / Histórico) */}
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
              <button
                onClick={() => setAbaAtiva('fila')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
                  abaAtiva === 'fila'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <FontAwesomeIcon icon={faLayerGroup} />
                Disparos na Fila ({campanhasFila.length})
              </button>

              <button
                onClick={() => setAbaAtiva('historico')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
                  abaAtiva === 'historico'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <FontAwesomeIcon icon={faList} />
                Entregues & Histórico ({campanhasHistorico.length})
              </button>
            </div>

            {/* Barra de Filtros e Pesquisa */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={abaAtiva === 'fila' ? "Pesquisar disparos na fila..." : "Pesquisar por campanha, template ou público..."}
                className="w-full md:w-80 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />

              {abaAtiva === 'historico' && (
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                    <FontAwesomeIcon icon={faFilter} /> Status:
                  </span>
                  <select
                    value={filtroStatusHistorico}
                    onChange={(e) => setFiltroStatusHistorico(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="Executando">Executando</option>
                    <option value="concluido">Concluído</option>
                    <option value="Pausada">Pausada</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </div>
              )}
            </div>

            {/* CONTEÚDO DA ABA 1: DISPAROS NA FILA (Cards) */}
            {abaAtiva === 'fila' && (
              loading ? (
                <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
                  <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-teal-600 mb-3" />
                  <p className="text-sm font-semibold text-gray-600">Carregando disparos na fila...</p>
                </div>
              ) : campanhasFilaFiltradas.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {campanhasFilaFiltradas.map((camp) => (
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
                  <p className="text-sm">Nenhum disparo pendente na fila no momento.</p>
                </div>
              )
            )}

            {/* CONTEÚDO DA ABA 2: ENTREGUES & HISTÓRICO (Tabela Otimizada) */}
            {abaAtiva === 'historico' && (
              loading ? (
                <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
                  <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-teal-600 mb-3" />
                  <p className="text-sm font-semibold text-gray-600">Carregando histórico de entregas...</p>
                </div>
              ) : campanhasHistoricoFiltradas.length > 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50/75 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          <th className="py-3.5 px-4">Campanha / Template</th>
                          <th className="py-3.5 px-4">Público / Origem</th>
                          <th className="py-3.5 px-4 text-center">Público Total</th>
                          <th className="py-3.5 px-4 text-center">Entregues</th>
                          <th className="py-3.5 px-4 text-center">Lidas</th>
                          <th className="py-3.5 px-4 text-center">Falhas</th>
                          <th className="py-3.5 px-4 text-center">Status</th>
                          <th className="py-3.5 px-4">Data de Criação</th>
                          <th className="py-3.5 px-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700">
                        {campanhasHistoricoFiltradas.map((camp) => (
                          <tr
                            key={camp.id}
                            onClick={() => router.push(`/comunicacao-oficial/campanhas/${camp.id}`)}
                            className="hover:bg-teal-50/40 transition cursor-pointer"
                          >
                            <td className="py-3 px-4">
                              <p className="font-bold text-gray-900 hover:text-teal-600 transition">{camp.nome}</p>
                              <span className="text-[10px] text-gray-400">Template: {camp.template}</span>
                            </td>
                            <td className="py-3 px-4 font-medium text-gray-600">
                              {camp.publico}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-gray-700">
                              {camp.total_destinatarios || 0}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-emerald-600">
                              {camp.entregues || 0}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-blue-600">
                              {camp.lidas || 0}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-rose-600">
                              {camp.falhas || 0}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {getBadgeStatus(camp.status)}
                            </td>
                            <td className="py-3 px-4 text-gray-500 text-[11px]">
                              {camp.created_at ? new Date(camp.created_at).toLocaleString('pt-BR') : '-'}
                            </td>
                            <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => router.push(`/comunicacao-oficial/campanhas/${camp.id}`)}
                                className="bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold py-1 px-3 rounded-lg border border-teal-100 transition text-[11px] flex items-center gap-1.5 ml-auto"
                              >
                                <FontAwesomeIcon icon={faEye} />
                                Detalhes
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
                  <FontAwesomeIcon icon={faInbox} className="text-4xl text-gray-200 mb-3" />
                  <p className="text-sm">Nenhuma campanha encontrada no histórico com os filtros selecionados.</p>
                </div>
              )
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
