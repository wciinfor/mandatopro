import React, { useState, useEffect } from 'react';
import LiveWidget from '../LiveWidget';
import { useLiveInteligencia } from '@/hooks/useLiveInteligencia';
import { useLiveMapaCalor } from '@/hooks/useLiveMapaCalor';
import MapaWidget from './MapaWidget';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChess, 
  faExclamationTriangle, 
  faLightbulb, 
  faBullseye,
  faMapMarkerAlt
} from '@fortawesome/free-solid-svg-icons';

/**
 * SalaDeSituacaoWidget 2.0 (Sprint UX — Mapa Estratégico)
 * Coluna Esquerda: Diagnóstico Estratégico (Maior Alerta, Maior Oportunidade, Recomendação Prioritária)
 * Coluna Direita: Mapa de Calor Integrado Orientado à Decisão com Destaque Automático do Município do Alerta.
 */
export default function SalaDeSituacaoWidget() {
  const { insights } = useLiveInteligencia({ pollingIntervalMs: 15000 });
  const { municipios } = useLiveMapaCalor({ pollingIntervalMs: 15000 });

  const insightsArray = insights || [];
  const municipiosArray = municipios || [];

  // 1. Maior Alerta Estratégico
  const maiorAlerta = insightsArray.find(i => i && (i.tipo === 'ALERTA' || i.prioridade === 'CRITICA')) || {
    titulo: 'Queda no Ritmo de Cadastros',
    descricao: 'Castanhal e municípios vizinhos apresentaram retração no ritmo de cadastros.',
    municipioFoco: 'Castanhal'
  };

  // 2. Maior Oportunidade
  const maiorOportunidade = insightsArray.find(i => i && i.tipo === 'OPORTUNIDADE') || {
    titulo: 'Expansão em Municípios sem Liderança',
    descricao: 'Identificado interesse espontâneo em Ananindeua sem estrutura formal.',
    municipioFoco: 'Ananindeua'
  };

  // Seleção automática do município em destaque (sem necessidade de clique)
  const municipioAlertaNome = maiorAlerta?.municipioFoco || 'Castanhal';
  const municipioDestaque = municipiosArray.find(m => m && m.nome?.toLowerCase() === municipioAlertaNome.toLowerCase()) || {
    nome: municipioAlertaNome,
    totalEleitores: 12450,
    cadastrosMes: 45,
    liderancasCount: 0,
    classificacao: 'SEM_MOVIMENTACAO'
  };

  return (
    <LiveWidget
      titulo="Sala de Situação & Decisão Estratégica"
      icone={faChess}
      badgeTag="Mapa Estratégico"
      corBadge="purple"
      densityMode="commandCenter"
    >
      <div className="grid grid-cols-12 gap-3 h-full overflow-hidden text-xs">
        
        {/* COLUNA ESQUERDA (5 Colunas): Diagnóstico Estratégico (Sem Radar / Sem Missão do Dia) */}
        <div className="col-span-5 flex flex-col justify-between gap-2.5 h-full overflow-hidden">
          
          {/* 1. Maior Alerta */}
          <div className="bg-rose-950/30 border border-rose-500/50 p-3 rounded-xl flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <FontAwesomeIcon icon={faExclamationTriangle} className="animate-pulse" />
                1. Maior Alerta Estratégico
              </span>
              <span className="bg-rose-500/20 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Crítico
              </span>
            </div>
            <div>
              <h4 className="text-slate-100 font-bold text-sm mt-1">{maiorAlerta.titulo}</h4>
              <p className="text-slate-300 text-xs mt-0.5">{maiorAlerta.descricao}</p>
            </div>
            <div className="mt-2 text-[10px] text-rose-400 font-bold flex items-center gap-1">
              <FontAwesomeIcon icon={faMapMarkerAlt} />
              Foco do Alerta: {municipioAlertaNome}
            </div>
          </div>

          {/* 2. Maior Oportunidade */}
          <div className="bg-emerald-950/30 border border-emerald-500/50 p-3 rounded-xl flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <FontAwesomeIcon icon={faLightbulb} />
                2. Maior Oportunidade
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Oportunidade
              </span>
            </div>
            <div>
              <h4 className="text-slate-100 font-bold text-sm mt-1">{maiorOportunidade.titulo}</h4>
              <p className="text-slate-300 text-xs mt-0.5">{maiorOportunidade.descricao}</p>
            </div>
          </div>

          {/* 3. Recomendação Prioritária */}
          <div className="bg-slate-950/80 border border-teal-500/40 p-3 rounded-xl flex-shrink-0">
            <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <FontAwesomeIcon icon={faBullseye} />
              Recomendação Executiva Automática:
            </span>
            <span className="text-slate-200 font-semibold block text-xs">
              {`Intervenção e ação de campo imediata em ${municipioAlertaNome}.`}
            </span>
          </div>

        </div>

        {/* COLUNA DIREITA (7 Colunas): MAPA DE CALOR ORIENTADO À DECISÃO COM DESTAQUE AUTOMÁTICO */}
        <div className="col-span-7 h-full overflow-hidden flex flex-col relative">
          <MapaWidget />

          {/* TOOLTIP / BANNER DE DESTAQUE AUTOMÁTICO DO MUNICÍPIO DO ALERTA (SEM NECESSIDADE DE CLIQUE) */}
          <div className="absolute bottom-2 left-2 right-2 bg-slate-950/95 border-2 border-rose-500 p-3 rounded-xl backdrop-blur shadow-2xl z-30 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                <h4 className="text-sm font-black text-white uppercase tracking-wider">
                  {municipioDestaque.nome} (Foco Automático)
                </h4>
              </div>
              <p className="text-[11px] text-rose-300 font-medium mt-0.5">
                Recomendação: Nomear liderança local e agendar visita institucional.
              </p>
            </div>

            <div className="flex items-center gap-3 text-right font-mono text-xs flex-shrink-0">
              <div>
                <span className="text-[9px] text-slate-400 block uppercase font-bold">Eleitores</span>
                <span className="font-bold text-white">{municipioDestaque.totalEleitores}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 block uppercase font-bold">Lideranças</span>
                <span className="font-bold text-amber-400">{municipioDestaque.liderancasCount}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </LiveWidget>
  );
}
