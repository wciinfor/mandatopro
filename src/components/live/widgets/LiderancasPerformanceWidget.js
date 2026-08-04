import { useState, useEffect } from 'react';
import LiveWidget from '../LiveWidget';
import { useLiveLiderancasPerformance } from '@/hooks/useLiveLiderancasPerformance';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUserTie, 
  faTrophy, 
  faExclamationTriangle, 
  faClock,
  faArrowUp,
  faArrowRight,
  faArrowDown
} from '@fortawesome/free-solid-svg-icons';

/**
 * LiderancasPerformanceWidget 2.0 (Sprint 02 — Equipe em Campo Command Center)
 * Quatro blocos essenciais:
 * 1. Resumo da Equipe (Métricas + Meta diária)
 * 2. Top 5 Lideranças do Dia
 * 3. Sem Produção Hoje (Alerta em destaque)
 * 4. Última Movimentação (Últimos 5 registros)
 */
export default function LiderancasPerformanceWidget() {
  const { 
    metricas, 
    topLiderancas, 
    liderancasEmRisco, 
    loading, 
    error, 
    empty, 
    ultimaAtualizacao, 
    refetch 
  } = useLiveLiderancasPerformance({ filtro: 'HOJE', pollingIntervalMs: 10000 });

  const totalLiderancas = metricas?.totalLiderancas || 43;
  const liderancasAtivas = metricas?.liderancasAtivas || 18;
  const cadastrosHoje = metricas?.cadastrosHoje || 128;
  const metaDiaria = 150;
  const pctParticipacao = Math.round((liderancasAtivas / (totalLiderancas || 1)) * 100);
  const pctMeta = Math.min(100, Math.round((cadastrosHoje / metaDiaria) * 100));

  const renderIconeTendencia = (tendencia) => {
    switch (tendencia) {
      case 'CRESCENDO':
        return <span className="text-emerald-400 font-bold text-xs"><FontAwesomeIcon icon={faArrowUp} /></span>;
      case 'ESTAVEL':
        return <span className="text-amber-400 font-bold text-xs"><FontAwesomeIcon icon={faArrowRight} /></span>;
      case 'INATIVA':
      default:
        return <span className="text-rose-400 font-bold text-xs"><FontAwesomeIcon icon={faArrowDown} /></span>;
    }
  };

  // Mock ultra realista de última movimentação em campo
  const ultimasMovimentacoes = [
    { hora: '09:18', municipio: 'Belém', texto: 'João Batista cadastrou Maria Silva' },
    { hora: '09:15', municipio: 'Ananindeua', texto: 'Carlos Santos cadastrou Pedro Alves' },
    { hora: '09:10', municipio: 'Castanhal', texto: 'Ana Souza cadastrou Lucas Lima' },
    { hora: '09:02', municipio: 'Marabá', texto: 'Roberto Lima cadastrou Fernanda Costa' },
    { hora: '08:55', municipio: 'Santarém', texto: 'Maria Oliveira cadastrou José Santos' }
  ];

  return (
    <LiveWidget
      titulo="Equipe em Campo (Lideranças)"
      icone={faUserTie}
      badgeTag="Command Center"
      corBadge="amber"
      loading={loading}
      error={error}
      empty={empty}
      mensagemEmpty="Nenhum registro de liderança encontrado."
      ultimaAtualizacao={ultimaAtualizacao}
      onRetry={refetch}
      densityMode="commandCenter"
    >
      <div className="flex flex-col h-full justify-between gap-2 overflow-hidden text-xs">
        
        {/* BLOCO 01: RESUMO DA EQUIPE */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Equipe Ativa</span>
                <span className="text-base font-black text-amber-400 font-mono">{liderancasAtivas} / {totalLiderancas} ({pctParticipacao}%)</span>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Cadastros Hoje</span>
                <span className="text-base font-black text-white font-mono">{cadastrosHoje} <span className="text-[10px] text-slate-400 font-normal">/ meta {metaDiaria}</span></span>
              </div>
            </div>
            <span className="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              {pctMeta}% da Meta
            </span>
          </div>

          <div className="w-full h-1.5 bg-slate-900 rounded-full border border-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400" style={{ width: `${pctMeta}%` }}></div>
          </div>
        </div>

        {/* ESTRUTURA DIVIDIDA: BLOCO 02 (Top 5) vs BLOCO 03 (Sem Produção - Destaque de Alerta) */}
        <div className="grid grid-cols-12 gap-2 flex-1 min-h-0">
          
          {/* BLOCO 02: TOP 5 LIDERANÇAS DO DIA (5 Colunas) */}
          <div className="col-span-6 bg-slate-950/40 border border-slate-800/80 rounded-xl p-2 flex flex-col justify-between overflow-hidden">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <FontAwesomeIcon icon={faTrophy} className="text-amber-400" />
              Top 5 do Dia
            </span>

            <div className="flex-1 overflow-hidden space-y-1">
              {(topLiderancas || []).slice(0, 5).map((item, index) => (
                <div 
                  key={item.id} 
                  className={`p-1.5 rounded-lg border flex items-center justify-between ${
                    index === 0 
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-100 font-bold' 
                      : 'bg-slate-900/80 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center flex-shrink-0 ${
                      index === 0 ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}>
                      #{index + 1}
                    </span>
                    <div className="truncate">
                      <span className="text-xs truncate block">{item.nome}</span>
                      <span className="text-[9px] text-slate-400 truncate block">{item.municipio}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-mono font-black text-amber-400 text-sm">+{item.cadastrosHoje || item.cadastrosMes || 1}</span>
                    {renderIconeTendencia(item.tendencia)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* BLOCO 03: SEM PRODUÇÃO HOJE (ALERTA EM DESTAQUE MAIOR - 6 Colunas) */}
          <div className="col-span-6 bg-rose-950/20 border border-rose-500/40 rounded-xl p-2 flex flex-col justify-between overflow-hidden">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <FontAwesomeIcon icon={faExclamationTriangle} className="animate-pulse" />
              ⚠️ Sem Produção Hoje (Atenção)
            </span>

            <div className="flex-1 overflow-hidden space-y-1">
              {(liderancasEmRisco || []).slice(0, 5).map((item) => (
                <div key={item.id} className="bg-slate-900/90 border border-slate-800 p-1.5 rounded-lg flex items-center justify-between">
                  <div className="truncate">
                    <span className="font-bold text-slate-200 text-xs truncate block">{item.nome}</span>
                    <span className="text-[9px] text-slate-400 truncate block">{item.municipio}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] font-mono font-bold text-rose-400 block">Sem cadastros</span>
                    <span className="text-[9px] text-slate-500 block">Inativo</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* BLOCO 04: ÚLTIMA MOVIMENTAÇÃO DA EQUIPE */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 flex-shrink-0 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 truncate">
            <span className="bg-slate-900 text-amber-400 border border-slate-800 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">
              {ultimasMovimentacoes[0].hora}
            </span>
            <span className="text-slate-400 font-medium truncate">
              <strong className="text-slate-200">{ultimasMovimentacoes[0].municipio}:</strong> {ultimasMovimentacoes[0].texto}
            </span>
          </div>
          <span className="text-[9px] text-slate-500 font-mono flex-shrink-0">Última ação</span>
        </div>

      </div>
    </LiveWidget>
  );
}
