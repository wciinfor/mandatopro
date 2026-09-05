import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartPie,
  faChartLine,
  faChartColumn,
  faFilter,
  faRotateRight,
  faInbox,
  faHeadset,
  faCheck,
  faUserCheck,
  faBullhorn,
  faComments,
  faClock,
  faTriangleExclamation,
  faCircleCheck,
  faArrowLeft,
  faPaperPlane,
  faFileLines,
  faFileExcel,
  faFilePdf,
  faTable,
  faDownload
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { MODULES } from '@/utils/permissions';

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os Status' },
  { value: 'nova', label: 'Novas Respostas' },
  { value: 'em_atendimento', label: 'Em Atendimento' },
  { value: 'aguardando_eleitor', label: 'Aguardando Eleitor' },
  { value: 'resolver_depois', label: 'Resolver Depois' },
  { value: 'concluida', label: 'Concluídas' }
];

const METODO_OPTIONS = [
  { value: 'todos', label: 'Todos os Métodos' },
  { value: 'temporal_recente', label: 'Disparo Recente (temporal_recente)' },
  { value: 'direto_quote', label: 'Citação Direta (direto_quote)' },
  { value: 'sem_campanha', label: 'Sem Campanha / Orgânico' }
];

const PROVIDER_OPTIONS = [
  { value: 'todos', label: 'Todos os Providers' },
  { value: 'META', label: 'Meta Cloud API Oficial' },
  { value: 'WABLAST', label: 'WhatsApp WaBlast Oficial' },
  { value: 'YCLOUD', label: 'WhatsApp YCloud' }
];

