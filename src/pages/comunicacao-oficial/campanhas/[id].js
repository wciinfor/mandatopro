import { useState, useEffect } from 'react';
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
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons';

export default function DetalhesComunicacaoPage() {
  const router = useRouter();
  const { id } = router.query;

  const [campanha, setCampanha] = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [destinatarios, setDestinatarios] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [buscaDestinatario, setBuscaDestinatario] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [abaAtiva, setAbaAtiva] = useState('destinatarios');

  const [modalConfirmacao, setModalConfirmacao] = useState(false);
  const [disparando, setDisparando] = useState(false);
  const [mensagemFeedback, setMensagemFeedback] = useState(null);

  const carregarDetalhes = async (campanhaId) => {
    try {
      const res = await fetch(`/api/comunicacao-oficial/campanhas/${campanhaId}/detalhes`);
      if (res.ok) {
        const data = await res.json();
        setCampanha(data.campanha || null);
        setMetricas(data.metricas || null);
        setDestinatarios(data.destinatarios || []);
        setTimeline(data.timeline || []);
      }
    } catch (err) {
      console.error('Erro ao carregar detalhes da comunicação:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (id) {
      carregarDetalhes(id);
    }
  }, [id]);

  const destinatariosFiltrados = destinatarios.filter(d => {
    const matchBusca = d.nome.toLowerCase().includes(buscaDestinatario.toLowerCase()) || d.telefone.includes(buscaDestinatario);
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
        carregarDetalhes(id);
      }
    } catch (err) {
      console.error('Erro ao executar ação operacional:', err);
    }
  };

  const handleIniciarDisparo = async () => {
    if (disparando) return;
    setDisparando(true);
    setMensagemFeedback(null);
    setModalConfirmacao(false);

    let totalProcessadosGeral = 0;
    let totalSucessosGeral = 0;
    let totalFalhasGeral = 0;
    let loteNumero = 1;
    let continuar = true;
    const MAX_LOTES_SEGURANCA = 200; // Proteção contra loop infinito (até 10.000 contatos)

    try {
      while (continuar && loteNumero <= MAX_LOTES_SEGURANCA) {
        setMensagemFeedback({
          tipo: 'info',
          texto: `Processando lote ${loteNumero}... (${totalProcessadosGeral} processados até o momento)`
        });

        const res = await fetch('/api/comunicacao-oficial/fila/processar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limite: 50, campaign_id: id })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || `Erro HTTP ${res.status} ao processar lote ${loteNumero}`);
        }

        const data = await res.json();
        const processadosLote = Number(data.processados || 0);
        const sucessosLote = Number(data.sucessos || 0);
        const falhasLote = Number(data.falhas || 0);

        totalProcessadosGeral += processadosLote;
        totalSucessosGeral += sucessosLote;
        totalFalhasGeral += falhasLote;

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
          tipo: 'sucesso',
          texto: `Disparo concluído com sucesso! Total processado: ${totalProcessadosGeral} (${totalSucessosGeral} enviados, ${totalFalhasGeral} falhas).`
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
        texto: `${err.message || 'Falha na comunicação com o servidor de disparos.'} (${totalProcessadosGeral} processados antes da interrupção)`
      });
    } finally {
      setDisparando(false);
      await carregarDetalhes(id);
    }
  };

  const getStatusBadge = (status) => {
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
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full font-semibold">Falha</span>;
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

  if (!campanha) {
    return (
      <ProtectedRoute>
        <Layout titulo="Erro">
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400 border border-gray-100 max-w-md mx-auto mt-10">
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

              {mostrarIniciar && (
                <button
                  onClick={() => setModalConfirmacao(true)}
                  disabled={disparando}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                >
                  <FontAwesomeIcon icon={disparando ? faSpinner : faPaperPlane} className={disparando ? 'animate-spin' : ''} />
                  {disparando ? 'Enviando...' : 'Iniciar Disparo'}
                </button>
              )}

              {(mostrarPausar || mostrarRetomar || mostrarCancelar) && (
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
                      <span className="text-[10px] text-gray-400 block uppercase font-bold">Template Homologado</span>
                      <strong className="font-mono text-teal-700 block truncate">{campanha.template}</strong>
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
                    Esta ação consumirá a fila oficial e enviará mensagens reais para <strong>{metricas?.pendentes ?? metricas?.total ?? 0} destinatários</strong> utilizando o número e provedor destacados acima.
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

            {/* Dashboard Executivo de Disparos - 6 KPIs Independentes */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 lg:col-span-2 space-y-4 shadow-sm">
              <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Métricas de Envio em Lote</h4>
                <span className="bg-teal-50 text-teal-700 text-[10px] font-bold px-2 py-0.5 rounded border border-teal-100">
                  Taxa de conclusão: {metricas?.taxaConclusao}%
                </span>
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
                            <td className="p-4">{getStatusBadge(dest.status)}</td>
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
