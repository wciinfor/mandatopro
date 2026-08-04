import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers, 
  faUserTie, 
  faChartLine, 
  faMapMarkerAlt, 
  faBullhorn, 
  faHandsHelping, 
  faClipboardList 
} from '@fortawesome/free-solid-svg-icons';

/**
 * ExecutiveKpiBar 2.0 (Executive Dashboard Sprint 01)
 * Responde instantaneamente às 7 perguntas práticas do deputado em <5 segundos.
 * Cada KPI inclui ícone, valor principal, subinformação, barra de progresso e estado visual (🟢/🟡/🔴).
 */
export default function ExecutiveKpiBar({
  totalEleitores = 0,
  cadastrosHoje = 0,
  liderancasAtivasHoje = 0,
  totalLiderancas = 0,
  metaDiaria = 150,
  municipiosAtendidos = 0,
  totalMunicipiosEstado = 144,
  campanhasAtivas = 0,
  campanhasMes = 0,
  atendimentosPendentes = 0,
  atendimentosConcluidosHoje = 0,
  solicitacoesPendentes = 0,
  solicitacoesResolvidasHoje = 0
}) {
  // 1. Base Eleitoral
  const totalEleitoresFmt = (totalEleitores || 0).toLocaleString('pt-BR');
  const cadastrosHojeFmt = cadastrosHoje || 0;

  // 2. Equipe em Campo (Lideranças ativas hoje)
  const pctEquipeAtiva = totalLiderancas > 0 ? Math.round((liderancasAtivasHoje / totalLiderancas) * 100) : 0;
  const estadoEquipe = pctEquipeAtiva >= 40 ? 'VERDE' : pctEquipeAtiva >= 20 ? 'AMARELO' : 'VERMELHO';

  // 3. Produção do Dia (Meta diária)
  const pctMeta = Math.min(100, Math.round((cadastrosHoje / (metaDiaria || 150)) * 100));
  const estadoProducao = pctMeta >= 80 ? 'VERDE' : pctMeta >= 40 ? 'AMARELO' : 'VERMELHO';

  // 4. Cobertura (Municípios)
  const pctCobertura = Math.min(100, Math.round(((municipiosAtendidos || 0) / (totalMunicipiosEstado || 144)) * 100));

  // Lista dos 7 KPIs Executivos com perguntas práticas respondidas
  const kpis = [
    {
      id: 'base-eleitoral',
      pergunta: 'Quantos eleitores temos?',
      titulo: '👥 Base Eleitoral',
      valor: totalEleitoresFmt,
      subtext: `+${cadastrosHojeFmt} hoje`,
      icone: faUsers,
      estado: 'VERDE',
      progresso: null
    },
    {
      id: 'equipe-campo',
      pergunta: 'Quantas lideranças trabalharam hoje?',
      titulo: '🤝 Equipe em Campo',
      valor: `${liderancasAtivasHoje} / ${totalLiderancas || 1}`,
      subtext: `${pctEquipeAtiva}% da equipe produziu hoje`,
      icone: faUserTie,
      estado: estadoEquipe,
      progresso: pctEquipeAtiva
    },
    {
      id: 'producao-dia',
      pergunta: 'Nossa meta diária está sendo cumprida?',
      titulo: '📈 Produção do Dia',
      valor: `${cadastrosHojeFmt}`,
      subtext: `Meta: ${metaDiaria} (${pctMeta}%)`,
      icone: faChartLine,
      estado: estadoProducao,
      progresso: pctMeta
    },
    {
      id: 'cobertura',
      pergunta: 'Em quantos municípios estamos presentes?',
      titulo: '🗺 Cobertura',
      valor: `${municipiosAtendidos || 0} municípios`,
      subtext: `${pctCobertura}% do estado`,
      icone: faMapMarkerAlt,
      estado: pctCobertura >= 30 ? 'VERDE' : 'AMARELO',
      progresso: pctCobertura
    },
    {
      id: 'campanhas',
      pergunta: 'Quantas campanhas estão em andamento?',
      titulo: '📢 Campanhas',
      valor: `${campanhasAtivas || 0} Ativas`,
      subtext: `${campanhasMes || campanhasAtivas || 0} iniciadas no mês`,
      icone: faBullhorn,
      estado: 'VERDE',
      progresso: null
    },
    {
      id: 'atendimentos',
      pergunta: 'Como está o volume de atendimentos?',
      titulo: '🎫 Atendimentos',
      valor: `${atendimentosPendentes} Pendentes`,
      subtext: `${atendimentosConcluidosHoje} concluídos hoje`,
      icone: faHandsHelping,
      estado: atendimentosPendentes <= 10 ? 'VERDE' : 'AMARELO',
      progresso: null
    },
    {
      id: 'solicitacoes',
      pergunta: 'Qual o volume de solicitações?',
      titulo: '📄 Solicitações',
      valor: `${solicitacoesPendentes} Pendentes`,
      subtext: `${solicitacoesResolvidasHoje} resolvidas hoje`,
      icone: faClipboardList,
      estado: solicitacoesPendentes <= 5 ? 'VERDE' : 'VERMELHO',
      progresso: null
    }
  ];

  const getStatusBorderColor = (estado) => {
    switch (estado) {
      case 'VERDE': return 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300';
      case 'AMARELO': return 'border-amber-500/40 bg-amber-950/20 text-amber-300';
      case 'VERMELHO': default: return 'border-rose-500/40 bg-rose-950/20 text-rose-300';
    }
  };

  const getStatusDot = (estado) => {
    switch (estado) {
      case 'VERDE': return <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>;
      case 'AMARELO': return <span className="w-2 h-2 rounded-full bg-amber-400"></span>;
      case 'VERMELHO': default: return <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping"></span>;
    }
  };

  return (
    <div className="w-full grid grid-cols-7 gap-2.5 flex-shrink-0">
      {kpis.map((kpi) => {
        const estadoClass = getStatusBorderColor(kpi.estado);
        const statusDot = getStatusDot(kpi.estado);

        return (
          <div
            key={kpi.id}
            className={`border rounded-xl p-2.5 flex flex-col justify-between backdrop-blur transition-all duration-500 shadow-md ${estadoClass}`}
          >
            {/* Header: Ícone + Título Curto + Estado Visual */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 truncate">
                <FontAwesomeIcon icon={kpi.icone} className="text-slate-400 text-xs flex-shrink-0" />
                {kpi.titulo}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {statusDot}
              </div>
            </div>

            {/* Valor Grande Principal */}
            <div className="my-0.5">
              <span className="text-lg font-black text-white font-mono leading-none tracking-tight block">
                {kpi.valor}
              </span>
            </div>

            {/* Subinformação + Barra de Progresso (quando houver) */}
            <div className="mt-1">
              <span className="text-[10px] font-bold text-slate-300/90 block truncate">
                {kpi.subtext}
              </span>

              {kpi.progresso !== null && (
                <div className="w-full h-1.5 bg-slate-900 rounded-full border border-slate-800 overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      kpi.estado === 'VERDE' 
                        ? 'bg-emerald-400' 
                        : kpi.estado === 'AMARELO' 
                        ? 'bg-amber-400' 
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${kpi.progresso}%` }}
                  ></div>
                </div>
              )}
            </div>

          </div>
        );
      })}
    </div>
  );
}
