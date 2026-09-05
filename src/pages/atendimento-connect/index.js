import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate,
  faCheck,
  faCheckDouble,
  faClock,
  faHeadset,
  faInbox,
  faMagnifyingGlass,
  faMessage,
  faPaperPlane,
  faPen,
  faPhone,
  faUserCheck,
  faExclamationTriangle,
  faCircleExclamation,
  faFileSignature,
  faXmark,
  faChevronDown,
  faChevronUp,
  faQuoteRight,
  faBullhorn,
  faChartPie
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

function formatCanalResposta(canalResolvido, conversaAtiva) {
  const provider = (canalResolvido?.provider || conversaAtiva?.metadata?.provider || (conversaAtiva?.metadata?.origem === 'ycloud' ? 'YCLOUD' : null) || '').toUpperCase();
  const rawNum = canalResolvido?.numero_gabinete || conversaAtiva?.metadata?.numero_gabinete || conversaAtiva?.metadata?.phoneNumberId || '';
  const numLimpo = rawNum && rawNum !== 'N/A' ? formatTelefone(rawNum) : '';

  if (provider === 'YCLOUD') {
    return `Canal: YCloud ${numLimpo ? `— ${numLimpo}` : '— +55 91 8082-3372'}`;
  }
  if (provider === 'WABLAST') {
    return `Canal: WaBlast ${numLimpo ? `— ${numLimpo}` : '— +55 91 8089-6907'}`;
  }
  if (provider === 'META') {
    return `Canal: Meta ${numLimpo ? `— ${numLimpo}` : '— +55 91 8088-6129'}`;
  }

  if (numLimpo) {
    return `Canal: WhatsApp — ${numLimpo}`;
  }

  return 'Canal: WhatsApp — conta principal';
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
  const [modalTemplateAberto, setModalTemplateAberto] = useState(false);
  const [templatesDisponiveis, setTemplatesDisponiveis] = useState([]);
  const [carregandoTemplates, setCarregandoTemplates] = useState(false);
  const [templateSelecionado, setTemplateSelecionado] = useState(null);
  const [variaveisTemplate, setVariaveisTemplate] = useState({});
  const [enviandoTemplate, setEnviandoTemplate] = useState(false);
  const [canalResolvido, setCanalResolvido] = useState(null);
  const [avisoJanela, setAvisoJanela] = useState('');
  const [modalAtendimentoAberto, setModalAtendimentoAberto] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('nova');
  const [disparoOrigem, setDisparoOrigem] = useState(null);
  const [painelDisparoExpandido, setPainelDisparoExpandido] = useState(false);

  const carregarTemplatesOficiais = useCallback(async () => {
    setCarregandoTemplates(true);
    try {
      const response = await fetch('/api/whatsapp-business/templates');
      const payload = await response.json();
      if (response.ok && payload.success && Array.isArray(payload.templates)) {
        setTemplatesDisponiveis(payload.templates);
        if (payload.templates.length > 0) {
          setTemplateSelecionado(payload.templates[0]);
        } else {
          setTemplateSelecionado(null);
        }
      } else {
        setTemplatesDisponiveis([]);
        setTemplateSelecionado(null);
      }
    } catch (err) {
      console.error('Erro ao buscar templates oficiais:', err);
      setTemplatesDisponiveis([]);
      setTemplateSelecionado(null);
    } finally {
      setCarregandoTemplates(false);
    }
  }, []);

  // Ref para ter acesso seguro ao id da conversa ativa nas callbacks do Realtime
  const ativaRef = useRef(null);
  useEffect(() => {
    ativaRef.current = ativa;
  }, [ativa]);

  // Ref para o container de mensagens (auto-scroll)
  const containerMensagensRef = useRef(null);

  // Refs para fallback de polling quando o Realtime estiver indisponível
  const pollingIntervalRef = useRef(null);
  const isPollingExecutingRef = useRef(false);

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

      // Atualiza conversas SOMENTE se houver alteração real para evitar o 'piscar' no Kanban
      setConversas((prev) => {
        if (prev.length !== novasConversas.length) return novasConversas;
        const mudou = prev.some((c, idx) => {
          const n = novasConversas[idx];
          if (!n) return true;
          return (
            c.id !== n.id ||
            c.status !== n.status ||
            c.unreadCount !== n.unreadCount ||
            c.ultimaMensagem !== n.ultimaMensagem ||
            (c.ultimaMensagemEm || c.updatedAt) !== (n.ultimaMensagemEm || n.updatedAt)
          );
        });
        return mudou ? novasConversas : prev;
      });

      setCounts(payload.counts || {});

      // Sincroniza a conversa ativa existente com os dados atualizados do servidor sem fechar ou desmontar
      if (ativaRef.current?.id) {
        const idAtivo = Number(ativaRef.current.id);
        const atualizada = novasConversas.find(c => Number(c.id) === idAtivo);
        if (atualizada) {
          setAtiva((prevAtiva) => {
            if (!prevAtiva) return atualizada;
            const mudouAtiva = (
              prevAtiva.status !== atualizada.status ||
              prevAtiva.unreadCount !== atualizada.unreadCount ||
              prevAtiva.ultimaMensagem !== atualizada.ultimaMensagem ||
              (prevAtiva.ultimaMensagemEm || prevAtiva.updatedAt) !== (atualizada.ultimaMensagemEm || atualizada.updatedAt)
            );
            if (mudouAtiva) {
              ativaRef.current = atualizada;
              return atualizada;
            }
            return prevAtiva;
          });
        }
      }
    } catch (error) {
      if (error?.name !== 'AbortError' && !quiet) setErro(error.message || 'Erro ao carregar atendimentos');
    } finally {
      if (!signal?.aborted && !quiet) setLoading(false);
    }
  }, [busca]);

  const carregarMensagens = useCallback(async (conversa, options = false) => {
    let preservarScroll = false;
    let quiet = false;
    if (typeof options === 'boolean') {
      preservarScroll = options;
    } else if (typeof options === 'object' && options !== null) {
      preservarScroll = !!options.preservarScroll;
      quiet = !!options.quiet;
    }

    if (!conversa?.id) return;
    if (!quiet) setCarregandoMensagens(true);
    try {
      const response = await fetch(`/api/atendimento-connect/conversas/${conversa.id}/mensagens`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Erro ao carregar conversa');
      const novasMsgs = payload.data || [];
      if (payload.canalResolvido) {
        setCanalResolvido(payload.canalResolvido);
      }

      // Atualiza setMensagens SOMENTE se houver alteração real para evitar re-renderizações desnecessárias / piscar
      setMensagens((prev) => {
        if (prev.length !== novasMsgs.length) return novasMsgs;
        const mudou = prev.some((m, idx) => {
          const n = novasMsgs[idx];
          if (!n) return true;
          return (
            m.id !== n.id ||
            m.status !== n.status ||
            m.mensagem !== n.mensagem ||
            m.providerMessageId !== n.providerMessageId ||
            (m.createdAt || m.created_at) !== (n.createdAt || n.created_at)
          );
        });
        return mudou ? novasMsgs : prev;
      });

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
      if (!quiet) {
        setErro(error.message || 'Erro ao carregar conversa');
        setMensagens([]);
      }
    } finally {
      if (!quiet) setCarregandoMensagens(false);
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

  // Carrega enriquecimento do disparoOrigem quando uma conversa for aberta
  useEffect(() => {
    let cancelado = false;
    setPainelDisparoExpandido(false);

    if (!ativa?.id) {
      setDisparoOrigem(null);
      return;
    }

    // Se a conversa nem possui campanhaId ou campanha_id, garante disparoOrigem nulo sem request desnecessário
    if (!ativa.campanhaId && !ativa.campanha_id) {
      setDisparoOrigem(null);
      return;
    }

    const carregarDetalhesConversa = async () => {
      try {
        const res = await fetch(`/api/atendimento-connect/conversas/${ativa.id}`);
        const payload = await res.json();
        if (!cancelado && res.ok && payload.success) {
          setDisparoOrigem(payload.disparoOrigem || null);
        } else if (!cancelado) {
          setDisparoOrigem(null);
        }
      } catch (e) {
        if (!cancelado) setDisparoOrigem(null);
      }
    };

    carregarDetalhesConversa();

    return () => {
      cancelado = true;
    };
  }, [ativa?.id, ativa?.campanhaId, ativa?.campanha_id]);

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
          console.log('[ATENDIMENTO CONNECT REALTIME] Evento INSERT mensagem:', novaMsg?.id, 'conversa_id:', novaMsg?.conversa_id);
          if (!novaMsg) return;

          if (carregarConversasRef.current) {
            carregarConversasRef.current({ quiet: true });
          }

          const conversaAtual = ativaRef.current;
          if (conversaAtual?.id && Number(novaMsg.conversa_id) === Number(conversaAtual.id)) {
            // Formata a mensagem garantindo compatibilidade com camelCase e snake_case da UI
            const msgFormatada = {
              id: novaMsg.id,
              conversaId: novaMsg.conversa_id,
              conversa_id: novaMsg.conversa_id,
              direcao: novaMsg.direcao,
              mensagem: novaMsg.mensagem,
              mediaUrl: novaMsg.media_url || null,
              mediaTipo: novaMsg.media_tipo || null,
              providerMessageId: novaMsg.provider_message_id || null,
              status: novaMsg.status || 'registrada',
              usuarioId: novaMsg.usuario_id || null,
              createdAt: novaMsg.created_at || new Date().toISOString(),
              created_at: novaMsg.created_at || new Date().toISOString(),
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
              carregarMensagensRef.current(conversaAtual, { quiet: true, preservarScroll: true });
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
            setMensagens((prev) =>
              prev.map((m) => {
                if (
                  (m.id && msgAtualizada.id && Number(m.id) === Number(msgAtualizada.id)) ||
                  (m.providerMessageId && msgAtualizada.provider_message_id && m.providerMessageId === msgAtualizada.provider_message_id)
                ) {
                  return {
                    ...m,
                    status: msgAtualizada.status || m.status,
                    providerMessageId: msgAtualizada.provider_message_id || m.providerMessageId,
                    rawPayload: msgAtualizada.raw_payload || m.rawPayload
                  };
                }
                return m;
              })
            );

            if (carregarMensagensRef.current) {
              carregarMensagensRef.current(conversaAtual, { quiet: true, preservarScroll: true });
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`[ATENDIMENTO CONNECT REALTIME] Subscription status: ${status}`, err || '');

        if (status === 'SUBSCRIBED') {
          console.log('[ATENDIMENTO CONNECT REALTIME] SUBSCRIBED');
          if (pollingIntervalRef.current) {
            console.log('[ATENDIMENTO CONNECT REALTIME] REALTIME RESTAURADO — POLLING DESATIVADO');
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`[ATENDIMENTO CONNECT REALTIME] ${status}`);
          if (!pollingIntervalRef.current) {
            console.log('[ATENDIMENTO CONNECT REALTIME] FALLBACK POLLING ATIVADO');
            pollingIntervalRef.current = setInterval(async () => {
              if (isPollingExecutingRef.current) return;
              isPollingExecutingRef.current = true;
              console.log('[ATENDIMENTO CONNECT REALTIME] FALLBACK POLLING EXECUTADO');
              try {
                if (carregarConversasRef.current) {
                  await carregarConversasRef.current({ quiet: true });
                }
                const conversaAtual = ativaRef.current;
                if (conversaAtual?.id && carregarMensagensRef.current) {
                  await carregarMensagensRef.current(conversaAtual, { quiet: true, preservarScroll: true });
                }
              } catch (e) {
                console.error('[ATENDIMENTO CONNECT REALTIME] Erro durante fallback polling:', e);
              } finally {
                isPollingExecutingRef.current = false;
              }
            }, 10000);
          }
        }
      });

    return () => {
      console.log('[ATENDIMENTO CONNECT REALTIME] Desconectando canal...');
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
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

      if (!response.ok) {
        if (payload?.code === 'WINDOW_24H_CLOSED' || response.status === 422) {
          if (payload?.data) {
            setMensagens((prev) => [...prev, payload.data]);
          }
          setAvisoJanela(payload?.message || 'A janela de 24 horas está fechada. Envie uma mensagem usando um template aprovado.');
          // Abre e carrega automaticamente o modal existente de Template WhatsApp
          carregarTemplatesOficiais();
          setModalTemplateAberto(true);
          return;
        }
        throw new Error(payload?.message || 'Erro ao registrar resposta');
      }

      setMensagens((prev) => [...prev, payload.data]);
      setResposta('');
      setAvisoJanela('');
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

  const enviarTemplateSelecionado = async () => {
    if (!ativa?.id || !templateSelecionado) return;

    try {
      setEnviandoTemplate(true);
      const params = {
        templateNome: templateSelecionado.nome,
        name: templateSelecionado.nome,
        idiomaCode: templateSelecionado.idioma || 'pt_BR',
        componentes: []
      };

      // Mapeia variáveis preenchidas para o corpo do template se houver
      const bodyComp = templateSelecionado.componentes?.find(c => c.type === 'BODY');
      if (bodyComp) {
        const matches = bodyComp.text.match(/\{\{(\d+)\}\}/g) || [];
        if (matches.length > 0) {
          const parameters = matches.map((m, idx) => ({
            type: 'text',
            text: variaveisTemplate[idx + 1] || 'Eleitor'
          }));
          params.componentes.push({
            type: 'body',
            parameters
          });
        }
      }

      const response = await fetch(`/api/atendimento-connect/conversas/${ativa.id}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direcao: 'saida',
          templateParams: params
        })
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Erro ao enviar template');

      setMensagens((prev) => [...prev, payload.data]);
      setModalTemplateAberto(false);
      setTemplateSelecionado(null);
      setVariaveisTemplate({});
      await carregarConversas();

      setTimeout(() => {
        if (containerMensagensRef.current) {
          containerMensagensRef.current.scrollTop = containerMensagensRef.current.scrollHeight;
        }
      }, 50);
    } catch (error) {
      setErro(error.message || 'Erro ao enviar template');
    } finally {
      setEnviandoTemplate(false);
    }
  };

  // Identifica se a janela de 24 horas está fechada
  const ultimaMsgSaida = [...mensagens].reverse().find(m => m.direcao === 'saida');
  const rawUltima = ultimaMsgSaida?.rawPayload || ultimaMsgSaida?.raw_payload || {};
  const erroMsgUltima = String(rawUltima.error?.message || rawUltima.errorMessage || '').toLowerCase();
  const erroCodeUltima = String(rawUltima.error?.code || rawUltima.errorCode || rawUltima.statusUpdate?.errorCode || '');

  const janelaExpirada = Boolean(
    avisoJanela ||
    (
      ultimaMsgSaida &&
      (ultimaMsgSaida.status === 'failed' || ultimaMsgSaida.status === 'falhou') &&
      (
        erroCodeUltima === '131047' ||
        erroMsgUltima.includes('janela 24h fechada') ||
        erroMsgUltima.includes('janela 24 horas fechada') ||
        erroMsgUltima.includes('out of 24 hours') ||
        erroMsgUltima.includes('re-engagement message')
      )
    )
  );

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
                <Link
                  href="/atendimento-connect/relatorios"
                  className="h-10 px-3.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 flex items-center gap-2 text-xs font-bold transition shadow-sm"
                  title="Central de Relatórios e Métricas"
                >
                  <FontAwesomeIcon icon={faChartPie} />
                  <span className="hidden sm:inline">Relatórios</span>
                </Link>
                <button
                  type="button"
                  onClick={() => carregarConversas()}
                  className="h-10 w-10 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition"
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

          {/* Barra de Abas por Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1.5 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto">
              {COLUNAS.map((coluna) => {
                const isActive = abaAtiva === coluna.id;
                const countVal = counts[coluna.id] ?? porStatus[coluna.id]?.length ?? 0;

                return (
                  <button
                    key={coluna.id}
                    type="button"
                    onClick={() => setAbaAtiva(coluna.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shrink-0 ${
                      isActive
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <FontAwesomeIcon icon={coluna.icon} className={isActive ? 'text-white' : 'text-gray-400'} />
                    <span>{coluna.titulo}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                      isActive
                        ? 'bg-teal-700/80 text-white'
                        : countVal > 0
                          ? 'bg-teal-50 text-teal-700 border border-teal-200'
                          : 'bg-gray-100 text-gray-500'
                    }`}>
                      {countVal}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista/Tabela Operacional da Aba Selecionada */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="text-sm text-gray-500 py-16 text-center flex flex-col items-center justify-center gap-2">
                  <FontAwesomeIcon icon={faArrowsRotate} className="animate-spin text-teal-600 text-xl" />
                  <span>Carregando conversas...</span>
                </div>
              ) : (porStatus[abaAtiva] || []).length === 0 ? (
                <div className="text-sm text-gray-400 py-16 text-center flex flex-col items-center justify-center gap-2">
                  <FontAwesomeIcon icon={faMessage} className="text-gray-300 text-3xl" />
                  <p className="font-semibold text-gray-600">Nenhuma conversa nesta aba.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-gray-50/80 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                    <tr>
                      <th className="py-3 px-4">Contato</th>
                      <th className="py-3 px-3 hidden sm:table-cell">Canal</th>
                      <th className="py-3 px-3 hidden lg:table-cell">Campanha</th>
                      <th className="py-3 px-4">Última Mensagem</th>
                      <th className="py-3 px-3 hidden md:table-cell">Última Interação</th>
                      <th className="py-3 px-3 hidden xl:table-cell">Responsável</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(porStatus[abaAtiva] || []).map((conversa) => {
                      const isUrgente = conversa.prioridade === 'alta' || conversa.prioridade === 'urgente';
                      const hasUnread = (conversa.unreadCount || 0) > 0;

                      return (
                        <tr
                          key={conversa.id}
                          onClick={() => {
                            setAtiva(conversa);
                            setModalAtendimentoAberto(true);
                          }}
                          className={`cursor-pointer transition-colors group ${
                            hasUnread
                              ? 'bg-teal-50/30 hover:bg-teal-50/60'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {/* Coluna 1: CONTATO (Nome + Telefone) */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {hasUnread && (
                                <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" title="Novas mensagens" />
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`font-bold text-gray-900 truncate ${hasUnread ? 'text-teal-950 font-extrabold' : ''}`}>
                                    {conversa.contatoNome}
                                  </span>
                                  {isUrgente && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                      Urgente
                                    </span>
                                  )}
                                  {hasUnread && (
                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-teal-600 text-white">
                                      {conversa.unreadCount} nova{conversa.unreadCount > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                  <FontAwesomeIcon icon={faPhone} className="text-[10px] text-gray-400" />
                                  <span>{formatTelefone(conversa.contatoTelefone)}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Coluna 2: CANAL */}
                          <td className="py-3 px-3 hidden sm:table-cell">
                            {conversa.canal ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                                (CANAL_CONFIGS[conversa.canal] || CANAL_CONFIGS['whatsapp_legacy']).bg
                              }`}>
                                <FontAwesomeIcon icon={(CANAL_CONFIGS[conversa.canal] || CANAL_CONFIGS['whatsapp_legacy']).icon} className="text-[10px]" />
                                {(CANAL_CONFIGS[conversa.canal] || CANAL_CONFIGS['whatsapp_legacy']).label.replace(' WhatsApp', '').replace(' Direct', '')}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>

                          {/* Coluna 3: CAMPANHA */}
                          <td className="py-3 px-3 hidden lg:table-cell">
                            {conversa.campanha?.titulo ? (
                              <span className="inline-block max-w-[180px] truncate text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-medium" title={conversa.campanha.titulo}>
                                {conversa.campanha.titulo}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Sem campanha</span>
                            )}
                          </td>

                          {/* Coluna 4: ÚLTIMA MENSAGEM */}
                          <td className="py-3 px-4 max-w-xs md:max-w-md">
                            <p className="text-xs text-gray-700 line-clamp-1 group-hover:text-gray-950">
                              {conversa.ultimaMensagem || <span className="italic text-gray-400">Sem mensagem</span>}
                            </p>
                          </td>

                          {/* Coluna 5: ÚLTIMA INTERAÇÃO */}
                          <td className="py-3 px-3 hidden md:table-cell whitespace-nowrap text-xs text-gray-500">
                            {formatTempo(conversa.ultimaMensagemEm)}
                          </td>

                          {/* Coluna 6: RESPONSÁVEL */}
                          <td className="py-3 px-3 hidden xl:table-cell whitespace-nowrap text-xs text-gray-600">
                            {conversa.responsavel?.nome || <span className="text-gray-400 italic">Não atribuído</span>}
                          </td>

                          {/* Coluna 7: AÇÕES */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {conversa.status !== 'em_atendimento' && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); assumir(conversa); }}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
                                  title="Assumir conversa"
                                >
                                  Assumir
                                </button>
                              )}
                              {conversa.status !== 'concluida' && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); mover(conversa, 'concluida'); }}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
                                  title="Concluir atendimento"
                                >
                                  Concluir
                                </button>
                              )}
                              {conversa.status !== 'resolver_depois' && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); mover(conversa, 'resolver_depois'); }}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition"
                                  title="Mover para resolver depois"
                                >
                                  Depois
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Modal de Atendimento e Conversa */}
          {modalAtendimentoAberto && ativa && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl h-[92vh] max-h-[850px] overflow-hidden flex flex-col">
                <header className="p-4 border-b shrink-0 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-bold text-gray-900 truncate">{ativa.contatoNome}</h2>
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
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-xs font-medium text-gray-500">
                          {STATUS_LABEL[ativa.status]}
                        </span>
                        <span className="text-xs text-gray-300">·</span>

                        {/* Contextualização Segura da Campanha de Origem */}
                        {ativa.campanha?.titulo ? (
                          (ativa.metodoAtribuicao === 'direto_quote' || ativa.metadata?.metodo_atribuicao === 'direto_quote') ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                              title="Citação direta: o eleitor respondeu citando diretamente a mensagem desta campanha"
                            >
                              <FontAwesomeIcon icon={faQuoteRight} className="text-[10px] text-emerald-600" />
                              <span>Em resposta a: <strong className="font-bold">{ativa.campanha.titulo}</strong></span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200"
                              title="Correlação temporal: o sistema identificou um único disparo recente compatível com este contato nas últimas 48 horas"
                            >
                              <FontAwesomeIcon icon={faBullhorn} className="text-[10px] text-indigo-600" />
                              <span>Provável origem: <strong className="font-bold">{ativa.campanha.titulo}</strong></span>
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-gray-400">Sem campanha vinculada</span>
                        )}

                        <span className="text-xs text-gray-300">|</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                          {formatCanalResposta(canalResolvido, ativa)}
                        </span>

                        {/* Botão para Expandir/Recolher Detalhes do Disparo de Origem */}
                        {disparoOrigem && (
                          <button
                            type="button"
                            onClick={() => setPainelDisparoExpandido(!painelDisparoExpandido)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition-colors ml-1"
                            title={painelDisparoExpandido ? 'Ocultar detalhes do disparo' : 'Ver mensagem disparada'}
                          >
                            <span>Ver mensagem disparada</span>
                            <FontAwesomeIcon
                              icon={painelDisparoExpandido ? faChevronUp : faChevronDown}
                              className="text-[10px] text-gray-500"
                            />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {ativa.status !== 'em_atendimento' && (
                        <button
                          type="button"
                          onClick={() => assumir(ativa)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 flex items-center gap-1.5 transition"
                        >
                          <FontAwesomeIcon icon={faUserCheck} />
                          Assumir
                        </button>
                      )}
                      {ativa.status !== 'concluida' && (
                        <button
                          type="button"
                          onClick={() => mover(ativa, 'concluida')}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1.5 transition"
                        >
                          <FontAwesomeIcon icon={faCheck} />
                          Concluir
                        </button>
                      )}
                      {ativa.status !== 'resolver_depois' && (
                        <button
                          type="button"
                          onClick={() => mover(ativa, 'resolver_depois')}
                          className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-xs font-semibold hover:bg-gray-700 flex items-center gap-1.5 transition"
                        >
                          <FontAwesomeIcon icon={faPen} />
                          Depois
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setModalAtendimentoAberto(false)}
                        className="h-8 w-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition ml-1"
                        title="Fechar atendimento"
                      >
                        <FontAwesomeIcon icon={faXmark} className="text-lg" />
                      </button>
                    </div>
                  </div>
                </header>

                {/* Painel Recolhível: Detalhes do Disparo de Origem */}
                {disparoOrigem && painelDisparoExpandido && (
                  <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 text-xs text-slate-700 shrink-0 transition-all">
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">
                            {ativa.campanha?.titulo || 'Campanha'}
                          </span>
                          {(ativa.metodoAtribuicao === 'direto_quote' || ativa.metadata?.metodo_atribuicao === 'direto_quote') ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <FontAwesomeIcon icon={faQuoteRight} className="text-[10px]" />
                              Mensagem citada pelo eleitor
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              <FontAwesomeIcon icon={faBullhorn} className="text-[10px]" />
                              Disparo recente identificado
                            </span>
                          )}
                        </div>
                        {!(ativa.metodoAtribuicao === 'direto_quote' || ativa.metadata?.metodo_atribuicao === 'direto_quote') && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            O sistema identificou um único disparo recente compatível com este contato.
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setPainelDisparoExpandido(false)}
                        className="text-slate-400 hover:text-slate-600 p-1 transition"
                        title="Recolher painel"
                      >
                        <FontAwesomeIcon icon={faXmark} className="text-sm" />
                      </button>
                    </div>

                    {/* Metadados do Disparo (Sem IDs técnicos ou brutos) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2 px-2.5 bg-white rounded-lg border border-slate-200/80 mb-2.5">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Data/Hora do envio</span>
                        <span className="font-medium text-slate-800">
                          {formatTempo(disparoOrigem.startedAt || disparoOrigem.finishedAt)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Status do envio</span>
                        <span className="inline-block capitalize font-medium text-slate-800">
                          {disparoOrigem.status || 'Enviado'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Provedor</span>
                        <span className="font-medium text-slate-800 uppercase">
                          {disparoOrigem.provider || 'WhatsApp'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Número remetente</span>
                        <span className="font-medium text-slate-800">
                          {disparoOrigem.numeroRemetente ? formatTelefone(disparoOrigem.numeroRemetente) : 'Conta do Gabinete'}
                        </span>
                      </div>
                    </div>

                    {/* Conteúdo textual da Mensagem Enviada */}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                        Texto da mensagem disparada:
                      </span>
                      <div className="bg-white rounded-lg border border-slate-200 p-3 max-h-40 overflow-y-auto text-slate-800 font-normal leading-relaxed whitespace-pre-wrap break-words select-text">
                        {disparoOrigem.mensagemEnviada || (
                          <span className="italic text-slate-400">Texto não disponível nos registros de mensagens.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div ref={containerMensagensRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 min-h-0">
                  {carregandoMensagens ? (
                    <div className="text-sm text-gray-500 text-center py-8">Carregando conversa...</div>
                  ) : mensagens.length ? (
                    mensagens.map((mensagem) => {
                      const isSaida = mensagem.direcao === 'saida';
                      const isEntrada = mensagem.direcao === 'entrada';
                      const isNota = !isSaida && !isEntrada;

                      const raw = mensagem.rawPayload || mensagem.raw_payload || {};
                      const statusNorm = String(mensagem.status || '').toLowerCase();
                      const isFailed = statusNorm === 'failed' || statusNorm === 'falhou';
                      const isPendente = statusNorm === 'pendente_envio';

                      const erroMsg = raw.errorMessage || raw.statusUpdate?.errorMessage || raw.error?.message || null;
                      const erroCode = raw.errorCode || raw.statusUpdate?.errorCode || raw.error?.code || null;

                      return (
                        <div
                          key={mensagem.id}
                          className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm shadow-sm transition-all ${
                            isEntrada
                              ? 'bg-white border border-gray-200 text-gray-800 mr-auto'
                              : isNota
                                ? 'bg-amber-50 border border-amber-200 text-amber-900 mx-auto'
                                : isFailed
                                  ? 'bg-rose-50 border border-rose-200 text-rose-950 ml-auto'
                                  : isPendente
                                    ? 'bg-teal-700/80 border border-teal-600/50 text-teal-50 ml-auto opacity-90'
                                    : 'bg-teal-600 text-white ml-auto'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{mensagem.mensagem}</p>

                          {/* Informação de Erro em caso de Falha */}
                          {isFailed && (
                            <div className="mt-2 pt-1.5 border-t border-rose-200/70 text-[11px] text-rose-700 flex items-start gap-1.5 font-medium">
                              <FontAwesomeIcon icon={faCircleExclamation} className="text-rose-500 mt-0.5 shrink-0" />
                              <span>
                                Falha no envio{erroCode ? ` (Erro ${erroCode})` : ''}
                                {erroMsg ? `: ${erroMsg}` : ''}
                              </span>
                            </div>
                          )}

                          {/* Rodapé da Mensagem (Horário, Usuário e Ícone de Status) */}
                          <div className={`text-[11px] mt-1.5 flex items-center justify-end gap-1.5 ${
                            isEntrada
                              ? 'text-gray-400'
                              : isNota
                                ? 'text-amber-700/70'
                                : isFailed
                                  ? 'text-rose-600/80'
                                  : 'text-teal-100/90'
                          }`}>
                            <span>{formatTempo(mensagem.createdAt || mensagem.created_at)}</span>
                            {mensagem.usuario?.nome && <span>· {mensagem.usuario.nome}</span>}

                            {/* Indicadores Visuais de Status para Mensagens de Saída */}
                            {isSaida && (
                              <span className="inline-flex items-center ml-0.5" title={`Status: ${mensagem.status}`}>
                                {isFailed && (
                                  <span className="text-rose-600 font-bold flex items-center gap-1">
                                    <FontAwesomeIcon icon={faCircleExclamation} className="text-[10px]" />
                                    Não entregue
                                  </span>
                                )}
                                {isPendente && (
                                  <FontAwesomeIcon icon={faClock} className="text-[10px] text-teal-200 animate-pulse" title="Pendente de envio" />
                                )}
                                {statusNorm === 'enviada' && (
                                  <FontAwesomeIcon icon={faCheck} className="text-[10px] text-teal-200" title="Enviada ao servidor" />
                                )}
                                {statusNorm === 'sent' && (
                                  <FontAwesomeIcon icon={faCheck} className="text-[10px] text-teal-200" title="Enviada" />
                                )}
                                {statusNorm === 'delivered' && (
                                  <FontAwesomeIcon icon={faCheckDouble} className="text-[10px] text-teal-200" title="Entregue" />
                                )}
                                {statusNorm === 'read' && (
                                  <FontAwesomeIcon icon={faCheckDouble} className="text-[10px] text-emerald-300" title="Lida" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-8">Nenhuma mensagem registrada.</div>
                  )}
                </div>

                <footer className="p-4 border-t space-y-3 shrink-0 bg-white">
                  {/* Alerta de Janela de 24h expirada */}
                  {janelaExpirada && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-sm">
                      <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-600 text-sm shrink-0" />
                        <span>
                          {avisoJanela || 'A janela de 24 horas para mensagens de texto expirou. Para retomar o contato, envie um Modelo de Mensagem (Template).'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          carregarTemplatesOficiais();
                          setModalTemplateAberto(true);
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition shrink-0 flex items-center gap-1.5"
                      >
                        <FontAwesomeIcon icon={faFileSignature} />
                        Enviar Template
                      </button>
                    </div>
                  )}

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
                    <button
                      type="button"
                      onClick={() => {
                        carregarTemplatesOficiais();
                        setModalTemplateAberto(true);
                      }}
                      className="px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1.5 ml-auto"
                    >
                      <FontAwesomeIcon icon={faFileSignature} className="text-teal-600" />
                      Template WhatsApp
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
                    className="w-full bg-teal-600 text-white rounded-lg py-2.5 font-semibold hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2 transition"
                  >
                    <FontAwesomeIcon icon={modoResposta === 'nota' ? faMessage : faPaperPlane} />
                    {modoResposta === 'nota' ? 'Registrar nota' : 'Registrar resposta'}
                  </button>
                </footer>
              </div>
            </div>
          )}

          {/* Modal de Seleção e Envio de Template HSM */}
          {modalTemplateAberto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b flex items-center justify-between bg-teal-900 text-white">
                  <div className="flex items-center gap-2 font-bold text-base">
                    <FontAwesomeIcon icon={faFileSignature} className="text-teal-300" />
                    Enviar Modelo de Mensagem (Template)
                  </div>
                  <button
                    onClick={() => {
                      setModalTemplateAberto(false);
                      setTemplateSelecionado(null);
                    }}
                    className="text-gray-300 hover:text-white transition"
                  >
                    <FontAwesomeIcon icon={faXmark} className="text-lg" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4 text-sm flex-1">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Selecione o Template Homologado</label>
                    {carregandoTemplates ? (
                      <div className="text-xs text-gray-500 py-2">Consultando templates aprovados...</div>
                    ) : templatesDisponiveis.length === 0 ? (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500">
                        Nenhum template aprovado disponível para este provedor.
                      </div>
                    ) : (
                      <select
                        value={templateSelecionado?.id || ''}
                        onChange={(e) => {
                          const sel = templatesDisponiveis.find(t => String(t.id) === String(e.target.value));
                          setTemplateSelecionado(sel || null);
                          setVariaveisTemplate({});
                        }}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                      >
                        {templatesDisponiveis.map((tmpl) => (
                          <option key={tmpl.id} value={tmpl.id}>
                            {tmpl.titulo || tmpl.nome} ({tmpl.nome})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {templateSelecionado && (
                    <div className="p-4 bg-teal-50/50 border border-teal-100 rounded-xl space-y-3">
                      <div className="text-xs font-bold text-teal-900 uppercase tracking-wider flex items-center justify-between">
                        <span>Prévia do Modelo</span>
                        <span className="text-[10px] bg-teal-200 text-teal-800 px-2 py-0.5 rounded font-mono">
                          {templateSelecionado.categoria || 'WHATSAPP'}
                        </span>
                      </div>

                      {templateSelecionado.componentes?.map((comp, idx) => (
                        <div key={idx} className="text-xs text-gray-700 whitespace-pre-wrap font-sans">
                          {comp.type === 'HEADER' && <p className="font-bold text-gray-900 mb-1">{comp.text}</p>}
                          {comp.type === 'BODY' && <p className="leading-relaxed">{comp.text}</p>}
                          {comp.type === 'FOOTER' && <p className="text-[10px] text-gray-400 mt-2 italic">{comp.text}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Campos dinâmicos para variáveis identificadas {{1}}, {{2}}, etc. */}
                  {templateSelecionado && (() => {
                    const bodyComp = templateSelecionado.componentes?.find(c => c.type === 'BODY');
                    const matches = bodyComp?.text ? (bodyComp.text.match(/\{\{(\d+)\}\}/g) || []) : [];
                    if (matches.length === 0) return null;

                    return (
                      <div className="space-y-3 pt-2">
                        <h4 className="text-xs font-bold text-gray-800">Preenchimento de Variáveis</h4>
                        <div className="space-y-2">
                          {matches.map((m, idx) => {
                            const varNum = idx + 1;
                            return (
                              <div key={varNum}>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                                  Variável &#123;&#123;{varNum}&#125;&#125;
                                </label>
                                <input
                                  type="text"
                                  value={variaveisTemplate[varNum] || (varNum === 1 ? (ativa?.contatoNome || '') : '')}
                                  onChange={(e) => setVariaveisTemplate(prev => ({ ...prev, [varNum]: e.target.value }))}
                                  placeholder={`Valor para {{${varNum}}}`}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-teal-500"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="p-4 border-t bg-gray-50 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalTemplateAberto(false);
                      setTemplateSelecionado(null);
                    }}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={enviarTemplateSelecionado}
                    disabled={enviandoTemplate || !templateSelecionado || templatesDisponiveis.length === 0}
                    className="px-5 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {enviandoTemplate ? 'Enviando...' : 'Confirmar e Enviar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
