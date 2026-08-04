import React from 'react';
import { useLiveSnapshot } from '@/hooks/useLiveSnapshot';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
  faUserTie,
  faChartLine,
  faMapMarkedAlt,
  faBullhorn,
  faHandshake,
  faFileAlt,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';

/**
 * ExecutiveKpiBar 2.0 (Sprint D04.1 — Executive KPI Bar com Dados Reais do LiveSnapshot)
 * Consome exclusivamente a API /api/live/snapshot.
 */
export default function ExecutiveKpiBar() {
  const { kpisExecutivos, healthReport, loading, error } = useLiveSnapshot({ pollingIntervalMs: 10000 });

  if (loading && !kpisExecutivos) {
    return (
      <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center text-xs text-slate-400 font-mono animate-pulse">
        Sincronizando KPIs Executivos com o Snapshot...
      </div>
    );
  }

  const isDataIncomplete = !kpisExecutivos || error;
  const isHealthWarning = healthReport && (healthReport.status === 'WARNING' || healthReport.status === 'CRITICAL');

  // Metricas Reais consumidas exclusivamente do Snapshot
  const totalEleitores = kpisExecutivos?.totalEleitores;
  const cadastrosHoje = kpisExecutivos?.cadastrosHoje;
  const liderancasAtivasHoje = kpisExecutivos?.liderancasAtivasHoje;
  const totalLiderancas = kpisExecutivos?.totalLiderancas;
  const metaDiaria = kpisExecutivos?.metaDiaria || 150;
  const municipiosAtendidos = kpisExecutivos?.municipiosAtendidos;
  const totalMunicipiosEstado = kpisExecutivos?.totalMunicipiosEstado || 144;
  const campanhasAtivas = kpisExecutivos?.campanhasAtivas;
  const campanhasMes = kpisExecutivos?.campanhasMes;
  const atendimentosPendentes = kpisExecutivos?.atendimentosPendentes;
  const atendimentosConcluidosHoje = kpisExecutivos?.atendimentosConcluidosHoje;
  const solicitacoesPendentes = kpisExecutivos?.solicitacoesPendentes;
  const solicitacoesResolvidasHoje = kpisExecutivos?.solicitacoesResolvidasHoje;

  // Calculos e estados visuais
  const pctEquipe = totalLiderancas ? Math.round((liderancasAtivasHoje / totalLiderancas) * 100) : 0;
  const pctMeta = Math.min(100, Math.round(((cadastrosHoje || 0) / metaDiaria) * 100));
  const pctCobertura = Math.round(((municipiosAtendidos || 0) / totalMunicipiosEstado) * 100);

  const getEstadoVisual = (valor, limiteBaixo, limiteAlto) => {
    if (valor === undefined || valor === null) return { cor: 'text-slate-500', icone: '⚪' };
    if (valor >= limiteAlto) return { cor: 'text-emerald-400', icone: '🟢' };
    if (valor >= limiteBaixo) return { cor: 'text-amber-400', icone: '🟡' };
    return { cor: 'text-rose-400', icone: '🔴' };
  };

  const estadoEquipe = getEstadoVisual(pctEquipe, 30, 60);
  const estadoMeta = getEstadoVisual(pctMeta, 50, 80);
  const estadoAtendimentos = atendimentosPendentes < 20 ? { cor: 'text-emerald-400', icone: '🟢' } : { cor: 'text-amber-400', icone: '🟡' };

  return (
    <div className="w-full bg-slate-950/90 border border-slate-800/90 rounded-xl p-2.5 shadow-2xl relative">
      
      {/* ALERTA DISCRETO DE DADOS EM SINCRONIZAÇÃO CASO O HEALTH SEJA WARNING OU CRITICAL */}
      {isHealthWarning && (
        <div className="absolute -top-2.5 right-4 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur z-10">
          <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-400 animate-pulse" />
          ⚠ Dados em sincronização
        </div>
      )}

      <div className="grid grid-cols-7 gap-2 text-xs">
        
        {/* KPI 1: Base Eleitoral */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-2 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <FontAwesomeIcon icon={faUsers} className="text-emerald-400" />
              Base Eleitoral
            </span>
            <span className="text-[10px]">🟢</span>
          </div>
          <div className="my-1">
            <span className="text-lg font-black text-white font-mono block">
              {totalEleitores !== undefined ? totalEleitores.toLocaleString('pt-BR') : 'Dado indisponível'}
            </span>
          </div>
          <span className="text-[9px] font-bold text-emerald-400">
            +{cadastrosHoje !== undefined ? cadastrosHoje : 0} hoje
          </span>
        </div>

        {/* KPI 2: Equipe em Campo */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-2 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <FontAwesomeIcon icon={faUserTie} className="text-amber-400" />
              Equipe em Campo
            </span>
            <span className="text-[10px]">{estadoEquipe.icone}</span>
          </div>
          <div className="my-1">
            <span className="text-lg font-black text-white font-mono block">
              {liderancasAtivasHoje !== undefined ? `${liderancasAtivasHoje} / ${totalLiderancas}` : 'Dado indisponível'}
            </span>
          </div>
          <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden border border-slate-800">
            <div className="bg-amber-400 h-full rounded-full" style={{ width: `${pctEquipe}%` }}></div>
          </div>
          <span className="text-[9px] text-slate-400 font-medium mt-1">
            {pctEquipe}% da equipe hoje
          </span>
        </div>

        {/* KPI 3: Produção do Dia */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-2 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <FontAwesomeIcon icon={faChartLine} className="text-teal-300" />
              Produção do Dia
            </span>
            <span className="text-[10px]">{estadoMeta.icone}</span>
          </div>
          <div className="my-1">
            <span className="text-lg font-black text-white font-mono block">
              {cadastrosHoje !== undefined ? `${cadastrosHoje} cad.` : 'Dado indisponível'}
            </span>
          </div>
          <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden border border-slate-800">
            <div className="bg-teal-400 h-full rounded-full" style={{ width: `${pctMeta}%` }}></div>
          </div>
          <span className="text-[9px] text-slate-400 font-medium mt-1">
            Meta: {metaDiaria} ({pctMeta}%)
          </span>
        </div>

        {/* KPI 4: Cobertura Territorial */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-2 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <FontAwesomeIcon icon={faMapMarkedAlt} className="text-indigo-400" />
              Cobertura
            </span>
            <span className="text-[10px]">🟢</span>
          </div>
          <div className="my-1">
            <span className="text-lg font-black text-white font-mono block">
              {municipiosAtendidos !== undefined ? `${municipiosAtendidos} mun.` : 'Dado indisponível'}
            </span>
          </div>
          <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden border border-slate-800">
            <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${pctCobertura}%` }}></div>
          </div>
          <span className="text-[9px] text-slate-400 font-medium mt-1">
            {pctCobertura}% do estado
          </span>
        </div>

        {/* KPI 5: Campanhas */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-2 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <FontAwesomeIcon icon={faBullhorn} className="text-purple-400" />
              Campanhas
            </span>
            <span className="text-[10px]">🟢</span>
          </div>
          <div className="my-1">
            <span className="text-lg font-black text-white font-mono block">
              {campanhasAtivas !== undefined ? `${campanhasAtivas} Ativas` : 'Dado indisponível'}
            </span>
          </div>
          <span className="text-[9px] text-slate-400 font-medium">
            {campanhasMes} no mês
          </span>
        </div>

        {/* KPI 6: Atendimentos */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-2 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <FontAwesomeIcon icon={faHandshake} className="text-blue-400" />
              Atendimentos
            </span>
            <span className="text-[10px]">{estadoAtendimentos.icone}</span>
          </div>
          <div className="my-1">
            <span className="text-lg font-black text-white font-mono block">
              {atendimentosPendentes !== undefined ? `${atendimentosPendentes} Pend.` : 'Dado indisponível'}
            </span>
          </div>
          <span className="text-[9px] text-emerald-400 font-bold">
            {atendimentosConcluidosHoje} concluídos hoje
          </span>
        </div>

        {/* KPI 7: Solicitações */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-2 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <FontAwesomeIcon icon={faFileAlt} className="text-rose-400" />
              Solicitações
            </span>
            <span className="text-[10px]">🟢</span>
          </div>
          <div className="my-1">
            <span className="text-lg font-black text-white font-mono block">
              {solicitacoesPendentes !== undefined ? `${solicitacoesPendentes} Pend.` : 'Dado indisponível'}
            </span>
          </div>
          <span className="text-[9px] text-emerald-400 font-bold">
            {solicitacoesResolvidasHoje} resolvidas hoje
          </span>
        </div>

      </div>
    </div>
  );
}
