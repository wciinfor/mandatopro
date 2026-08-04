import React, { useState, useEffect } from 'react';
import { LiveWidgetRegistry } from '../LiveWidgetRegistry';
import DashboardLayoutEngine from './DashboardLayoutEngine';

/**
 * Mapeamento dos Painéis (Views) do MandatoPRO Live
 */
export const VIEWS_LIVE = {
  OPERACAO: 'operacao',
  INTELIGENCIA: 'inteligencia',
  AUTO: 'auto'
};

/**
 * ViewEngine
 * Gerencia a alternância entre os Modos Operação, Inteligência e Auto (rotação a cada 40s).
 * Preserva o estado dos widgets sem re-montar os componentes ou duplicar requisições.
 */
export function ViewEngine({ modoInicial = VIEWS_LIVE.AUTO }) {
  const [modoAtivo, setModoAtivo] = useState(modoInicial);
  const [painelExibido, setPainelExibido] = useState(VIEWS_LIVE.OPERACAO);
  const [emTransicao, setEmTransicao] = useState(false);

  // Rotação Automática (Modo Auto: alterna a cada 40 segundos)
  useEffect(() => {
    if (modoAtivo !== VIEWS_LIVE.AUTO) {
      setPainelExibido(modoAtivo);
      return;
    }

    const timer = setInterval(() => {
      setEmTransicao(true);

      setTimeout(() => {
        setPainelExibido((atual) =>
          atual === VIEWS_LIVE.OPERACAO ? VIEWS_LIVE.INTELIGENCIA : VIEWS_LIVE.OPERACAO
        );
        setEmTransicao(false);
      }, 600); // Transição Fade de 600ms
    }, 40000); // 40 segundos

    return () => clearInterval(timer);
  }, [modoAtivo]);

  // Widgets do Modo Operação (Status Geral + Eleitores + Atividade + Mapa + Lideranças)
  const widgetsOperacao = [
    LiveWidgetRegistry.statusGeral,
    LiveWidgetRegistry.eleitores,
    LiveWidgetRegistry.atividadeTempoReal,
    LiveWidgetRegistry.mapa,
    LiveWidgetRegistry.liderancasPerformance
  ];

  // Widgets do Modo Inteligência (Status Geral + Inteligência + Radar Estratégico + Mapa)
  const widgetsInteligencia = [
    LiveWidgetRegistry.statusGeral,
    LiveWidgetRegistry.inteligencia,
    LiveWidgetRegistry.radarEstrategico,
    LiveWidgetRegistry.mapa
  ];

  const widgetsAtivos = painelExibido === VIEWS_LIVE.INTELIGENCIA ? widgetsInteligencia : widgetsOperacao;

  return (
    <div className="w-full h-full relative flex flex-col justify-between overflow-hidden">
      
      {/* Seletor Discreto de Modo de Painel (Header de Controle do Live) */}
      <div className="absolute top-2 right-4 z-40 flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-lg backdrop-blur">
        {[
          { id: VIEWS_LIVE.OPERACAO, label: 'Operação' },
          { id: VIEWS_LIVE.INTELIGENCIA, label: 'Inteligência' },
          { id: VIEWS_LIVE.AUTO, label: 'Auto (40s)' }
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setEmTransicao(true);
              setTimeout(() => {
                setModoAtivo(m.id);
                if (m.id !== VIEWS_LIVE.AUTO) setPainelExibido(m.id);
                setEmTransicao(false);
              }, 300);
            }}
            className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md transition-all ${
              modoAtivo === m.id
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Container de Layout com Animação Fade (600ms) */}
      <div
        className={`w-full h-full transition-opacity duration-600 ease-in-out ${
          emTransicao ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <DashboardLayoutEngine widgets={widgetsAtivos} />
      </div>

    </div>
  );
}

export default ViewEngine;
