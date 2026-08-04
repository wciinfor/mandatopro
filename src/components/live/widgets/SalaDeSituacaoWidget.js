import React from 'react';
import LiveWidget from '../LiveWidget';
import { useLiveInteligencia } from '@/hooks/useLiveInteligencia';
import { useLiveRadarEstrategico } from '@/hooks/useLiveRadarEstrategico';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChess, 
  faExclamationTriangle, 
  faLightbulb, 
  faSatellite, 
  faBullseye, 
  faTasks 
} from '@fortawesome/free-solid-svg-icons';

/**
 * SalaDeSituacaoWidget (View 02 Estratégica Consolidada)
 * Responde exclusivamente: "O que devemos fazer agora?"
 * Ordem rigorosa:
 * 1. Maior Alerta
 * 2. Maior Oportunidade
 * 3. Radar Estratégico (Preditivo)
 * 4. Recomendação Prioritária
 * 5. Missão do Dia
 */
export default function SalaDeSituacaoWidget() {
  const { insights } = useLiveInteligencia({ pollingIntervalMs: 15000 });
  const { previsoes, previsaoMaisCritica, indiceTendencia } = useLiveRadarEstrategico({ pollingIntervalMs: 15000 });

  // 1. Maior Alerta
  const maiorAlerta = insights.find(i => i.tipo === 'ALERTA' || i.prioridade === 'CRITICA') || {
    titulo: 'Triagem de Atendimentos Retidos',
    descricao: 'Existem solicitações pendentes há mais de 48h aguardando retorno do gabinete.'
  };

  // 2. Maior Oportunidade
  const maiorOportunidade = insights.find(i => i.tipo === 'OPORTUNIDADE') || {
    titulo: 'Expansão em Municípios sem Liderança',
    descricao: 'Identificado interesse espontâneo em 3 municípios da Região Metropolitana.'
  };

  return (
    <LiveWidget
      titulo="Sala de Situação & Decisão Estratégica"
      subtitulo="Análise executiva, antecipação de cenários e ordem de ação"
      icone={faChess}
      badgeTag="Decisão Estratégica"
      corBadge="purple"
      densityMode="commandCenter"
    >
      <div className="grid grid-cols-12 gap-3 h-full overflow-hidden text-xs">
        
        {/* Lado Esquerdo (6 Colunas): 1. Maior Alerta | 2. Maior Oportunidade | 4. Recomendação */}
        <div className="col-span-6 flex flex-col justify-between gap-2.5 h-full overflow-hidden">
          
          {/* 1. Maior Alerta */}
          <div className="bg-rose-950/30 border border-rose-500/40 p-3 rounded-xl flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <FontAwesomeIcon icon={faExclamationTriangle} className="animate-pulse" />
                1. Maior Alerta Operacional
              </span>
              <span className="bg-rose-500/20 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Crítico
              </span>
            </div>
            <div>
              <h4 className="text-slate-100 font-bold text-sm mt-1">{maiorAlerta.titulo}</h4>
              <p className="text-slate-300 text-xs mt-0.5">{maiorAlerta.descricao}</p>
            </div>
          </div>

          {/* 2. Maior Oportunidade */}
          <div className="bg-emerald-950/30 border border-emerald-500/40 p-3 rounded-xl flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <FontAwesomeIcon icon={faLightbulb} />
                2. Maior Oportunidade Estratégica
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

          {/* 4. Recomendação Prioritária */}
          <div className="bg-slate-950/80 border border-teal-500/40 p-3 rounded-xl flex-shrink-0">
            <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <FontAwesomeIcon icon={faBullseye} />
              4. Recomendação Prioritária da Semana
            </span>
            <span className="text-slate-200 font-semibold block text-xs">
              {maiorAlerta.recomendacao || 'Mobilizar equipe de campo para triagem e reforço nas regiões prioritárias.'}
            </span>
          </div>

        </div>

        {/* Lado Direito (6 Colunas): 3. Radar Estratégico | 5. Missão do Dia */}
        <div className="col-span-6 flex flex-col justify-between gap-2.5 h-full overflow-hidden">
          
          {/* 3. Radar Estratégico Preditivo */}
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl flex-1 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                <FontAwesomeIcon icon={faSatellite} />
                3. Radar Preditivo (Projeções)
              </span>
              <span className="text-[10px] font-mono text-teal-400 font-bold">
                Índice: {indiceTendencia} pts
              </span>
            </div>

            <div className="space-y-2 flex-1 overflow-hidden">
              {(previsoes || []).slice(0, 2).map((p) => (
                <div key={p.id} className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-bold text-slate-300">{p.tipo} • {p.categoria}</span>
                    <span>Horizonte: {p.horizonte}</span>
                  </div>
                  <h5 className="font-bold text-slate-100 text-xs mt-0.5">{p.titulo}</h5>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Missão do Dia */}
          <div className="bg-purple-950/30 border border-purple-500/40 p-3 rounded-xl flex-shrink-0 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <FontAwesomeIcon icon={faTasks} />
                5. Missão do Dia do Gabinete
              </span>
              <span className="text-slate-100 font-bold block text-xs mt-0.5">
                Alinhamento e despacho de demandas pendentes com coordenação geral.
              </span>
            </div>
            <span className="bg-purple-500/20 text-purple-300 text-[10px] font-bold px-2 py-1 rounded-lg border border-purple-500/30 flex-shrink-0">
              Prioridade #1
            </span>
          </div>

        </div>

      </div>
    </LiveWidget>
  );
}