export default function RelatoriosAtendimentoConnect() {
  // Filtros de seleção
  const [atalhoPeriodo, setAtalhoPeriodo] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [campanhaId, setCampanhaId] = useState('todos');
  const [status, setStatus] = useState('todos');
  const [operadorId, setOperadorId] = useState('todos');
  const [metodoAtribuicao, setMetodoAtribuicao] = useState('todos');
  const [provider, setProvider] = useState('todos');

  // Dados e estados de requisição
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(null);

  // Lista cumulativa de opções disponíveis populada a partir dos dados do tenant
  const [opcoesFiltros, setOpcoesFiltros] = useState({
    campanhas: [],
    operadores: []
  });

  // Função para aplicar atalhos de data
  const aplicarAtalhoPeriodo = (tipo) => {
    setAtalhoPeriodo(tipo);
    const hoje = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);

    if (tipo === 'todos') {
      setDataInicio('');
      setDataFim('');
    } else if (tipo === 'hoje') {
      setDataInicio(fmt(hoje));
      setDataFim(fmt(hoje));
    } else if (tipo === '7dias') {
      const d = new Date(hoje);
      d.setDate(d.getDate() - 6);
      setDataInicio(fmt(d));
      setDataFim(fmt(hoje));
    } else if (tipo === '30dias') {
      const d = new Date(hoje);
      d.setDate(d.getDate() - 29);
      setDataInicio(fmt(d));
      setDataFim(fmt(hoje));
    } else if (tipo === 'mes_atual') {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      setDataInicio(fmt(inicio));
      setDataFim(fmt(fim));
    }
  };

  // Carregar dados da API
  const carregarRelatorio = useCallback(async () => {
    setLoading(true);
    setErro('');

    try {
      const params = new URLSearchParams();
      if (dataInicio) params.set('dataInicio', dataInicio);
      if (dataFim) params.set('dataFim', dataFim);
      if (campanhaId && campanhaId !== 'todos') params.set('campanhaId', campanhaId);
      if (status && status !== 'todos') params.set('status', status);
      if (operadorId && operadorId !== 'todos') params.set('operadorId', operadorId);
      if (metodoAtribuicao && metodoAtribuicao !== 'todos') params.set('metodoAtribuicao', metodoAtribuicao);
      if (provider && provider !== 'todos') params.set('provider', provider);

      const response = await fetch(`/api/atendimento-connect/relatorios?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload?.message || 'Erro ao carregar relatório');
      }

      setDados(payload.data);

      // Popula selects de campanhas e operadores mantendo o histórico de opções
      if (payload.data?.campanhas?.length) {
        setOpcoesFiltros(prev => {
          const mapaC = new Map(prev.campanhas.map(c => [c.campaignId, c]));
          payload.data.campanhas.forEach(c => mapaC.set(c.campaignId, c));
          return { ...prev, campanhas: Array.from(mapaC.values()) };
        });
      }

      if (payload.data?.operadores?.length) {
        setOpcoesFiltros(prev => {
          const mapaO = new Map(prev.operadores.map(o => [o.operadorId, o]));
          payload.data.operadores.forEach(o => mapaO.set(o.operadorId, o));
          return { ...prev, operadores: Array.from(mapaO.values()) };
        });
      }
    } catch (err) {
      setErro(err.message || 'Falha na conexão com os relatórios');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, campanhaId, status, operadorId, metodoAtribuicao, provider]);

  // Carrega ao montar e a cada alteração de filtro
  useEffect(() => {
    carregarRelatorio();
  }, [carregarRelatorio]);

  const limparFiltros = () => {
    setAtalhoPeriodo('todos');
    setDataInicio('');
    setDataFim('');
    setCampanhaId('todos');
    setStatus('todos');
    setOperadorId('todos');
    setMetodoAtribuicao('todos');
    setProvider('todos');
  };

  const temFiltroAtivo = useMemo(() => {
    return (
      atalhoPeriodo !== 'todos' ||
      dataInicio ||
      dataFim ||
      campanhaId !== 'todos' ||
      status !== 'todos' ||
      operadorId !== 'todos' ||
      metodoAtribuicao !== 'todos' ||
      provider !== 'todos'
    );
  }, [atalhoPeriodo, dataInicio, dataFim, campanhaId, status, operadorId, metodoAtribuicao, provider]);

  const [abaAtiva, setAbaAtiva] = useState('atendimento');

  const resumo = dados?.resumoAtendimento || {
    totalConversas: 0,
    novas: 0,
    emAtendimento: 0,
    aguardandoEleitor: 0,
    resolverDepois: 0,
    concluidas: 0,
    semResponsavel: 0,
    comCampanha: 0,
    semCampanha: 0
  };

  const disparos = dados?.disparos || {
    totalItens: 0,
    enviados: 0,
    entregues: 0,
    lidos: 0,
    falhas: 0,
    distribuicaoPorProvider: {},
    distribuicaoPorCampanha: []
  };

  const primeiraResposta = dados?.primeiraResposta;
  const atendimentoDetalhes = dados?.atendimentoDetalhes || [];
  const campanhasLista = dados?.campanhas || [];
  const operadoresLista = dados?.operadores || [];
  const disparosLista = disparos.distribuicaoPorCampanha || [];

  // Exportação para Excel (.xlsx)
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    const dataStr = new Date().toISOString().slice(0, 10);

    if (abaAtiva === 'atendimento') {
      const rows = atendimentoDetalhes.map(c => ({
        'ID Conversa': c.id,
        'Eleitor / Contato': c.contatoNome,
        'Telefone': c.telefone,
        'Status': c.status,
        'Responsável': c.responsavelNome,
        'Campanha': c.campanhaNome,
        'Método Atribuição': c.metodoAtribuicao === 'direto_quote' ? 'Citação Confirmada' : (c.metodoAtribuicao === 'temporal_recente' ? 'Provável Origem' : c.metodoAtribuicao),
        'Provedor / Origem': c.provider,
        'Data Criação': c.dataCriacao ? new Date(c.dataCriacao).toLocaleString('pt-BR') : '-',
        'Última Interação': c.ultimaInteracao ? new Date(c.ultimaInteracao).toLocaleString('pt-BR') : '-'
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Atendimentos');
      XLSX.writeFile(wb, `relatorio-atendimentos-${dataStr}.xlsx`);
    } else if (abaAtiva === 'campanhas') {
      const rows = campanhasLista.map(camp => ({
        'ID Campanha': camp.campaignId,
        'Campanha': camp.nome,
        'Provedor': camp.provider || 'META',
        'Total Conversas': camp.totalConversas,
        'Provável Origem (Temporal)': camp.temporalRecente,
        'Citação Confirmada (Quote)': camp.diretoQuote,
        'Disparos Enviados': camp.totalItensEnviados,
        'Entregues': camp.totalItensEntregues,
        'Lidos': camp.totalItensLidos,
        'Falhas': camp.totalFalhas
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Campanhas');
      XLSX.writeFile(wb, `relatorio-campanhas-${dataStr}.xlsx`);
    } else if (abaAtiva === 'operadores') {
      const rows = operadoresLista.map(op => ({
        'ID Operador': op.operadorId,
        'Operador': op.nome,
        'Conversas Atribuídas': op.conversasAtribuidas,
        'Concluídas': op.conversasConcluidas,
        'Pendentes': op.conversasPendentes,
        'Mensagens de Saída': op.mensagensSaida,
        'Notas Internas': op.notasInternas,
        'Tempo Médio 1ª Resposta': op.tempoMedioMinutos !== null ? `${op.tempoMedioMinutos} min` : 'Sem registros'
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Operadores');
      XLSX.writeFile(wb, `relatorio-operadores-${dataStr}.xlsx`);
    } else if (abaAtiva === 'disparos') {
      const rows = disparosLista.map(d => ({
        'ID Campanha': d.campaignId,
        'Campanha': d.nome,
        'Provedor': d.provider || 'META',
        'Total Disparos': d.totalItens,
        'Enviados': d.enviados,
        'Entregues': d.entregues,
        'Lidos': d.lidos,
        'Falhas': d.falhas
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Disparos');
      XLSX.writeFile(wb, `relatorio-disparos-${dataStr}.xlsx`);
    }
  };

  // Exportação para PDF (.pdf)
  const exportarPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const dataHoraStr = new Date().toLocaleString('pt-BR');

    doc.setFontSize(16);
    doc.text('Central de Atendimento Connect — Relatório Operacional', 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${dataHoraStr} | MandatoPRO Oficial`, 14, 25);

    if (abaAtiva === 'atendimento') {
      doc.text(`Seção: Detalhamento de Atendimento (Total: ${atendimentoDetalhes.length} registros)`, 14, 31);
      const head = [['ID', 'Eleitor / Contato', 'Telefone', 'Status', 'Responsável', 'Campanha', 'Atribuição', 'Provedor', 'Criação']];
      const body = atendimentoDetalhes.map(c => [
        c.id,
        c.contatoNome,
        c.telefone,
        c.status,
        c.responsavelNome,
        c.campanhaNome,
        c.metodoAtribuicao === 'direto_quote' ? 'Citação Conf.' : (c.metodoAtribuicao === 'temporal_recente' ? 'Provável Origem' : c.metodoAtribuicao),
        c.provider,
        c.dataCriacao ? new Date(c.dataCriacao).toLocaleDateString('pt-BR') : '-'
      ]);

      doc.autoTable({
        startY: 35,
        head,
        body,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [13, 148, 136] }
      });
      doc.save(`relatorio-atendimentos-${new Date().toISOString().slice(0, 10)}.pdf`);
    } else if (abaAtiva === 'campanhas') {
      doc.text(`Seção: Detalhamento de Campanhas (Total: ${campanhasLista.length} campanhas)`, 14, 31);
      const head = [['ID', 'Campanha', 'Provedor', 'Total Conv.', 'Provável Origem', 'Citação Conf.', 'Enviados', 'Entregues', 'Lidos', 'Falhas']];
      const body = campanhasLista.map(camp => [
        camp.campaignId,
        camp.nome,
        camp.provider || 'META',
        camp.totalConversas,
        camp.temporalRecente,
        camp.diretoQuote,
        camp.totalItensEnviados,
        camp.totalItensEntregues,
        camp.totalItensLidos,
        camp.totalFalhas
      ]);

      doc.autoTable({
        startY: 35,
        head,
        body,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [13, 148, 136] }
      });
      doc.save(`relatorio-campanhas-${new Date().toISOString().slice(0, 10)}.pdf`);
    } else if (abaAtiva === 'operadores') {
      doc.text(`Seção: Produtividade dos Operadores (Total: ${operadoresLista.length} operadores)`, 14, 31);
      const head = [['ID', 'Operador', 'Atribuídas', 'Concluídas', 'Pendentes', 'Mensagens Saída', 'Notas Internas', '1ª Resposta']];
      const body = operadoresLista.map(op => [
        op.operadorId,
        op.nome,
        op.conversasAtribuidas,
        op.conversasConcluidas,
        op.conversasPendentes,
        op.mensagensSaida,
        op.notasInternas,
        op.tempoMedioMinutos !== null ? `${op.tempoMedioMinutos} min` : '-'
      ]);

      doc.autoTable({
        startY: 35,
        head,
        body,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [37, 99, 235] }
      });
      doc.save(`relatorio-operadores-${new Date().toISOString().slice(0, 10)}.pdf`);
    } else if (abaAtiva === 'disparos') {
      doc.text(`Seção: Volumetria de Disparos por Campanha (Total: ${disparosLista.length} campanhas)`, 14, 31);
      const head = [['ID', 'Campanha', 'Provedor', 'Total Disparos', 'Enviados', 'Entregues', 'Lidos', 'Falhas']];
      const body = disparosLista.map(d => [
        d.campaignId,
        d.nome,
        d.provider || 'META',
        d.totalItens,
        d.enviados,
        d.entregues,
        d.lidos,
        d.falhas
      ]);

      doc.autoTable({
        startY: 35,
        head,
        body,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [5, 150, 105] }
      });
      doc.save(`relatorio-disparos-${new Date().toISOString().slice(0, 10)}.pdf`);
    }
  };

  return (
    <ProtectedRoute module={MODULES.ATENDIMENTO_CONNECT}>
      <Layout titulo="Central de Relatórios - Atendimento Connect">
        <div className="space-y-6 pb-12">
          {/* Cabeçalho de Navegação e Ações */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-teal-100/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/atendimento-connect"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900 transition-colors"
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                  <span>Voltar para Atendimentos</span>
                </Link>
              </div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                Central de Relatórios & Desempenho
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Métricas operacionais consolidadas, detalhamento com filtros cruzados e exportação para Excel e PDF.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={exportarExcel}
                disabled={loading || !dados}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-300/80 text-xs font-bold hover:bg-emerald-100 active:scale-95 transition disabled:opacity-50 shadow-sm"
                title="Exportar dados da aba ativa para Excel (.xlsx)"
              >
                <FontAwesomeIcon icon={faFileExcel} className="text-emerald-600" />
                <span>Exportar Excel</span>
              </button>

              <button
                type="button"
                onClick={exportarPDF}
                disabled={loading || !dados}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-300/80 text-xs font-bold hover:bg-rose-100 active:scale-95 transition disabled:opacity-50 shadow-sm"
                title="Exportar dados da aba ativa para PDF (.pdf)"
              >
                <FontAwesomeIcon icon={faFilePdf} className="text-rose-600" />
                <span>Exportar PDF</span>
              </button>

              <button
                type="button"
                onClick={() => carregarRelatorio()}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 active:scale-95 transition disabled:opacity-50 shadow-sm"
              >
                <FontAwesomeIcon icon={faRotateRight} className={loading ? 'animate-spin' : ''} />
                <span>Atualizar</span>
              </button>
            </div>
          </div>

          {/* Barra de Filtros */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200/80 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                <FontAwesomeIcon icon={faFilter} className="text-teal-600" />
                <span>Filtros Operacionais</span>
              </div>
              {temFiltroAtivo && (
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            {/* Atalhos Rápidos de Período */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 mr-1">Período:</span>
              {[
                { id: 'todos', label: 'Todo o histórico' },
                { id: 'hoje', label: 'Hoje' },
                { id: '7dias', label: 'Últimos 7 dias' },
                { id: '30dias', label: 'Últimos 30 dias' },
                { id: 'mes_atual', label: 'Mês atual' },
                { id: 'custom', label: 'Personalizado' }
              ].map(btn => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => btn.id === 'custom' ? setAtalhoPeriodo('custom') : aplicarAtalhoPeriodo(btn.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    atalhoPeriodo === btn.id
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Grid de Controles de Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {/* Data Início e Fim (Personalizado) */}
              {atalhoPeriodo === 'custom' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                      Data Início
                    </label>
                    <input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full text-xs py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                      Data Fim
                    </label>
                    <input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-full text-xs py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </>
              )}

              {/* Status */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full text-xs py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Campanha */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                  Campanha
                </label>
                <select
                  value={campanhaId}
                  onChange={(e) => setCampanhaId(e.target.value)}
                  className="w-full text-xs py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="todos">Todas as Campanhas</option>
                  <option value="sem_campanha">Apenas Sem Campanha</option>
                  {opcoesFiltros.campanhas.map(c => (
                    <option key={c.campaignId} value={c.campaignId}>
                      {c.nome} ({c.totalConversas} conversas)
                    </option>
                  ))}
                </select>
              </div>

              {/* Operador */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                  Operador
                </label>
                <select
                  value={operadorId}
                  onChange={(e) => setOperadorId(e.target.value)}
                  className="w-full text-xs py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="todos">Todos os Operadores</option>
                  <option value="sem_responsavel">Sem Responsável Atribuído</option>
                  {opcoesFiltros.operadores.map(op => (
                    <option key={op.operadorId} value={op.operadorId}>
                      {op.nome} ({op.conversasAtribuidas} atendimentos)
                    </option>
                  ))}
                </select>
              </div>

              {/* Método de Atribuição */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                  Atribuição
                </label>
                <select
                  value={metodoAtribuicao}
                  onChange={(e) => setMetodoAtribuicao(e.target.value)}
                  className="w-full text-xs py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  {METODO_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Provedor Oficial */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                  Provedor
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full text-xs py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  {PROVIDER_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Mensagem de Erro da API */}
          {erro && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-center gap-3">
              <FontAwesomeIcon icon={faTriangleExclamation} className="text-rose-500 text-lg" />
              <div className="flex-1 text-sm font-medium">{erro}</div>
              <button
                type="button"
                onClick={() => carregarRelatorio()}
                className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Indicador de Carregamento */}
          {loading && !dados && (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-200">
              <FontAwesomeIcon icon={faRotateRight} className="text-teal-600 text-3xl animate-spin mb-3" />
              <p className="text-sm font-bold text-gray-700">Consolidando relatórios analíticos...</p>
              <p className="text-xs text-gray-400 mt-1">Buscando dados das conversas, campanhas e disparos oficiais.</p>
            </div>
          )}

          {/* Conteúdo Principal do Relatório */}
          {dados && (
            <>
              {/* Grid de Cards KPI / Resumo Geral */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {/* Total de Conversas */}
                <div className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-200 col-span-2 sm:col-span-2">
                  <div className="flex items-center justify-between text-gray-500 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total de Conversas</span>
                    <FontAwesomeIcon icon={faComments} className="text-teal-600" />
                  </div>
                  <div className="text-2xl font-black text-gray-900">{resumo.totalConversas}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">No filtro selecionado</div>
                </div>

                {/* Novas */}
                <div className="bg-white rounded-xl p-3.5 shadow-sm border border-teal-100/80">
                  <div className="flex items-center justify-between text-teal-700 mb-1">
                    <span className="text-[11px] font-bold uppercase">Novas</span>
                    <FontAwesomeIcon icon={faInbox} />
                  </div>
                  <div className="text-xl font-extrabold text-teal-950">{resumo.novas}</div>
                  <div className="text-[10px] text-teal-600/80 font-medium">Aguardam triagem</div>
                </div>

                {/* Em Atendimento */}
                <div className="bg-white rounded-xl p-3.5 shadow-sm border border-blue-100/80">
                  <div className="flex items-center justify-between text-blue-700 mb-1">
                    <span className="text-[11px] font-bold uppercase">Em Atend.</span>
                    <FontAwesomeIcon icon={faHeadset} />
                  </div>
                  <div className="text-xl font-extrabold text-blue-950">{resumo.emAtendimento}</div>
                  <div className="text-[10px] text-blue-600/80 font-medium">Com atendente</div>
                </div>

                {/* Concluídas */}
                <div className="bg-white rounded-xl p-3.5 shadow-sm border border-emerald-100/80">
                  <div className="flex items-center justify-between text-emerald-700 mb-1">
                    <span className="text-[11px] font-bold uppercase">Concluídas</span>
                    <FontAwesomeIcon icon={faCheck} />
                  </div>
                  <div className="text-xl font-extrabold text-emerald-950">{resumo.concluidas}</div>
                  <div className="text-[10px] text-emerald-600/80 font-medium">Finalizadas</div>
                </div>

                {/* Sem Responsável */}
                <div className="bg-white rounded-xl p-3.5 shadow-sm border border-amber-100/80">
                  <div className="flex items-center justify-between text-amber-700 mb-1">
                    <span className="text-[11px] font-bold uppercase">Sem Operador</span>
                    <FontAwesomeIcon icon={faUserCheck} />
                  </div>
                  <div className="text-xl font-extrabold text-amber-950">{resumo.semResponsavel}</div>
                  <div className="text-[10px] text-amber-600/80 font-medium">Fila aberta</div>
                </div>

                {/* Com Campanha */}
                <div className="bg-white rounded-xl p-3.5 shadow-sm border border-indigo-100/80">
                  <div className="flex items-center justify-between text-indigo-700 mb-1">
                    <span className="text-[11px] font-bold uppercase">Com Campanha</span>
                    <FontAwesomeIcon icon={faBullhorn} />
                  </div>
                  <div className="text-xl font-extrabold text-indigo-950">{resumo.comCampanha}</div>
                  <div className="text-[10px] text-indigo-600/80 font-medium">Origem vinculada</div>
                </div>

                {/* Sem Campanha */}
                <div className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between text-gray-500 mb-1">
                    <span className="text-[11px] font-bold uppercase">Sem Campanha</span>
                    <FontAwesomeIcon icon={faComments} />
                  </div>
                  <div className="text-xl font-extrabold text-gray-800">{resumo.semCampanha}</div>
                  <div className="text-[10px] text-gray-400 font-medium">Orgânico / direto</div>
                </div>

                {/* 1ª Resposta */}
                <div className="bg-white rounded-xl p-3.5 shadow-sm border border-purple-100/80">
                  <div className="flex items-center justify-between text-purple-700 mb-1">
                    <span className="text-[11px] font-bold uppercase">1ª Resposta</span>
                    <FontAwesomeIcon icon={faClock} />
                  </div>
                  <div className="text-xl font-extrabold text-purple-950">
                    {primeiraResposta?.tempoMedioMinutos !== null ? `${primeiraResposta.tempoMedioMinutos}m` : '-'}
                  </div>
                  <div className="text-[10px] text-purple-600/80 font-medium">
                    {primeiraResposta?.conversasConsideradas ? `${primeiraResposta.conversasConsideradas} c/ resposta` : 'Sem respostas'}
                  </div>
                </div>
              </div>

              {/* Seção 1: Desempenho dos Provedores e Disparos Oficiais */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <FontAwesomeIcon icon={faWhatsapp} className="text-emerald-600 text-lg" />
                      <span>Volumetria de Disparos por Provedor Oficial</span>
                    </h2>
                    <p className="text-xs text-gray-500">
                      Envios computados a partir de communication_campaign_items com resolução normalizada.
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-gray-500 block">Total de Itens</span>
                    <span className="text-lg font-black text-gray-900">{disparos.totalItens}</span>
                  </div>
                </div>

                {/* Cards por Provider */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* WABLAST */}
                  <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-200/80">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider">WaBlast Oficial</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        WABLAST
                      </span>
                    </div>
                    <div className="text-2xl font-black text-emerald-950">
                      {disparos.distribuicaoPorProvider?.WABLAST || 0}
                    </div>
                    <p className="text-[11px] text-emerald-700 mt-1">Disparos pelo canal oficial WaBlast</p>
                  </div>

                  {/* YCLOUD */}
                  <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-200/80">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-extrabold text-teal-900 uppercase tracking-wider">YCloud WhatsApp</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                        YCLOUD
                      </span>
                    </div>
                    <div className="text-2xl font-black text-teal-950">
                      {disparos.distribuicaoPorProvider?.YCLOUD || 0}
                    </div>
                    <p className="text-[11px] text-teal-700 mt-1">Disparos pelo canal YCloud</p>
                  </div>

                  {/* META CLOUD */}
                  <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-200/80">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-extrabold text-blue-900 uppercase tracking-wider">Meta Cloud API</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                        META
                      </span>
                    </div>
                    <div className="text-2xl font-black text-blue-950">
                      {disparos.distribuicaoPorProvider?.META || 0}
                    </div>
                    <p className="text-[11px] text-blue-700 mt-1">Disparos pela API direta da Meta</p>
                  </div>
                </div>

                {/* Sub-cards de Status dos Envios */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200/80 text-center">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Enviados</span>
                    <span className="text-base font-black text-gray-900">{disparos.enviados}</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200/80 text-center">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Entregues</span>
                    <span className="text-base font-black text-gray-900">{disparos.entregues}</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200/80 text-center">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Lidos</span>
                    <span className="text-base font-black text-gray-900">{disparos.lidos}</span>
                  </div>
                  <div className="bg-rose-50/60 rounded-lg p-3 border border-rose-200/80 text-center">
                    <span className="text-[10px] font-bold text-rose-700 uppercase block">Falhas / Erros</span>
                    <span className="text-base font-black text-rose-900">{disparos.falhas}</span>
                  </div>
                </div>
              </div>

              {/* Seção 2: Desempenho por Campanha */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <FontAwesomeIcon icon={faBullhorn} className="text-teal-600" />
                      <span>Campanhas que Geraram Retorno de Eleitores</span>
                    </h2>
                    <p className="text-xs text-gray-500">
                      Relação de conversas originadas por campanhas, detalhando o método de atribuição seguro.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                    {dados.campanhas?.length || 0} campanhas ativas
                  </span>
                </div>

                {dados.campanhas?.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Nenhuma campanha com dados de atendimento para o filtro selecionado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-500 uppercase font-bold text-[10px]">
                          <th className="py-2.5 px-3">Campanha</th>
                          <th className="py-2.5 px-3 text-center">Total Conversas</th>
                          <th className="py-2.5 px-3 text-center" title="Correlação temporal: eleitor respondeu em até 48h após o disparo (não comprova citação explícita)">
                            Provável Origem <span className="text-[9px] text-gray-400 font-normal block normal-case">(Temporal Recente)</span>
                          </th>
                          <th className="py-2.5 px-3 text-center" title="Citação confirmada: o eleitor respondeu citando diretamente a mensagem do disparo">
                            Citação Confirmada <span className="text-[9px] text-gray-400 font-normal block normal-case">(Quote Direto)</span>
                          </th>
                          <th className="py-2.5 px-3 text-center">Disparos Enviados</th>
                          <th className="py-2.5 px-3 text-center">Falhas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {dados.campanhas.map((camp) => (
                          <tr key={camp.campaignId} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-3">
                              <span className="font-bold text-gray-900 block">{camp.nome}</span>
                              <span className="text-[10px] text-gray-400 font-mono">ID: {camp.campaignId}</span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black bg-teal-100 text-teal-900">
                                {camp.totalConversas}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-semibold text-gray-700">
                              <span className="inline-block px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-900 border border-amber-200/60" title="Provável origem por proximidade de disparo">
                                {camp.temporalRecente}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-semibold text-gray-700">
                              <span className="inline-block px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-900 border border-emerald-200/60" title="Citação direta confirmada">
                                {camp.diretoQuote}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-medium text-gray-600">
                              {camp.totalItensEnviados}
                            </td>
                            <td className="py-3 px-3 text-center font-medium text-rose-600">
                              {camp.totalFalhas}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Seção 3: Produtividade dos Operadores e Atendentes */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <FontAwesomeIcon icon={faUserCheck} className="text-blue-600" />
                      <span>Produtividade e Acompanhamento da Equipe</span>
                    </h2>
                    <p className="text-xs text-gray-500">
                      Volume de conversas atribuídas, finalizadas e mensagens enviadas pelos operadores.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                    {dados.operadores?.length || 0} operadores ativos
                  </span>
                </div>

                {dados.operadores?.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Nenhum operador com atendimentos registrados no filtro selecionado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-500 uppercase font-bold text-[10px]">
                          <th className="py-2.5 px-3">Operador</th>
                          <th className="py-2.5 px-3 text-center">Atribuídas</th>
                          <th className="py-2.5 px-3 text-center">Concluídas</th>
                          <th className="py-2.5 px-3 text-center">Pendentes</th>
                          <th className="py-2.5 px-3 text-center">Mensagens Enviadas</th>
                          <th className="py-2.5 px-3 text-center">Notas Internas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {dados.operadores.map((op) => (
                          <tr key={op.operadorId} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-3">
                              <span className="font-bold text-gray-900 block">{op.nome}</span>
                              <span className="text-[10px] text-gray-400 font-mono">ID: {op.operadorId}</span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-900">
                                {op.conversasAtribuidas}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-semibold text-emerald-700">
                              {op.conversasConcluidas}
                            </td>
                            <td className="py-3 px-3 text-center font-semibold text-amber-700">
                              {op.conversasPendentes}
                            </td>
                            <td className="py-3 px-3 text-center font-medium text-gray-700">
                              {op.mensagensSaida}
                            </td>
                            <td className="py-3 px-3 text-center font-medium text-gray-600">
                              {op.notasInternas}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Seção 4: Conversas por Período (Distribuição Diária Real) */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <FontAwesomeIcon icon={faChartLine} className="text-teal-600" />
                      <span>Volume Diário de Conversas Criadas</span>
                    </h2>
                    <p className="text-xs text-gray-500">
                      Histórico cronológico real baseado na data de registro da conversa (created_at).
                    </p>
                  </div>
                </div>

                {dados.conversasPorPeriodo?.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Nenhum registro para o período informado.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {dados.conversasPorPeriodo.map((item) => {
                      const percentual = Math.min(100, Math.round((item.quantidade / (resumo.totalConversas || 1)) * 100));
                      return (
                        <div key={item.data} className="flex items-center gap-3 text-xs">
                          <span className="w-24 text-gray-500 font-mono shrink-0">{item.data}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                            <div
                              className="bg-teal-600 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.max(5, percentual)}%` }}
                            />
                          </div>
                          <span className="w-16 text-right font-bold text-gray-800 shrink-0">
                            {item.quantidade} conv.
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Seção 5: Detalhamento por Abas com Consulta Completa e Exportação */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <FontAwesomeIcon icon={faTable} className="text-teal-600" />
                      <span>Detalhamento Operacional dos Dados</span>
                    </h2>
                    <p className="text-xs text-gray-500">
                      Navegue pelas abas para inspecionar e exportar os registros conforme os filtros globais aplicados.
                    </p>
                  </div>

                  {/* Controle de Seleção de Abas */}
                  <div className="flex flex-wrap items-center gap-1.5 p-1 bg-gray-100 rounded-xl">
                    {[
                      { id: 'atendimento', label: 'Atendimento', count: atendimentoDetalhes.length, icon: faComments },
                      { id: 'campanhas', label: 'Campanhas', count: campanhasLista.length, icon: faBullhorn },
                      { id: 'operadores', label: 'Operadores', count: operadoresLista.length, icon: faUserCheck },
                      { id: 'disparos', label: 'Disparos', count: disparosLista.length, icon: faPaperPlane }
                    ].map(aba => (
                      <button
                        key={aba.id}
                        type="button"
                        onClick={() => setAbaAtiva(aba.id)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          abaAtiva === aba.id
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        <FontAwesomeIcon icon={aba.icon} className={abaAtiva === aba.id ? 'text-teal-600' : 'text-gray-400'} />
                        <span>{aba.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          abaAtiva === aba.id ? 'bg-teal-100 text-teal-900' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {aba.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ABA 1: DETALHAMENTO DE ATENDIMENTO */}
                {abaAtiva === 'atendimento' && (
                  <div>
                    {atendimentoDetalhes.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-xs">
                        Nenhuma conversa encontrada para os filtros selecionados.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-200 text-gray-500 uppercase font-bold text-[10px]">
                              <th className="py-2.5 px-3">Eleitor / Contato</th>
                              <th className="py-2.5 px-3">Telefone</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                              <th className="py-2.5 px-3">Responsável</th>
                              <th className="py-2.5 px-3">Campanha</th>
                              <th className="py-2.5 px-3 text-center">Atribuição</th>
                              <th className="py-2.5 px-3 text-center">Provedor</th>
                              <th className="py-2.5 px-3">Data Conversa</th>
                              <th className="py-2.5 px-3">Última Interação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {atendimentoDetalhes.slice(0, 100).map((c) => {
                              let statusBadgeClass = 'bg-gray-100 text-gray-700';
                              const st = String(c.status).toLowerCase();
                              if (st === 'nova') statusBadgeClass = 'bg-teal-100 text-teal-900';
                              else if (st === 'em_atendimento') statusBadgeClass = 'bg-blue-100 text-blue-900';
                              else if (st === 'concluida') statusBadgeClass = 'bg-emerald-100 text-emerald-900';
                              else if (st === 'aguardando_eleitor') statusBadgeClass = 'bg-amber-100 text-amber-900';
                              else if (st === 'resolver_depois') statusBadgeClass = 'bg-purple-100 text-purple-900';

                              let provBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                              if (c.provider === 'WABLAST') provBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                              else if (c.provider === 'YCLOUD') provBadgeClass = 'bg-teal-50 text-teal-800 border-teal-200';

                              return (
                                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="py-2.5 px-3">
                                    <span className="font-bold text-gray-900 block">{c.contatoNome}</span>
                                    <span className="text-[10px] text-gray-400 font-mono">ID: {c.id}</span>
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-gray-600">
                                    {c.telefone}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${statusBadgeClass}`}>
                                      {c.status}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 font-medium text-gray-700">
                                    {c.responsavelNome}
                                  </td>
                                  <td className="py-2.5 px-3 font-medium text-gray-800">
                                    {c.campanhaNome}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {c.metodoAtribuicao === 'direto_quote' && (
                                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200" title="Citação direta confirmada">
                                        Citação Conf.
                                      </span>
                                    )}
                                    {c.metodoAtribuicao === 'temporal_recente' && (
                                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200" title="Provável origem por proximidade temporal">
                                        Provável Origem
                                      </span>
                                    )}
                                    {c.metodoAtribuicao !== 'direto_quote' && c.metodoAtribuicao !== 'temporal_recente' && (
                                      <span className="text-[10px] text-gray-400">
                                        {c.metodoAtribuicao === 'sem_campanha' ? 'Orgânico' : c.metodoAtribuicao}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${provBadgeClass}`}>
                                      {c.provider}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-gray-500 font-mono text-[11px]">
                                    {c.dataCriacao ? new Date(c.dataCriacao).toLocaleDateString('pt-BR') : '-'}
                                  </td>
                                  <td className="py-2.5 px-3 text-gray-500 font-mono text-[11px]">
                                    {c.ultimaInteracao ? new Date(c.ultimaInteracao).toLocaleString('pt-BR') : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {atendimentoDetalhes.length > 100 && (
                          <div className="p-3 bg-gray-50 text-center text-xs text-gray-500 border-t border-gray-100">
                            Exibindo os primeiros 100 registros de {atendimentoDetalhes.length}. Para visualizar ou analisar a listagem integral, utilize os botões <strong>Exportar Excel</strong> ou <strong>Exportar PDF</strong>.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ABA 2: DETALHAMENTO DE CAMPANHAS */}
                {abaAtiva === 'campanhas' && (
                  <div>
                    {campanhasLista.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-xs">
                        Nenhuma campanha encontrada para os filtros selecionados.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-200 text-gray-500 uppercase font-bold text-[10px]">
                              <th className="py-2.5 px-3">Campanha</th>
                              <th className="py-2.5 px-3 text-center">Provedor</th>
                              <th className="py-2.5 px-3 text-center">Total Conversas</th>
                              <th className="py-2.5 px-3 text-center">Provável Origem</th>
                              <th className="py-2.5 px-3 text-center">Citação Confirmada</th>
                              <th className="py-2.5 px-3 text-center">Enviados</th>
                              <th className="py-2.5 px-3 text-center">Entregues</th>
                              <th className="py-2.5 px-3 text-center">Lidos</th>
                              <th className="py-2.5 px-3 text-center">Falhas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {campanhasLista.map((camp) => {
                              let provBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                              if (camp.provider === 'WABLAST') provBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                              else if (camp.provider === 'YCLOUD') provBadgeClass = 'bg-teal-50 text-teal-800 border-teal-200';

                              return (
                                <tr key={camp.campaignId} className="hover:bg-gray-50 transition-colors">
                                  <td className="py-2.5 px-3">
                                    <span className="font-bold text-gray-900 block">{camp.nome}</span>
                                    <span className="text-[10px] text-gray-400 font-mono">ID: {camp.campaignId}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${provBadgeClass}`}>
                                      {camp.provider || 'META'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black bg-teal-100 text-teal-900">
                                      {camp.totalConversas}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-semibold text-gray-700">
                                    <span className="inline-block px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-900 border border-amber-200/60">
                                      {camp.temporalRecente}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-semibold text-gray-700">
                                    <span className="inline-block px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-900 border border-emerald-200/60">
                                      {camp.diretoQuote}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-medium text-gray-700">
                                    {camp.totalItensEnviados}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-medium text-gray-700">
                                    {camp.totalItensEntregues}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-medium text-gray-700">
                                    {camp.totalItensLidos}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-medium text-rose-600">
                                    {camp.totalFalhas}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ABA 3: DETALHAMENTO DE OPERADORES */}
                {abaAtiva === 'operadores' && (
                  <div>
                    {operadoresLista.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-xs">
                        Nenhum operador encontrado para os filtros selecionados.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-200 text-gray-500 uppercase font-bold text-[10px]">
                              <th className="py-2.5 px-3">Operador</th>
                              <th className="py-2.5 px-3 text-center">Atribuídas</th>
                              <th className="py-2.5 px-3 text-center">Concluídas</th>
                              <th className="py-2.5 px-3 text-center">Pendentes</th>
                              <th className="py-2.5 px-3 text-center">Mensagens Enviadas</th>
                              <th className="py-2.5 px-3 text-center">Notas Internas</th>
                              <th className="py-2.5 px-3 text-center">Tempo Médio 1ª Resposta</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {operadoresLista.map((op) => (
                              <tr key={op.operadorId} className="hover:bg-gray-50 transition-colors">
                                <td className="py-2.5 px-3">
                                  <span className="font-bold text-gray-900 block">{op.nome}</span>
                                  <span className="text-[10px] text-gray-400 font-mono">ID: {op.operadorId}</span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-900">
                                    {op.conversasAtribuidas}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center font-semibold text-emerald-700">
                                  {op.conversasConcluidas}
                                </td>
                                <td className="py-2.5 px-3 text-center font-semibold text-amber-700">
                                  {op.conversasPendentes}
                                </td>
                                <td className="py-2.5 px-3 text-center font-medium text-gray-700">
                                  {op.mensagensSaida}
                                </td>
                                <td className="py-2.5 px-3 text-center font-medium text-gray-600">
                                  {op.notasInternas}
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold text-purple-900">
                                  {op.tempoMedioMinutos !== null ? (
                                    <span className="inline-block px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
                                      {op.tempoMedioMinutos} min
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 font-normal">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ABA 4: DETALHAMENTO DE DISPAROS */}
                {abaAtiva === 'disparos' && (
                  <div>
                    {disparosLista.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-xs">
                        Nenhum disparo registrado para os filtros selecionados.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-200 text-gray-500 uppercase font-bold text-[10px]">
                              <th className="py-2.5 px-3">Campanha</th>
                              <th className="py-2.5 px-3 text-center">Provedor</th>
                              <th className="py-2.5 px-3 text-center">Total Disparos</th>
                              <th className="py-2.5 px-3 text-center">Enviados</th>
                              <th className="py-2.5 px-3 text-center">Entregues</th>
                              <th className="py-2.5 px-3 text-center">Lidos</th>
                              <th className="py-2.5 px-3 text-center">Falhas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {disparosLista.map((d) => {
                              let provBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                              if (d.provider === 'WABLAST') provBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                              else if (d.provider === 'YCLOUD') provBadgeClass = 'bg-teal-50 text-teal-800 border-teal-200';

                              return (
                                <tr key={d.campaignId} className="hover:bg-gray-50 transition-colors">
                                  <td className="py-2.5 px-3">
                                    <span className="font-bold text-gray-900 block">{d.nome}</span>
                                    <span className="text-[10px] text-gray-400 font-mono">ID: {d.campaignId}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${provBadgeClass}`}>
                                      {d.provider || 'META'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black bg-gray-100 text-gray-800">
                                      {d.totalItens}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-medium text-gray-700">
                                    {d.enviados}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-medium text-gray-700">
                                    {d.entregues}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-medium text-gray-700">
                                    {d.lidos}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-medium text-rose-600">
                                    {d.falhas}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
