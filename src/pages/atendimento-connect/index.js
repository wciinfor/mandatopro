import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { faWhatsapp, faInstagram } from '@fortawesome/free-brands-svg-icons';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { MODULES } from '@/utils/permissions';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabaseClient';

const CANAL_CONFIGS = {
  whatsapp: { label: 'WhatsApp Business', icon: faWhatsapp, bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  whatsapp_legacy: { label: 'WhatsApp Legacy', icon: faWhatsapp, bg: 'bg-teal-100 text-teal-800 border-teal-200' },
  instagram: { label: 'Instagram Direct', icon: faInstagram, bg: 'bg-pink-100 text-pink-800 border-pink-200' }
};

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

  // Ref para ter acesso seguro ao id da conversa ativa nas callbacks do Realtime
  const ativaRef = useRef(null);
  useEffect(() => {
    ativaRef.current = ativa;
  }, [ativa]);

  // Ref para o container de mensagens (auto-scroll)
  const containerMensagensRef = useRef(null);

  const carregarConversas = useCallback(async (options = {}) => {
    const { signal, quiet = false } = typeof options === 'object' && options !== null ? options : {};
    if (!quiet) setLoading(true);
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
      const novasConversas = payload.data || [];
      setConversas(novasConversas);
      setCounts(payload.counts || {});

      // Sincroniza a conversa ativa existente com os dados atualizados do servidor sem fechar
      if (ativaRef.current?.id) {
        const idAtivo = Number(ativaRef.current.id);
        const atualizada = novasConversas.find(c => Number(c.id) === idAtivo);
        if (atualizada) {
          setAtiva(atualizada);
          ativaRef.current = atualizada;
        }
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setErro(error.message || 'Erro ao carregar atendimentos');
    } finally {
      if (!signal?.aborted && !quiet) setLoading(false);
    }
  }, [busca]);

  const carregarMensagens = useCallback(async (conversa, preservarScroll = false) => {
    if (!conversa?.id) return;
    setCarregandoMensagens(true);
    try {
      const response = await fetch(`/api/atendimento-connect/conversas/${conversa.id}/mensagens`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Erro ao carregar conversa');
      setMensagens(payload.data || []);

      // Auto-scroll condicional: se o usuário já estava perto do final ou se e uma troca de conversa
      setTimeout(() => {
        const el = containerMensagensRef.current;
        if (!el) return;
        if (!preservarScroll) {
          el.scrollTop = el.scrollHeight;
        } else {
          const estaPertoDoFinal = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
          if (estaPertoDoFinal) {
            el.scrollTop = el.scrollHeight;
          }
        }
      }, 50);
    } catch (error) {
      setErro(error.message || 'Erro ao carregar conversa');
      setMensagens([]);
    } finally {
      setCarregandoMensagens(false);
    }
  }, []);

  // Refs para manter funções sempre atualizadas sem forçar re-subscribe do Realtime
  const carregarConversasRef = useRef(carregarConversas);
  useEffect(() => {
    carregarConversasRef.current = carregarConversas;
  }, [carregarConversas]);

  const carregarMensagensRef = useRef(carregarMensagens);
  useEffect(() => {
    carregarMensagensRef.current = carregarMensagens;
  }, [carregarMensagens]);

  useEffect(() => {
    const controller = new AbortController();
    carregarConversas({ signal: controller.signal });
    return () => controller.abort();
  }, [carregarConversas]);

  useEffect(() => {
    if (ativa) carregarMensagens(ativa, false);
  }, [ativa, carregarMensagens]);

  // ─── SUPABASE REALTIME SUBSCRIPTIONS ───────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    console.log('[ATENDIMENTO CONNECT REALTIME] Conectando canal estavel...');

    // Subscrição única no canal criada apenas uma vez no mount
    const channel = supabase
      .channel('realtime-atendimento-connect-v3')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'atendimento_connect_conversas' },
        (payload) => {
          console.log('[ATENDIMENTO CONNECT REALTIME] Evento conversa:', payload.eventType);
          if (carregarConversasRef.current) {
            carregarConversasRef.current({ quiet: true });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'atendimento_connect_mensagens' },
        (payload) => {
          const novaMsg = payload.new;
          console.log('[ATENDIMENTO CONNECT REALTIME] Nova mensagem inserida id=', novaMsg?.id, 'conversa_id=', novaMsg?.conversa_id);
          if (!novaMsg) return;

          if (carregarConversasRef.current) {
            carregarConversasRef.current({ quiet: true });
          }

          const conversaAtual = ativaRef.current;
          if (conversaAtual?.id && Number(novaMsg.conversa_id) === Number(conversaAtual.id)) {
            // Formata a mensagem para o formato consumido pela UI
            const msgFormatada = {
              id: novaMsg.id,
              conversaId: novaMsg.conversa_id,
              direcao: novaMsg.direcao,
              mensagem: novaMsg.mensagem,
              mediaUrl: novaMsg.media_url || null,
              mediaTipo: novaMsg.media_tipo || null,
              providerMessageId: novaMsg.provider_message_id || null,
              status: novaMsg.status || 'registrada',
              usuarioId: novaMsg.usuario_id || null,
              createdAt: novaMsg.created_at || new Date().toISOString(),
              usuario: null
            };

            // Adiciona imediatamente ao estado evitando duplicados por id ou providerMessageId
            setMensagens((prev) => {
              const existe = prev.some(m =>
                (m.id && novaMsg.id && Number(m.id) === Number(novaMsg.id)) ||
                (m.providerMessageId && novaMsg.provider_message_id && m.providerMessageId === novaMsg.provider_message_id)
              );
              if (existe) return prev;
              return [...prev, msgFormatada];
            });

            // Scroll automático para o final da mensagem
            setTimeout(() => {
              const el = containerMensagensRef.current;
              if (el) {
                const estaPertoDoFinal = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
                if (estaPertoDoFinal) {
                  el.scrollTop = el.scrollHeight;
                }
              }
            }, 50);

            // Sincronização HTTP posterior sem sobrescrever mensagem recente
            if (carregarMensagensRef.current) {
              carregarMensagensRef.current(conversaAtual, true);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'atendimento_connect_mensagens' },
        (payload) => {
          const msgAtualizada = payload.new;
          if (!msgAtualizada) return;

          const conversaAtual = ativaRef.current;
          if (conversaAtual?.id && Number(msgAtualizada.conversa_id) === Number(conversaAtual.id)) {
            if (carregarMensagensRef.current) {
              carregarMensagensRef.current(conversaAtual, true);
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`[ATENDIMENTO CONNECT REALTIME] Subscription status: ${status}`, err || '');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[ATENDIMENTO CONNECT REALTIME] Falha na conexao Realtime. Aguardando reconexao...');
        }
      });

    return () => {
      console.log('[ATENDIMENTO CONNECT REALTIME] Desconectando canal...');
      supabase.removeChannel(channel);
    };
  }, []);

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
      setTimeout(() => {
        if (containerMensagensRef.current) {
          containerMensagensRef.current.scrollTop = containerMensagensRef.current.scrollHeight;
        }
      }, 50);
    } catch (error) {
      setErro(error.message || 'Erro ao registrar resposta');
    }
  };

  return (
    <ProtectedRoute module={MODULES.ATENDIMENTO_CONNECT}>
      <Layout titulo="Atendimento Connect">
        <div className="flex flex-col h-[calc(100vh-120px)] space-y-4 overflow-hidden">
          <div className="bg-white rounded-lg shadow-sm p-4 shrink-0">
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
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm shrink-0">
              {erro}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4 flex-1 min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-5 gap-3 overflow-y-auto pr-1">
              {COLUNAS.map((coluna) => (
                <section key={coluna.id} className={`bg-white rounded-lg shadow-sm border-t-4 ${coluna.color} flex flex-col h-full`}>
                  <header className="px-3 py-3 border-b flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <FontAwesomeIcon icon={coluna.icon} className="text-teal-700" />
                      <h2 className="font-bold text-sm text-gray-800 truncate">{coluna.titulo}</h2>
                    </div>
                    <span className="text-xs font-bold rounded-full bg-gray-100 text-gray-700 px-2 py-1">
                      {counts[coluna.id] ?? porStatus[coluna.id]?.length ?? 0}
                    </span>
                  </header>

                  <div className="p-2 space-y-2 flex-1 overflow-y-auto">
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
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="font-bold text-sm text-gray-900 truncate">{conversa.contatoNome}</h3>
                                {conversa.canal && (
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold border ${
                                    (CANAL_CONFIGS[conversa.canal] || CANAL_CONFIGS['whatsapp_legacy']).bg
                                  }`}>
                                    <FontAwesomeIcon icon={(CANAL_CONFIGS[conversa.canal] || CANAL_CONFIGS['whatsapp_legacy']).icon} className="text-[8px]" />
                                    {(CANAL_CONFIGS[conversa.canal] || CANAL_CONFIGS['whatsapp_legacy']).label.replace(' WhatsApp', '').replace(' Direct', '')}
                                  </span>
                                )}
                              </div>
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

            <aside className="bg-white rounded-lg shadow-sm flex flex-col h-full min-h-0">
              {ativa ? (
                <>
                  <header className="p-4 border-b shrink-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-gray-900">{ativa.contatoNome}</h2>
                          {ativa.canal && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                              (CANAL_CONFIGS[ativa.canal] || CANAL_CONFIGS['whatsapp_legacy']).bg
                            }`}>
                              <FontAwesomeIcon icon={(CANAL_CONFIGS[ativa.canal] || CANAL_CONFIGS['whatsapp_legacy']).icon} className="text-[10px]" />
                              {(CANAL_CONFIGS[ativa.canal] || CANAL_CONFIGS['whatsapp_legacy']).label}
                            </span>
                          )}
                        </div>
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

                  <div ref={containerMensagensRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 min-h-0">
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

                  <footer className="p-4 border-t space-y-3 shrink-0">
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
