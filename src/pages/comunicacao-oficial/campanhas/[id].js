import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faFilter,
  faHistory,
  faCheckCircle,
  faTimesCircle,
  faClock,
  faSpinner,
  faList,
  faPaperPlane,
  faExclamationTriangle,
  faInfoCircle,
  faPause,
  faPlay
} from '@fortawesome/free-solid-svg-icons';

export default function DetalhesComunicacaoPage() {
  const router = useRouter();
  const { id } = router.query;

  const [campanha, setCampanha] = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [destinatarios, setDestinatarios] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState(null);
  const [buscaDestinatario, setBuscaDestinatario] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [abaAtiva, setAbaAtiva] = useState('destinatarios');

  const [modalConfirmacao, setModalConfirmacao] = useState(false);
  const [disparando, setDisparando] = useState(false);
  const [mensagemFeedback, setMensagemFeedback] = useState(null);

  // Detecção da origem da verdade para o provider da campanha (WAFLY)
  const providerCampanha = String(
    campanha?.metadata?.provider || ''
  ).toUpperCase();
  const isWafly = providerCampanha === 'WAFLY';

  // Estados de orquestração sequencial e cadência exclusiva WAFLY
  const [waflyEmExecucao, setWaflyEmExecucao] = useState(false);
  const [waflySegundosRestantes, setWaflySegundosRestantes] = useState(null);
  const [waflyProcessandoItem, setWaflyProcessandoItem] = useState(false);
  const [waflyPausado, setWaflyPausado] = useState(false);

  const waflyPausadoRef = useRef(false);
  const waflyEmExecucaoRef = useRef(false);
  const timerRegressivoRef = useRef(null);
  const desmontadoRef = useRef(false);

  useEffect(() => {
    return () => {
      desmontadoRef.current = true;
      waflyEmExecucaoRef.current = false;
      waflyPausadoRef.current = true;
      if (timerRegressivoRef.current) {
        clearInterval(timerRegressivoRef.current);
        timerRegressivoRef.current = null;
      }
    };
  }, []);

  const carregarDetalhes = async (campanhaId, silencioso = false) => {
    try {
      if (!silencioso) setCarregando(true);
      setErroCarregamento(null);
      const res = await fetch(`/api/comunicacao-oficial/campanhas/${campanhaId}/detalhes`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCampanha(data.campanha || null);
        setMetricas(data.metricas || null);
        setDestinatarios(data.destinatarios || []);
        setTimeline(data.timeline || []);
        return data;
      } else {
        if (!silencioso) setErroCarregamento(data.error || 'Não foi possível carregar as informações desta comunicação oficial.');
      }
    } catch (err) {
      console.error('Erro ao carregar detalhes da comunicação:', err);
      if (!silencioso) setErroCarregamento(err.message || 'Erro de conexão ao carregar a comunicação oficial.');
    } finally {
      if (!silencioso) setCarregando(false);
    }
  };

  useEffect(() => {
    if (id) {
      carregarDetalhes(id);
    }
  }, [id]);

  const destinatariosFiltrados = (destinatarios || []).filter(d => {
    if (!d) return false;
    const nomeStr = String(d.nome || '').toLowerCase();
    const telStr = String(d.telefone || '');
    const buscaStr = String(buscaDestinatario || '').toLowerCase();

    const matchBusca = nomeStr.includes(buscaStr) || telStr.includes(buscaStr);
    const matchStatus = filtroStatus === 'all' || d.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const executarAcao = async (acaoNome) => {
    try {
      const res = await fetch(`/api/comunicacao-oficial/campanhas/${id}/acoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: acaoNome })
      });
      if (res.ok) {
        carregarDetalhes(id, true);
      }
    } catch (err) {
      console.error('Erro ao executar ação operacional:', err);
    }
  };

  const iniciarPollingConsolidação = async (campanhaId) => {
    let tentativas = 0;
    const MAX_TENTATIVAS = 6; // Até 18 segundos de acompanhamento (3s intervalo)

    const interval = setInterval(async () => {
      tentativas++;
      try {
        const res = await fetch(`/api/comunicacao-oficial/campanhas/${campanhaId}/detalhes`);
        if (res.ok) {
          const data = await res.json();
          setCampanha(data.campanha || null);
          setMetricas(data.metricas || null);
          setDestinatarios(data.destinatarios || []);
          setTimeline(data.timeline || []);

          const m = data.metricas || {};
          const processados = m.processados ?? (m.enviadas + m.entregues + m.lidas + m.falhas);
          const total = m.total || 0;

          // Atualiza banner dinamicamente com os dados consolidados do banco pós-webhook
          if (total > 0 && processados >= total) {
            setMensagemFeedback({
              tipo: 'sucesso',
              texto: `Lote processado: ${total} destinatários. Sucesso: ${m.sucessos || 0} (${m.taxaSucesso ?? 0}%) | Falhas: ${m.falhas || 0}`
            });
            clearInterval(interval);
          }
        }
      } catch (e) {
        console.warn('Erro ao atualizar consolidação do lote:', e);
      }

      if (tentativas >= MAX_TENTATIVAS) {
        clearInterval(interval);
      }
    }, 3000);
  };

  // Funções de Cadência e Controle Sequencial WAFLY
  function aguardar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function obterIntervaloWafly(camp) {
    const regras = camp?.metadata?.regras_envio || {};
    const min = typeof regras.intervalo_min === 'number' ? regras.intervalo_min : 20;
    const max = typeof regras.intervalo_max === 'number' ? regras.intervalo_max : 40;
    const minSeg = Math.max(1, Math.min(min, max));
    const maxSeg = Math.max(minSeg, max);

    // Retorna cadência configurada ou randômica segura entre minSeg e maxSeg
    return Math.floor(Math.random() * (maxSeg - minSeg + 1)) + minSeg;
  }

  const aguardarContagemRegressiva = (segundosTotais) => {
    return new Promise((resolve) => {
      let restantes = segundosTotais;
      setWaflySegundosRestantes(restantes);

      if (timerRegressivoRef.current) {
        clearInterval(timerRegressivoRef.current);
      }

      timerRegressivoRef.current = setInterval(() => {
        if (waflyPausadoRef.current || desmontadoRef.current) {
          clearInterval(timerRegressivoRef.current);
          timerRegressivoRef.current = null;
          setWaflySegundosRestantes(null);
          resolve(false);
          return;
        }

        restantes -= 1;
        setWaflySegundosRestantes(restantes);

        if (restantes <= 0) {
          clearInterval(timerRegressivoRef.current);
          timerRegressivoRef.current = null;
          setWaflySegundosRestantes(null);
          resolve(true);
        }
      }, 1000);
    });
  };

  const handlePausarWafly = () => {
    waflyPausadoRef.current = true;
    waflyEmExecucaoRef.current = false;
    setWaflyPausado(true);
    setWaflyEmExecucao(false);
    setDisparando(false);
    setWaflyProcessandoItem(false);

    if (timerRegressivoRef.current) {
      clearInterval(timerRegressivoRef.current);
      timerRegressivoRef.current = null;
    }
    setWaflySegundosRestantes(null);

    setMensagemFeedback({
      tipo: 'info',
      texto: 'Campanha WAFLY pausada pelo usuário. O envio do próximo item foi interrompido.'
    });
  };

  const handleRetomarWafly = () => {
    if (waflyEmExecucaoRef.current) return;
    waflyPausadoRef.current = false;
    setWaflyPausado(false);
    setMensagemFeedback({
      tipo: 'info',
      texto: 'Retomando execução sequencial da campanha WAFLY...'
    });
    executarLoopWafly();
  };

  const executarLoopWafly = async () => {
    if (waflyEmExecucaoRef.current) return;
    waflyEmExecucaoRef.current = true;
    waflyPausadoRef.current = false;
    setWaflyEmExecucao(true);
    setWaflyPausado(false);
    setDisparando(true);

    let totalProcessadosSessao = 0;
    let totalSucessosSessao = 0;
    let totalFalhasSessao = 0;
    let continuar = true;
    const MAX_ITENS_SEGURANCA = 20000;
    let iteracao = 0;

    try {
      while (continuar && iteracao < MAX_ITENS_SEGURANCA) {
        if (waflyPausadoRef.current || desmontadoRef.current) {
          break;
        }

        iteracao++;
        setWaflyProcessandoItem(true);
        setWaflySegundosRestantes(null);

        // 1. Processa estritamente 1 item via POST /api/comunicacao-oficial/fila/processar
        let data = null;
        let tentativa = 1;
        const MAX_TENTATIVAS_ITEM = 3;

        while (tentativa <= MAX_TENTATIVAS_ITEM) {
          if (waflyPausadoRef.current || desmontadoRef.current) break;

          try {
            const res = await fetch('/api/comunicacao-oficial/fila/processar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ limite: 1, campaign_id: id })
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData?.error || `Erro HTTP ${res.status}`);
            }

            data = await res.json();
            break;
          } catch (fetchErr) {
            console.warn(`[WAFLY Item ${iteracao}] Tentativa ${tentativa}/${MAX_TENTATIVAS_ITEM} falhou:`, fetchErr.message);
            if (tentativa >= MAX_TENTATIVAS_ITEM) {
              setMensagemFeedback({
                tipo: 'erro',
                texto: `Falha na requisição de envio: ${fetchErr.message}`
              });
              break;
            }
            await aguardar(2000);
            tentativa++;
          }
        }

        setWaflyProcessandoItem(false);

        if (waflyPausadoRef.current || desmontadoRef.current) break;

        const processadosItem = Number(data?.processados || 0);
        const sucessosItem = Number(data?.sucessos || 0);
        const falhasItem = Number(data?.falhas || 0);

        totalProcessadosSessao += processadosItem;
        totalSucessosSessao += sucessosItem;
        totalFalhasSessao += falhasItem;

        // Atualização incremental de dados na tela (silencioso para não piscar a tela inteira)
        const detalhesAtualizados = await carregarDetalhes(id, true).catch(() => null);
        const campAtual = detalhesAtualizados?.campanha || campanha;

        // Se o lote retornou 0 itens processados, a fila da campanha terminou
        if (processadosItem === 0) {
          continuar = false;
          setMensagemFeedback({
            tipo: 'sucesso',
            texto: totalProcessadosSessao > 0 
              ? `Campanha concluída com sucesso! Total processado nesta sessão: ${totalProcessadosSessao} (Sucessos: ${totalSucessosSessao} | Falhas: ${totalFalhasSessao}).`
              : 'Nenhum item pendente para processamento nesta campanha.'
          });
          break;
        }

        // Antes do próximo item, aplica a cadência configurada (20 a 40 segundos) com contador regressivo
        const segundosEspera = obterIntervaloWafly(campAtual);
        const concluiuEspera = await aguardarContagemRegressiva(segundosEspera);

        if (!concluiuEspera || waflyPausadoRef.current || desmontadoRef.current) {
          break;
        }
      }
    } catch (err) {
      console.error('Erro na orquestração sequencial WAFLY:', err);
      setMensagemFeedback({
        tipo: 'erro',
        texto: `Erro no loop de envio WAFLY: ${err.message}`
      });
    } finally {
      setWaflyProcessandoItem(false);
      setWaflySegundosRestantes(null);

      if (!waflyPausadoRef.current) {
        waflyEmExecucaoRef.current = false;
        setWaflyEmExecucao(false);
        setDisparando(false);
      } else {
        setDisparando(false);
      }

      await carregarDetalhes(id, true).catch(() => {});
    }
  };

  const executarLoopMetaYcloud = async () => {
    let totalProcessadosGeral = 0;
    let totalSucessosGeral = 0;
    let totalFalhasGeral = 0;
    let loteNumero = 1;
    let continuar = true;
    const MAX_LOTES_SEGURANCA = 200; // Proteção contra loop infinito
    const LIMITE_POR_LOTE = 25;

    try {
      while (continuar && loteNumero <= MAX_LOTES_SEGURANCA) {
        setMensagemFeedback({
          tipo: 'info',
          texto: `Processando lote ${loteNumero}... (${totalProcessadosGeral} enviados até o momento)`
        });

        // Função de envio com retry resiliente (até 3 tentativas por lote)
        let data = null;
        let tentativa = 1;
        const MAX_TENTATIVAS_LOTE = 3;

        while (tentativa <= MAX_TENTATIVAS_LOTE) {
          try {
            const res = await fetch('/api/comunicacao-oficial/fila/processar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ limite: LIMITE_POR_LOTE, campaign_id: id })
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData?.error || `Erro HTTP ${res.status}`);
            }

            data = await res.json();
            break; // Sucesso na requisição
          } catch (fetchErr) {
            console.warn(`[Lote ${loteNumero}] Tentativa ${tentativa}/${MAX_TENTATIVAS_LOTE} falhou:`, fetchErr.message);
            if (tentativa >= MAX_TENTATIVAS_LOTE) {
              throw fetchErr;
            }
            // Aguarda 1.5s antes de retentar o lote
            await new Promise(resolve => setTimeout(resolve, 1500));
            tentativa++;
          }
        }

        const processadosLote = Number(data?.processados || 0);
        const sucessosLote = Number(data?.sucessos || 0);
        const falhasLote = Number(data?.falhas || 0);

        totalProcessadosGeral += processadosLote;
        totalSucessosGeral += sucessosLote;
        totalFalhasGeral += falhasLote;

        // Atualização incremental de dados na tela entre lotes
        await carregarDetalhes(id, true).catch(() => {});

        // Se o lote retornou 0 itens processados, a fila da campanha terminou
        if (processadosLote === 0) {
          continuar = false;
        } else {
          loteNumero++;
          // Pequena pausa de 300ms entre lotes para estabilidade
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      if (totalProcessadosGeral > 0) {
        setMensagemFeedback({
          tipo: 'info',
          texto: `Processamento concluído (${totalProcessadosGeral} contatos processados). Consolidando status...`
        });
      } else {
        setMensagemFeedback({
          tipo: 'info',
          texto: 'Nenhum item pendente para processamento nesta campanha.'
        });
      }
    } catch (err) {
      console.error('Erro ao acionar processamento contínuo da fila:', err);
      setMensagemFeedback({
        tipo: 'erro',
        texto: `${err.message || 'Falha na comunicação com o servidor de disparos.'} (${totalProcessadosGeral} processados nesta sessão)`
      });
    } finally {
      setDisparando(false);
      await carregarDetalhes(id, true);
      if (totalProcessadosGeral > 0) {
        iniciarPollingConsolidação(id);
      }
    }
  };

  const handleIniciarDisparo = async () => {
    if (disparando || waflyEmExecucaoRef.current) return;
    setDisparando(true);
    setMensagemFeedback(null);
    setModalConfirmacao(false);

    if (isWafly) {
      await executarLoopWafly();
    } else {
      await executarLoopMetaYcloud();
    }
  };

  const [itemErroSelecionado, setItemErroSelecionado] = useState(null);

  const getStatusBadge = (destinatarioOuStatus) => {
    let status = destinatarioOuStatus;
    let itemObj = null;
    if (typeof destinatarioOuStatus === 'object' && destinatarioOuStatus !== null) {
      status = destinatarioOuStatus.status;
      itemObj = destinatarioOuStatus;
    }

    switch (status) {
      case 'pendente':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full">Pendente</span>;
      case 'Na Fila':
      case 'agendado':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full">Na Fila</span>;
      case 'Executando':
      case 'processando':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">Processando</span>;
      case 'Pausada':
        return <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">Pausada</span>;
      case 'concluido':
      case 'enviado':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full font-semibold">Enviado</span>;
      case 'entregue':
        return <span className="bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold px-2 py-0.5 rounded-full font-semibold">Entregue</span>;
      case 'lido':
      case 'lida':
        return <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-full font-semibold">Lido</span>;
      case 'Cancelada':
      case 'cancelado':
        return <span className="bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-bold px-2 py-0.5 rounded-full font-semibold">Cancelado</span>;
      case 'falha':
      case 'falhou':
        return (
          <button
            type="button"
            onClick={() => itemObj && setItemErroSelecionado(itemObj)}
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 transition shadow-2xs group cursor-pointer"
            title="Clique para ver o motivo da falha retornado pela Meta"
          >
            <span>Falha</span>
            <FontAwesomeIcon icon={faInfoCircle} className="text-[9px] text-rose-500 group-hover:scale-110 transition" />
          </button>
        );
      default:
        return <span className="bg-gray-50 text-gray-600 border border-gray-200 text-[10px] font-bold px-2 py-0.5 rounded-full">{status}</span>;
    }
  };

  if (carregando) {
    return (
      <ProtectedRoute>
        <Layout titulo="Carregando Detalhes...">
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-3xl text-teal-600 mb-3" />
            <p className="text-sm">Carregando painel de acompanhamento...</p>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (erroCarregamento) {
    return (
      <ProtectedRoute>
        <Layout titulo="Erro no Carregamento">
          <div className="bg-white rounded-2xl p-6 text-center text-rose-600 border border-rose-100 max-w-md mx-auto mt-10 space-y-3 shadow-sm">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl text-rose-500" />
            <p className="text-sm font-bold text-gray-800">Falha ao Carregar a Comunicação Oficial</p>
            <p className="text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200">{erroCarregamento}</p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => id && carregarDetalhes(id)}
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-2 px-4 rounded-xl transition"
              >
                Tentar Novamente
              </button>
              <button
                onClick={() => router.push('/comunicacao-oficial/campanhas')}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2 px-4 rounded-xl transition"
              >
                Voltar para Comunicações
              </button>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!campanha) {
    return (
      <ProtectedRoute>
        <Layout titulo="Erro">
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400 border border-gray-100 max-w-md mx-auto mt-10 space-y-3">
            <p className="text-sm font-semibold">Comunicação Oficial não localizada ou erro de permissão.</p>
            <button
              onClick={() => router.push('/comunicacao-oficial/campanhas')}
              className="mt-4 bg-teal-600 text-white text-xs font-bold py-2 px-4 rounded-xl"
            >
              Voltar para Comunicações
            </button>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  const mostrarIniciar = ['Na Fila', 'agendado'].includes(campanha.status);
  const mostrarPausar = ['Na Fila', 'Executando', 'processando'].includes(campanha.status);
  const mostrarRetomar = campanha.status === 'Pausada';
  const mostrarCancelar = ['Na Fila', 'Executando', 'processando', 'Pausada'].includes(campanha.status);

  return (
    <ProtectedRoute>
      <Layout titulo={`Acompanhamento: ${campanha.nome}`}>
        <div className="space-y-6">
          
          {/* Header e Ações */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm gap-4">
            <button
              onClick={() => router.push('/comunicacao-oficial/campanhas')}
              className="text-gray-500 hover:text-teal-600 font-bold flex items-center gap-1.5 text-xs self-start sm:self-auto"
            >
              <FontAwesomeIcon icon={faArrowLeft} /> Voltar para Comunicações
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">Status da Fila:</span>
                {getStatusBadge(campanha.status)}
              </div>

              {mostrarIniciar && !waflyEmExecucao && !waflyPausado && (
                <button
                  onClick={() => setModalConfirmacao(true)}
                  disabled={disparando}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                >
                  <FontAwesomeIcon icon={disparando ? faSpinner : faPaperPlane} className={disparando ? 'animate-spin' : ''} />
                  {disparando ? 'Enviando...' : 'Iniciar Disparo'}
                </button>
              )}

              {isWafly && waflyEmExecucao && !waflyPausado && (
                <button
                  onClick={handlePausarWafly}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                >
                  <FontAwesomeIcon icon={faPause} />
                  Pausar Campanha
                </button>
              )}

              {isWafly && waflyPausado && (
                <button
                  onClick={handleRetomarWafly}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                >
                  <FontAwesomeIcon icon={faPlay} />
                  Retomar Campanha
                </button>
              )}

              {!isWafly && (mostrarPausar || mostrarRetomar || mostrarCancelar) && (
                <div className="flex items-center gap-2 border-l border-gray-100 pl-3">
                  {mostrarPausar && (
                    <button
                      onClick={() => executarAcao('pausar')}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-200 transition"
                    >
                      Pausar
                    </button>
                  )}
                  {mostrarRetomar && (
                    <button
                      onClick={() => executarAcao('retomar')}
                      className="bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-teal-200 transition"
                    >
                      Retomar
                    </button>
                  )}
                  {mostrarCancelar && (
                    <button
                      onClick={() => executarAcao('cancelar')}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-rose-200 transition"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Banner de Feedback Operacional */}
          {mensagemFeedback && (
            <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between shadow-xs ${
              mensagemFeedback.tipo === 'sucesso'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : mensagemFeedback.tipo === 'erro'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={
                  mensagemFeedback.tipo === 'sucesso'
                    ? faCheckCircle
                    : mensagemFeedback.tipo === 'erro'
                    ? faTimesCircle
                    : faInfoCircle
                } />
                <span className="font-semibold">{mensagemFeedback.texto}</span>
              </div>
              <button
                onClick={() => setMensagemFeedback(null)}
                className="text-gray-400 hover:text-gray-600 font-bold ml-4"
              >
                ✕
              </button>
            </div>
          )}

          {/* Painel de Execução Sequencial e Cadência WAFLY */}
          {isWafly && (waflyEmExecucao || waflyPausado) && (
            <div className={`p-4 rounded-2xl border shadow-xs transition-all ${
              waflyPausado 
                ? 'bg-amber-50/90 border-amber-300 text-amber-900' 
                : 'bg-teal-50/90 border-teal-300 text-teal-900'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${
                      waflyPausado ? 'bg-amber-500' : 'bg-teal-500 animate-pulse'
                    }`} />
                    <h4 className="font-extrabold text-sm">
                      {waflyPausado ? 'Campanha WAFLY Pausada' : 'Campanha WAFLY em Execução'}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 border border-current">
                      {waflyPausado ? 'Pausada' : 'Processando mensagens sequencialmente'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {waflyPausado ? (
                      'O envio automático foi pausado. Clique em "Retomar Campanha" para continuar de onde parou.'
                    ) : waflyProcessandoItem ? (
                      <span className="font-semibold text-teal-800 flex items-center gap-1.5">
                        <FontAwesomeIcon icon={faSpinner} spin />
                        Processando mensagem unitária com o provedor WAFLY...
                      </span>
                    ) : waflySegundosRestantes !== null ? (
                      <span>
                        Processando mensagens sequencialmente · <strong className="text-teal-900">Próximo processamento em {waflySegundosRestantes} segundos</strong> (cadência anti-bloqueio)
                      </span>
                    ) : (
                      'Aguardando próximo ciclo...'
                    )}
                  </p>
                </div>

                {/* Métricas do Painel WAFLY */}
                <div className="flex items-center gap-3">
                  <div className="bg-white/90 px-3 py-1.5 rounded-xl border border-gray-200 text-center">
                    <span className="text-[9px] uppercase font-bold text-gray-400 block">Enviados</span>
                    <span className="text-xs font-extrabold text-emerald-700">
                      {metricas?.enviadas || campanha?.total_enviadas || 0}
                    </span>
                  </div>
                  <div className="bg-white/90 px-3 py-1.5 rounded-xl border border-gray-200 text-center">
                    <span className="text-[9px] uppercase font-bold text-gray-400 block">Falhas</span>
                    <span className="text-xs font-extrabold text-rose-700">
                      {metricas?.falhas || campanha?.total_falhas || 0}
                    </span>
                  </div>
                  <div className="bg-white/90 px-3 py-1.5 rounded-xl border border-gray-200 text-center">
                    <span className="text-[9px] uppercase font-bold text-gray-400 block">Restantes</span>
                    <span className="text-xs font-extrabold text-blue-700">
                      {Math.max(0, (metricas?.pendentes ?? ((campanha?.total_destinatarios || 0) - ((campanha?.total_enviadas || 0) + (campanha?.total_falhas || 0)))))}
                    </span>
                  </div>

                  {/* Ações Rápidas no Painel */}
                  {waflyEmExecucao && !waflyPausado && (
                    <button
                      onClick={handlePausarWafly}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5"
                    >
                      <FontAwesomeIcon icon={faPause} />
                      Pausar Campanha
                    </button>
                  )}
                  {waflyPausado && (
                    <button
                      onClick={handleRetomarWafly}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5"
                    >
                      <FontAwesomeIcon icon={faPlay} />
                      Retomar Campanha
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modal de Confirmação para Iniciar Disparo Oficial */}
          {modalConfirmacao && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in duration-150">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shrink-0">
                    <FontAwesomeIcon icon={faPaperPlane} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm">Confirmar Início do Disparo Oficial</h3>
                    <p className="text-[11px] text-gray-400">Verifique os parâmetros e o canal de transmissão antes de executar</p>
                  </div>
                </div>

                {/* Destaque Crítico: Provider e Número de Origem */}
                <div className="p-3.5 bg-teal-50/70 border-2 border-teal-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-teal-800">Provedor Oficial Configurado</span>
                    <span className="text-[11px] font-extrabold text-teal-800 bg-white px-2 py-0.5 rounded border border-teal-200 flex items-center gap-1 shadow-2xs">
                      <FontAwesomeIcon icon={faCheckCircle} className="text-teal-600" /> {campanha.provider || 'WhatsApp Oficial'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-teal-200/60 pt-2">
                    <span className="text-[10px] uppercase font-bold text-teal-800">Número de Origem da Linha</span>
                    <span className="font-mono text-sm font-extrabold text-teal-950 bg-white px-2.5 py-0.5 rounded-lg border border-teal-200 shadow-2xs">
                      {campanha.numeroOrigem || '+55 91 8088-6129'}
                    </span>
                  </div>
                </div>

                {/* Dados da Comunicação */}
                <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3.5 space-y-2 text-xs text-gray-700">
                  <div className="grid grid-cols-2 gap-2 pb-2 border-b border-gray-200/60">
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase font-bold">Comunicação</span>
                      <strong className="text-gray-900 truncate block">{campanha.nome}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase font-bold">Origem do Público</span>
                      <strong className="text-gray-900 truncate block">{campanha.origem}</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase font-bold">
                        {isWafly ? 'Tipo de Mensagem' : 'Template Homologado'}
                      </span>
                      <strong className="font-mono text-teal-700 block truncate">
                        {isWafly ? 'Variações Livres WAFLY' : (campanha.template || 'Template Oficial')}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase font-bold">Destinatários Pendentes</span>
                      <strong className="text-emerald-700 text-sm font-extrabold block">
                        {metricas?.pendentes ?? metricas?.total ?? 0} <span className="text-[10px] font-normal text-gray-500">contatos</span>
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Aviso Operacional da Fila */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] flex items-start gap-2.5">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="mt-0.5 text-amber-600 shrink-0" />
                  <p className="leading-relaxed">
                    {isWafly ? (
                      <>
                        Esta ação processará a fila <strong>sequencialmente (1 item por vez)</strong> com intervalo de segurança de <strong>20 a 40 segundos</strong> entre os envios, protegendo a linha contra bloqueios.
                      </>
                    ) : (
                      <>
                        Esta ação consumirá a fila oficial e enviará mensagens reais para <strong>{metricas?.pendentes ?? metricas?.total ?? 0} destinatários</strong> utilizando o número e provedor destacados acima.
                      </>
                    )}
                  </p>
                </div>

                {/* Ações */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setModalConfirmacao(false)}
                    disabled={disparando}
                    className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleIniciarDisparo}
                    disabled={disparando}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-2 shadow-sm"
                  >
                    {disparando ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin />
                        Processando Disparos...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faPaperPlane} />
                        Confirmar e Iniciar Disparo
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Detalhes da Falha Retornada pela Meta */}
          {itemErroSelecionado && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-rose-100 space-y-4 animate-in fade-in zoom-in duration-150">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-lg shrink-0">
                      <FontAwesomeIcon icon={faExclamationTriangle} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm">Detalhes da Falha no Envio</h3>
                      <p className="text-[11px] text-gray-400">Resposta oficial de erro retornada pela Meta Cloud API</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setItemErroSelecionado(null)}
                    className="text-gray-400 hover:text-gray-600 font-bold p-1"
                  >
                    ✕
                  </button>
                </div>

                {/* Destinatário */}
                <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase font-bold">Destinatário</span>
                    <strong className="text-gray-900 font-bold">{itemErroSelecionado.nome}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block uppercase font-bold">Telefone</span>
                    <span className="font-mono text-gray-700 font-bold">{itemErroSelecionado.telefone}</span>
                  </div>
                </div>

                {/* Bloco de Destaque da Meta API */}
                <div className="bg-rose-50/70 border-2 border-rose-200 rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-rose-800">Código do Erro Meta</span>
                    <span className="font-mono font-extrabold text-rose-900 bg-white px-2.5 py-0.5 rounded border border-rose-200">
                      {itemErroSelecionado.error_code || itemErroSelecionado.erro_detalhes?.errorCode || '—'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-rose-200/60">
                    <span className="text-[10px] uppercase font-bold text-rose-800 block">Mensagem Retornada pela Meta</span>
                    <p className="font-mono text-[11px] text-rose-950 font-semibold mt-1 bg-white p-2.5 rounded border border-rose-200 leading-relaxed">
                      {itemErroSelecionado.error_message || itemErroSelecionado.erro_detalhes?.errorMessage || 'Falha de transmissão na API.'}
                    </p>
                  </div>
                </div>

                {/* Classificação Amigável em Português */}
                {itemErroSelecionado.erro_detalhes?.classificacaoAmigavel && (
                  <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-blue-700 block">Classificação Operacional</span>
                    <strong className="block font-bold text-blue-950">
                      {itemErroSelecionado.erro_detalhes.classificacaoAmigavel}
                    </strong>
                    {itemErroSelecionado.erro_detalhes.descricaoAmigavel && (
                      <p className="text-[11px] text-blue-800 mt-1 leading-relaxed">
                        {itemErroSelecionado.erro_detalhes.descricaoAmigavel}
                      </p>
                    )}
                  </div>
                )}

                {/* Rodapé do Modal */}
                <div className="flex items-center justify-end pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setItemErroSelecionado(null)}
                    className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold px-5 py-2 rounded-xl transition shadow-xs"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Grid de Metadados e Dashboard Executivo */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Informações da Comunicação (Ficha Executiva) */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 lg:col-span-1 shadow-sm">
              <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Ficha da Comunicação</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                  {campanha.canal === 'whatsapp' ? 'WhatsApp Oficial' : campanha.canal}
                </span>
              </div>
              
              <div className="space-y-3 text-xs text-gray-600">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Nome do Disparo</span>
                  <p className="font-bold text-gray-800 mt-0.5">{campanha.nome}</p>
                </div>

                {/* Bloco de Destaque: Provedor e Número de Origem */}
                <div className="p-3 bg-gray-50 border border-gray-200/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Provedor Oficial</span>
                    <span className="text-[10px] font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 flex items-center gap-1">
                      <FontAwesomeIcon icon={faCheckCircle} /> {campanha.provider || 'Meta Cloud API'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-200/60 pt-1.5">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Número de Origem</span>
                    <span className="font-mono text-xs font-extrabold text-gray-800">
                      {campanha.numeroOrigem || '+55 91 8088-6129'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Origem do Público</span>
                    <p className="font-semibold text-gray-800 mt-0.5">{campanha.origem}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Template Homologado</span>
                    <p className="font-mono text-xs font-bold text-teal-700 mt-0.5">{campanha.template}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Destinatários</span>
                    <p className="font-bold text-gray-800 mt-0.5">{metricas?.total || 0} contatos</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Data de Criação</span>
                    <p className="text-[11px] text-gray-600 mt-0.5">{new Date(campanha.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                </div>

                {campanha.agendamento && (
                  <div className="pt-2 border-t border-gray-100">
                    <span className="text-[10px] uppercase font-bold text-amber-700 block">Agendado para</span>
                    <p className="font-bold text-amber-800 mt-0.5">{new Date(campanha.agendamento).toLocaleString('pt-BR')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Dashboard Executivo de Disparos - 6 KPIs Independentes + Progresso e Taxa de Sucesso */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 lg:col-span-2 space-y-4 shadow-sm">
              <div className="border-b border-gray-100 pb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Métricas de Envio em Lote</h4>
                <div className="flex items-center gap-2">
                  <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-100">
                    Progresso do Lote: {metricas?.taxaProgresso ?? metricas?.taxaConclusao ?? 0}%
                  </span>
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-100">
                    Taxa de Sucesso: {metricas?.taxaSucesso ?? 0}%
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* 1. Total */}
                <div className="bg-gray-50 border border-gray-200/80 p-3.5 rounded-xl text-center shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block">Total</span>
                  <p className="text-2xl font-extrabold text-gray-800 mt-0.5">{metricas?.total || 0}</p>
                  <span className="text-[10px] text-gray-400 block mt-0.5">destinatários</span>
                </div>

                {/* 2. Pendentes */}
                <div className="bg-blue-50/60 border border-blue-200/80 p-3.5 rounded-xl text-center shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-blue-600 block">Pendentes</span>
                  <p className="text-2xl font-extrabold text-blue-800 mt-0.5">{metricas?.pendentes || 0}</p>
                  <span className="text-[10px] text-blue-500 block mt-0.5">na fila oficial</span>
                </div>

                {/* 3. Enviadas */}
                <div className="bg-emerald-50/60 border border-emerald-200/80 p-3.5 rounded-xl text-center shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Enviadas</span>
                  <p className="text-2xl font-extrabold text-emerald-800 mt-0.5">{metricas?.enviadas || 0}</p>
                  <span className="text-[10px] text-emerald-500 block mt-0.5">aceitas na Meta</span>
                </div>

                {/* 4. Entregues */}
                <div className="bg-teal-50/60 border border-teal-200/80 p-3.5 rounded-xl text-center shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-teal-600 block">Entregues</span>
                  <p className="text-2xl font-extrabold text-teal-800 mt-0.5">{metricas?.entregues || 0}</p>
                  <span className="text-[10px] text-teal-500 block mt-0.5">no aparelho</span>
                </div>

                {/* 5. Lidas */}
                <div className="bg-indigo-50/60 border border-indigo-200/80 p-3.5 rounded-xl text-center shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-indigo-600 block">Lidas</span>
                  <p className="text-2xl font-extrabold text-indigo-800 mt-0.5">{metricas?.lidas || 0}</p>
                  <span className="text-[10px] text-indigo-500 block mt-0.5">pelo contato</span>
                </div>

                {/* 6. Falhas */}
                <div className="bg-rose-50/70 border border-rose-200 p-3.5 rounded-xl text-center shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-rose-600 block">Falhas</span>
                  <p className="text-2xl font-extrabold text-rose-800 mt-0.5">{metricas?.falhas || 0}</p>
                  <span className="text-[10px] text-rose-500 block mt-0.5">com erro</span>
                </div>
              </div>
            </div>
          </div>

          {/* Abas e Seções de Detalhes (Lista de contatos e Timeline de Auditoria) */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="flex border-b border-gray-100 bg-gray-50/30 px-5 pt-3 gap-4">
              <button
                onClick={() => setAbaAtiva('destinatarios')}
                className={`pb-3 text-xs font-bold transition-all border-b-2 ${
                  abaAtiva === 'destinatarios'
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Fila de Destinatários
              </button>
              <button
                onClick={() => setAbaAtiva('timeline')}
                className={`pb-3 text-xs font-bold transition-all border-b-2 ${
                  abaAtiva === 'timeline'
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Timeline de Auditoria
              </button>
            </div>

            {abaAtiva === 'destinatarios' ? (
              <div className="space-y-0">
                <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faList} className="text-teal-600 text-sm" />
                    <h4 className="font-bold text-xs text-gray-800 font-medium">Contatos da Transmissão</h4>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <input
                      type="text"
                      value={buscaDestinatario}
                      onChange={(e) => setBuscaDestinatario(e.target.value)}
                      placeholder="Buscar destinatário..."
                      className="px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none"
                    />
                    <select
                      value={filtroStatus}
                      onChange={(e) => setFiltroStatus(e.target.value)}
                      className="bg-white border border-gray-200 rounded-lg p-1.5 focus:outline-none"
                    >
                      <option value="all">Todos os Status</option>
                      <option value="pendente">Pendente</option>
                      <option value="processando">Processando</option>
                      <option value="enviado">Enviado</option>
                      <option value="falha">Falha</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-400 font-bold uppercase tracking-wider text-[10px] border-b border-gray-100">
                        <th className="p-4">Nome</th>
                        <th className="p-4">Telefone</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Data/Hora Processamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {destinatariosFiltrados.length > 0 ? (
                        destinatariosFiltrados.map((dest) => (
                          <tr key={dest.id} className="hover:bg-gray-50/50">
                            <td className="p-4 font-bold text-gray-800">{dest.nome}</td>
                            <td className="p-4 text-gray-600">{dest.telefone}</td>
                            <td className="p-4">{getStatusBadge(dest)}</td>
                            <td className="p-4 text-gray-400">
                              {dest.processado_em ? new Date(dest.processado_em).toLocaleString('pt-BR') : '—'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="text-center py-8 text-gray-400">
                            Nenhum destinatário localizado com os critérios informados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-6 max-w-2xl">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                  <FontAwesomeIcon icon={faHistory} className="text-teal-600 text-sm" />
                  <h4 className="font-bold text-xs text-gray-800 font-medium">Timeline de Rastreabilidade e Auditoria</h4>
                </div>
                {timeline.length > 0 ? (
                  <div className="relative border-l border-gray-200 ml-3 pl-6 space-y-6">
                    {timeline.map((evt, idx) => (
                      <div key={idx} className="relative">
                        <span className="absolute -left-[30px] top-1 bg-white border-2 border-teal-500 rounded-full w-4 h-4 flex items-center justify-center">
                          <span className="w-1.5 h-1.5 bg-teal-600 rounded-full"></span>
                        </span>
                        <div className="text-xs text-gray-400 font-semibold">
                          {new Date(evt.timestamp).toLocaleString('pt-BR')} · <span className="text-teal-600 font-bold">{evt.operador || 'Operador'}</span>
                        </div>
                        <div className="font-bold text-xs text-gray-800 mt-1 uppercase tracking-wider">{evt.tipo}</div>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{evt.descricao}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-8 text-xs text-gray-400">
                    Nenhum registro de auditoria disponível na timeline para esta comunicação.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
