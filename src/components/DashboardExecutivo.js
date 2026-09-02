import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBullhorn,
  faPaperPlane,
  faCheckCircle,
  faEye,
  faTimesCircle,
  faPercentage,
  faClock,
  faInbox,
  faUserClock,
  faLightbulb,
  faComments,
  faServer
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp, faInstagram } from '@fortawesome/free-brands-svg-icons';
import { DashboardCampaignService } from '@/services/dashboardCampaignService';
import { DashboardAttendanceService } from '@/services/dashboardAttendanceService';
import { InsightCard } from '@/components/InsightCard';
import { InsightsComunicacaoService } from '@/services/insightsComunicacaoService';

export default function DashboardExecutivo() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalCampanhas: 0,
    campanhasAtivas: 0,
    mensagensEnviadasHoje: 0,
    totalEnviadas: 0,
    mensagensEntrada: 0,
    mensagensSaida: 0,
    entregues: 0,
    lidas: 0,
    falhas: 0,
    taxaEntrega: 0,
    taxaLeitura: 0,
    historicoUltimos7Dias: [],
    porProvedor: {},
    campanhasRecentes: []
  });

  const [attendance, setAttendance] = useState({
    conversasAbertas: 0,
    conversasAguardando: 0,
    tempoMedioResposta: 'Não disponível',
    novas: 0,
    emAtendimento: 0,
    aguardandoEleitor: 0,
    concluidas: 0,
    totalConversas: 0,
    totalNaoLidas: 0,
    porCanal: {}
  });

  const [insights, setInsights] = useState([]);

  const carregarMétricasCampanhas = async () => {
    try {
      const data = await DashboardCampaignService.obterIndicadoresCampanha();
      if (data) {
        setMetrics(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Falha ao obter os dados do DashboardCampaignService:', err);
    }
  };

  const carregarMétricasAtendimento = async () => {
    try {
      const data = await DashboardAttendanceService.obterIndicadoresAtendimento();
      if (data) {
        setAttendance(prev => ({
          ...prev,
          ...data,
          tempoMedioResposta: 'Não disponível'
        }));
      }
    } catch (err) {
      console.error('Falha ao obter os dados do DashboardAttendanceService:', err);
    }
  };

  useEffect(() => {
    const carregarTudo = async () => {
      setLoading(true);
      await Promise.all([carregarMétricasCampanhas(), carregarMétricasAtendimento()]);
      setLoading(false);
    };
    carregarTudo();
  }, []);

  // Recalcular insights quando as métricas reais forem carregadas
  useEffect(() => {
    const dadosAnalise = {
      campanhas: metrics.campanhasRecentes || [],
      templates: [],
      operadores: []
    };
    const gerados = InsightsComunicacaoService.gerarInsightsLocais(dadosAnalise);
    setInsights(gerados);
  }, [metrics]);

  // Provedores com dados reais
  const provedoresMapeados = Object.entries(metrics.porProvedor || {}).map(([prov, total]) => {
    let nome = prov;
    let bg = 'bg-teal-500';
    let icon = faWhatsapp;

    const provUpper = String(prov || '').toUpperCase();

    if (provUpper === 'META') {
      nome = 'WhatsApp Oficial — Meta';
      bg = 'bg-blue-600';
      icon = faWhatsapp;
    } else if (provUpper === 'WABLAST') {
      nome = 'WhatsApp Oficial — WaBlast';
      bg = 'bg-emerald-600';
      icon = faWhatsapp;
    } else if (provUpper === 'YCLOUD') {
      nome = 'YCloud WhatsApp';
      bg = 'bg-teal-600';
      icon = faWhatsapp;
    } else if (provUpper === 'WHATSAPP') {
      nome = 'WhatsApp Oficial — Legado';
      bg = 'bg-gray-500';
      icon = faWhatsapp;
    } else if (provUpper === 'INSTAGRAM') {
      nome = 'Instagram Direct';
      bg = 'bg-pink-600';
      icon = faInstagram;
    }

    return { provedor: nome, total, bg, icon };
  });

  const totalMensagensProvedores = provedoresMapeados.reduce((acc, curr) => acc + curr.total, 0);

  // Histórico de 7 dias real
  const historico7Dias = metrics.historicoUltimos7Dias && metrics.historicoUltimos7Dias.length > 0
    ? metrics.historicoUltimos7Dias
    : [
        { dia: 'Seg', total: 0 },
        { dia: 'Ter', total: 0 },
        { dia: 'Qua', total: 0 },
        { dia: 'Qui', total: 0 },
        { dia: 'Sex', total: 0 },
        { dia: 'Sáb', total: 0 },
        { dia: 'Dom', total: 0 }
      ];

  const maxDiario = Math.max(...historico7Dias.map(h => h.total || 0), 1);

  return (
    <div className="space-y-6">
      
      {/* Grid de KPIs - Indicadores Operacionais */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <span className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FontAwesomeIcon icon={faBullhorn} className="text-sm" />
          </span>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Campanhas</p>
            <p className="text-base font-bold text-gray-800">{metrics.totalCampanhas}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <span className="p-3 bg-teal-50 text-teal-600 rounded-xl">
            <FontAwesomeIcon icon={faPaperPlane} className="text-sm" />
          </span>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Enviadas (Total)</p>
            <p className="text-base font-bold text-gray-800">{metrics.totalEnviadas}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <span className="p-3 bg-green-50 text-green-600 rounded-xl">
            <FontAwesomeIcon icon={faCheckCircle} className="text-sm" />
          </span>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Entregues</p>
            <p className="text-base font-bold text-green-700">{metrics.entregues}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <span className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <FontAwesomeIcon icon={faEye} className="text-sm" />
          </span>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Lidas</p>
            <p className="text-base font-bold text-emerald-700">{metrics.lidas}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 text-xs">
          <span className="p-3 bg-red-50 text-red-600 rounded-xl">
            <FontAwesomeIcon icon={faTimesCircle} className="text-sm" />
          </span>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Falhas</p>
            <p className="text-base font-bold text-red-600">{metrics.falhas}</p>
          </div>
        </div>

      </div>

      {/* Grid de Taxas e Conversas da Central */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-teal-50/60 to-emerald-50/20 border border-teal-100 rounded-2xl p-4 text-center shadow-xs">
          <p className="text-[10px] font-bold text-teal-800 uppercase">Taxa de Entrega</p>
          <p className="text-2xl font-bold text-teal-900 mt-1 flex items-center justify-center gap-1">
            <FontAwesomeIcon icon={faPercentage} className="text-sm" /> {metrics.taxaEntrega}%
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/20 border border-blue-100 rounded-2xl p-4 text-center shadow-xs">
          <p className="text-[10px] font-bold text-blue-800 uppercase">Taxa de Leitura</p>
          <p className="text-2xl font-bold text-blue-900 mt-1 flex items-center justify-center gap-1">
            <FontAwesomeIcon icon={faPercentage} className="text-sm" /> {metrics.taxaLeitura}%
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-50/60 to-yellow-50/20 border border-amber-100 rounded-2xl p-4 text-center shadow-xs">
          <p className="text-[10px] font-bold text-amber-800 uppercase">Novas Respostas</p>
          <p className="text-2xl font-bold text-amber-900 mt-1 flex items-center justify-center gap-1">
            <FontAwesomeIcon icon={faComments} className="text-sm" /> {attendance.novas}
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50/60 to-purple-100/20 border border-purple-100 rounded-2xl p-4 text-center shadow-xs">
          <p className="text-[10px] font-bold text-purple-800 uppercase">Total de Conversas</p>
          <p className="text-2xl font-bold text-purple-900 mt-1 flex items-center justify-center gap-1">
            <FontAwesomeIcon icon={faInbox} className="text-sm" /> {attendance.totalConversas}
          </p>
        </div>
      </div>

      {/* Gráficos e Detalhamentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Gráfico Diário de Mensagens Reais */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-gray-800">Volumetria dos Últimos 7 Dias</h4>
            <span className="text-[10px] font-semibold text-gray-400">Total: {metrics.mensagensEntrada + metrics.mensagensSaida} mensagens</span>
          </div>
          <div className="h-48 flex items-end gap-3 justify-between pt-6 border-b border-gray-100 px-2">
            {historico7Dias.map((item, idx) => {
              const heightPct = Math.min(Math.round(((item.total || 0) / maxDiario) * 100), 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <span className="text-[9px] font-bold text-teal-700 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.total || 0}
                  </span>
                  <div
                    className="w-full bg-teal-600/80 hover:bg-teal-600 rounded-t-lg transition-all duration-300 min-h-[4px]"
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                  />
                  <span className="text-[10px] font-medium text-gray-500">{item.dia}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-around text-[11px] text-gray-500 pt-1">
            <span>📥 Recebidas: <strong className="text-gray-800">{metrics.mensagensEntrada}</strong></span>
            <span>📤 Enviadas: <strong className="text-gray-800">{metrics.mensagensSaida}</strong></span>
          </div>
        </div>

        {/* Distribuição Real por Provedor */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-gray-800">Distribuição por Provedor</h4>
            <span className="text-[10px] font-semibold text-gray-400"><FontAwesomeIcon icon={faServer} className="mr-1" />Ativos</span>
          </div>
          <div className="space-y-3.5">
            {provedoresMapeados.length > 0 ? (
              provedoresMapeados.map((c, idx) => {
                const pct = totalMensagensProvedores > 0 ? Math.round((c.total / totalMensagensProvedores) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span className="flex items-center gap-1.5 font-medium">
                        <FontAwesomeIcon icon={c.icon} className="text-gray-400" />
                        {c.provedor}
                      </span>
                      <span className="font-bold">{c.total} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${c.bg} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-400 py-6 text-center">Nenhum provedor com tráfego registrado.</p>
            )}
          </div>
          <p className="text-[10px] text-gray-400 text-center">Baseado nas mensagens oficiais registradas no banco.</p>
        </div>

        {/* Campanhas Cadastradas Recentes */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-gray-800">Campanhas Recentes</h4>
            <span className="text-[10px] font-semibold text-gray-400">{metrics.totalCampanhas} no total</span>
          </div>
          <div className="divide-y divide-gray-100 text-xs">
            {metrics.campanhasRecentes && metrics.campanhasRecentes.length > 0 ? (
              metrics.campanhasRecentes.map((c) => (
                <div key={c.id} className="py-3 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-gray-800 truncate">{c.nome}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Criada em {c.criadoEm ? new Date(c.criadoEm).toLocaleDateString('pt-BR') : '—'}
                    </p>
                  </div>
                  <span className="bg-teal-50 text-teal-700 font-bold border border-teal-200 px-2 py-0.5 rounded-lg text-[10px] uppercase flex-shrink-0">
                    {c.status || 'Ativa'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 py-6 text-center">Nenhuma campanha cadastrada.</p>
            )}
          </div>
        </div>

        {/* Status das Conversas na Central */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-gray-800">Status da Central de Atendimento</h4>
            <span className="text-[10px] font-semibold text-gray-400">{attendance.totalConversas} conversas</span>
          </div>
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-blue-50/50 border border-blue-100/50">
              <span className="font-medium text-blue-900">Novas Respostas (Inbound)</span>
              <span className="font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-lg">{attendance.novas}</span>
            </div>
            <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-amber-50/50 border border-amber-100/50">
              <span className="font-medium text-amber-900">Em Atendimento</span>
              <span className="font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-lg">{attendance.emAtendimento}</span>
            </div>
            <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-purple-50/50 border border-purple-100/50">
              <span className="font-medium text-purple-900">Aguardando Eleitor</span>
              <span className="font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-lg">{attendance.aguardandoEleitor}</span>
            </div>
            <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-gray-50 border border-gray-200/50">
              <span className="font-medium text-gray-700">Finalizadas</span>
              <span className="font-bold text-gray-600 bg-gray-200/80 px-2 py-0.5 rounded-lg">{attendance.concluidas}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Insights e Recomendações Automáticas Incorporadas */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faLightbulb} className="text-amber-500" />
            <h4 className="font-bold text-sm text-gray-800">Insights & Recomendações do Canal</h4>
          </div>
          <span className="text-[10px] uppercase font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
            Diagnóstico Automático
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.length > 0 ? (
            insights.map((ins) => (
              <InsightCard key={ins.id} insight={ins} />
            ))
          ) : (
            <p className="text-xs text-gray-400 py-4 col-span-2 text-center">Nenhum insight operacional pendente.</p>
          )}
        </div>
      </div>

    </div>
  );
}

