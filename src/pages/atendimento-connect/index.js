import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate,
  faCheck,
  faClock,
  faHeadset,
  faInbox,
  faMagnifyingGlass,
  faMessage,
  faPaperPlane,
  faPen,
  faPhone,
  faUserCheck
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { MODULES } from '@/utils/permissions';
import { useAuth } from '@/contexts/AuthContext';

const COLUNAS = [
  { id: 'nova', titulo: 'Novas respostas', icon: faInbox, color: 'border-teal-500' },
  { id: 'em_atendimento', titulo: 'Em atendimento', icon: faHeadset, color: 'border-blue-500' },
  { id: 'aguardando_eleitor', titulo: 'Aguardando eleitor', icon: faClock, color: 'border-amber-500' },
  { id: 'resolver_depois', titulo: 'Resolver depois', icon: faPen, color: 'border-purple-500' },
  { id: 'concluida', titulo: 'Concluídas', icon: faCheck, color: 'border-emerald-500' }
];

const STATUS_LABEL = COLUNAS.reduce((acc, coluna) => {
  acc[coluna.id] = coluna.titulo;
  return acc;
}, {});

function formatTelefone(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value || '-';
}

function formatTempo(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AtendimentoConnect() {
  const { user } = useAuth();
  const [conversas, setConversas] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [ativa, setAtiva] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);
  const [resposta, setResposta] = useState('');
  const [modoResposta, setModoResposta] = useState('nota');

  const carregarConversas = useCallback(async (signal) => {
    setLoading(true);
    setErro('');
    try {
      const params = new URLSearchParams();
      if (busca.trim()) params.set('search', busca.trim());
      const response = await fetch(`/api/atendimento-connect/conversas?${params.toString()}`, { signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Erro ao carregar atendimentos');
      if (payload.configurado === false) {
        setErro('As tabelas do Atendimento Connect ainda nao foram aplicadas no Supabase.');
      }
      setConversas(payload.data || []);
      setCounts(payload.counts || {});
    } catch (error) {
      if (error?.name !== 'AbortError') setErro(error.message || 'Erro ao carregar atendimentos');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [busca]);

  const carregarMensagens = useCallback(async (conversa) => {
    if (!conversa?.id) return;
    setCarregandoMensagens(true);
    try {
      const response = await fetch(`/api/atendimento-connect/conversas/${conversa.id}/mensagens`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Erro ao carregar conversa');
      setMensagens(payload.data || []);
    } catch (error) {
      setErro(error.message || 'Erro ao carregar conversa');
      setMensagens([]);
    } finally {
      setCarregandoMensagens(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    carregarConversas(controller.signal);
    return () => controller.abort();
  }, [carregarConversas]);

  useEffect(() => {
    if (ativa) carregarMensagens(ativa);
  }, [ativa, carregarMensagens]);

  const porStatus = useMemo(() => {
    return COLUNAS.reduce((acc, coluna) => {
      acc[coluna.id] = conversas.filter((conversa) => conversa.status === coluna.id);
      return acc;
    }, {});
  }, [conversas]);

  const atualizarConversa = async (conversa, changes) => {
    const response = await fetch(`/api/atendimento-connect/conversas/${conversa.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.message || 'Erro ao atualizar atendimento');
    setConversas((prev) => prev.map((item) => (item.id === conversa.id ? payload.data : item)));
    if (ativa?.id === conversa.id) setAtiva(payload.data);
  };

  const mover = async (conversa, status) => {
    try {
      await atualizarConversa(conversa, { status });
    } catch (error) {
      setErro(error.message);
    }
  };

  const assumir = async (conversa) => {
    try {
      await atualizarConversa(conversa, { status: 'em_atendimento', responsavelId: user?.id });
    } catch (error) {
      setErro(error.message);
    }
  };

  const enviarResposta = async () => {
    const texto = resposta.trim();
    if (!ativa?.id || !texto) return;

    try {
      const response = await fetch(`/api/atendimento-connect/conversas/${ativa.id}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: texto, direcao: modoResposta })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Erro ao registrar resposta');
      setMensagens((prev) => [...prev, payload.data]);
      setResposta('');
      await carregarConversas();
    } catch (error) {
      setErro(error.message || 'Erro ao registrar resposta');
    }
  };

  return (
    <ProtectedRoute module={MODULES.ATENDIMENTO_CONNECT}>
      <Layout titulo="Atendimento Connect">
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-teal-900">Fila de respostas dos eleitores</h1>
                <p className="text-sm text-gray-600">Triagem e acompanhamento dos retornos recebidos apos as comunicacoes.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    value={busca}
                    onChange={(event) => setBusca(event.target.value)}
                    placeholder="Buscar nome ou telefone"
                    className="w-64 max-w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => carregarConversas()}
                  className="h-10 w-10 rounded-lg bg-teal-600 text-white hover:bg-teal-700"
                  title="Atualizar"
                >
                  <FontAwesomeIcon icon={faArrowsRotate} />
                </button>
              </div>
            </div>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {erro}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-5 gap-3">
              {COLUNAS.map((coluna) => (
                <section key={coluna.id} className={`bg-white rounded-lg shadow-sm border-t-4 ${coluna.color} min-h-[520px]`}>
                  <header className="px-3 py-3 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FontAwesomeIcon icon={coluna.icon} className="text-teal-700" />
                      <h2 className="font-bold text-sm text-gray-800 truncate">{coluna.titulo}</h2>
                    </div>
                    <span className="text-xs font-bold rounded-full bg-gray-100 text-gray-700 px-2 py-1">
                      {counts[coluna.id] ?? porStatus[coluna.id]?.length ?? 0}
                    </span>
                  </header>

                  <div className="p-2 space-y-2">
                    {loading ? (
                      <div className="text-sm text-gray-500 px-2 py-6 text-center">Carregando...</div>
                    ) : porStatus[coluna.id]?.length ? (
                      porStatus[coluna.id].map((conversa) => (
                        <article
                          key={conversa.id}
                          className={`border rounded-lg p-3 cursor-pointer transition bg-white hover:border-teal-400 ${
                            ativa?.id === conversa.id ? 'border-teal-500 ring-2 ring-teal-100' : 'border-gray-200'
                          }`}
                          onClick={() => setAtiva(conversa)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-bold text-sm text-gray-900 truncate">{conversa.contatoNome}</h3>
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <FontAwesomeIcon icon={faPhone} />
                                {formatTelefone(conversa.contatoTelefone)}
                              </p>
                            </div>
                            {conversa.unreadCount > 0 && (
                              <span className="bg-teal-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
                                {conversa.unreadCount}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 line-clamp-2 mt-2">{conversa.ultimaMensagem || 'Sem mensagem'}</p>
                          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                            <span>{formatTempo(conversa.ultimaMensagemEm)}</span>
                            <span className="truncate max-w-[110px]">{conversa.responsavel?.nome || 'Sem responsavel'}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-3">
                            {conversa.status !== 'em_atendimento' && (
                              <button
                                type="button"
                                onClick={(event) => { event.stopPropagation(); assumir(conversa); }}
                                className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                              >
                                Assumir
                              </button>
                            )}
                            {conversa.status !== 'concluida' && (
                              <button
                                type="button"
                                onClick={(event) => { event.stopPropagation(); mover(conversa, 'concluida'); }}
                                className="px-2 py-1 text-xs rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              >
                                Concluir
                              </button>
                            )}
                            {conversa.status !== 'resolver_depois' && (
                              <button
                                type="button"
                                onClick={(event) => { event.stopPropagation(); mover(conversa, 'resolver_depois'); }}
                                className="px-2 py-1 text-xs rounded bg-gray-50 text-gray-700 hover:bg-gray-100"
                              >
                                Depois
                              </button>
                            )}
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="text-sm text-gray-400 px-2 py-6 text-center">Sem conversas</div>
                    )}
                  </div>
                </section>
              ))}
            </div>

            <aside className="bg-white rounded-lg shadow-sm min-h-[520px] flex flex-col">
              {ativa ? (
                <>
                  <header className="p-4 border-b">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">{ativa.contatoNome}</h2>
                        <p className="text-sm text-gray-600">{formatTelefone(ativa.contatoTelefone)}</p>
                        <p className="text-xs text-gray-500 mt-1">{STATUS_LABEL[ativa.status]} · {ativa.campanha?.titulo || 'Sem campanha vinculada'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => assumir(ativa)}
                        className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 flex items-center gap-2"
                      >
                        <FontAwesomeIcon icon={faUserCheck} />
                        Assumir
                      </button>
                    </div>
                  </header>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                    {carregandoMensagens ? (
                      <div className="text-sm text-gray-500 text-center py-8">Carregando conversa...</div>
                    ) : mensagens.length ? (
                      mensagens.map((mensagem) => (
                        <div
                          key={mensagem.id}
                          className={`max-w-[88%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                            mensagem.direcao === 'entrada'
                              ? 'bg-white border border-gray-200 text-gray-800'
                              : mensagem.direcao === 'saida'
                                ? 'bg-teal-600 text-white ml-auto'
                                : 'bg-amber-50 border border-amber-200 text-amber-900 mx-auto'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{mensagem.mensagem}</p>
                          <p className={`text-[11px] mt-1 ${mensagem.direcao === 'saida' ? 'text-teal-100' : 'text-gray-400'}`}>
                            {formatTempo(mensagem.createdAt)} {mensagem.usuario?.nome ? `· ${mensagem.usuario.nome}` : ''}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500 text-center py-8">Nenhuma mensagem registrada.</div>
                    )}
                  </div>

                  <footer className="p-4 border-t space-y-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setModoResposta('nota')}
                        className={`px-3 py-2 rounded-lg text-sm ${modoResposta === 'nota' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'}`}
                      >
                        Nota interna
                      </button>
                      <button
                        type="button"
                        onClick={() => setModoResposta('saida')}
                        className={`px-3 py-2 rounded-lg text-sm ${modoResposta === 'saida' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                      >
                        Resposta
                      </button>
                    </div>
                    {modoResposta === 'saida' && (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        A resposta fica registrada como pendente de envio ate ligarmos este painel ao endpoint de saida da Evolution/N8N.
                      </div>
                    )}
                    <textarea
                      value={resposta}
                      onChange={(event) => setResposta(event.target.value)}
                      rows={3}
                      placeholder={modoResposta === 'nota' ? 'Adicionar nota para a equipe' : 'Escrever resposta ao eleitor'}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={enviarResposta}
                      disabled={!resposta.trim()}
                      className="w-full bg-teal-600 text-white rounded-lg py-2 font-semibold hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <FontAwesomeIcon icon={modoResposta === 'nota' ? faMessage : faPaperPlane} />
                      {modoResposta === 'nota' ? 'Registrar nota' : 'Registrar resposta'}
                    </button>
                  </footer>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center p-8 text-gray-500">
                  <div>
                    <FontAwesomeIcon icon={faMessage} className="text-5xl text-gray-300 mb-3" />
                    <h2 className="font-bold text-gray-700">Selecione uma conversa</h2>
                    <p className="text-sm">Abra um card para ver o historico e registrar o atendimento.</p>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
