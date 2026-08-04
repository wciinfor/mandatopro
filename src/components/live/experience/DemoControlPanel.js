import React from 'react';
import { CENARIOS_DEMO } from './SimulationEngine';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faRedo, faTachometerAlt, faFlask } from '@fortawesome/free-solid-svg-icons';

export default function DemoControlPanel({
  emExecucao,
  onToggleExecucao,
  onReset,
  velocidade,
  onChangeVelocidade,
  cenarioAtual,
  onChangeCenario,
  tempoExecucaoSegundos,
  totalEventosGerados
}) {
  const formatarTempo = (seg) => {
    const min = Math.floor(seg / 60);
    const s = seg % 60;
    return `${min.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white border border-emerald-500/50 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur flex items-center gap-6">
      
      {/* Indicador UX Lab */}
      <div className="flex items-center gap-2 border-r border-slate-800 pr-4">
        <FontAwesomeIcon icon={faFlask} className="text-emerald-400 text-base animate-pulse" />
        <div>
          <span className="text-xs font-black text-emerald-400 uppercase tracking-wider block">UX Lab Demo</span>
          <span className="text-[10px] text-slate-400 font-mono">Modo Simulação</span>
        </div>
      </div>

      {/* Controles Play / Pause / Reset */}
      <div className="flex items-center gap-2 border-r border-slate-800 pr-4">
        <button
          onClick={onToggleExecucao}
          className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
            emExecucao 
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}
        >
          <FontAwesomeIcon icon={emExecucao ? faPause : faPlay} />
          {emExecucao ? 'Pausar' : 'Iniciar'}
        </button>

        <button
          onClick={onReset}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold"
        >
          <FontAwesomeIcon icon={faRedo} />
        </button>
      </div>

      {/* Seletor de Cenários Estratégicos */}
      <div className="border-r border-slate-800 pr-4">
        <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Cenário</span>
        <select
          value={cenarioAtual}
          onChange={(e) => onChangeCenario(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1 font-semibold focus:outline-none focus:border-emerald-500"
        >
          {Object.values(CENARIOS_DEMO).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Velocidade de Simulação */}
      <div className="border-r border-slate-800 pr-4">
        <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Velocidade</span>
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {[
            { id: 'PAUSADO', label: 'Pausa' },
            { id: 'NORMAL', label: '1x' },
            { id: 'ACELERADO', label: '2x' },
            { id: 'DEMO', label: '5x' }
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => onChangeVelocidade(v.id)}
              className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                velocidade === v.id ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-500'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Métricas do Run */}
      <div className="flex items-center gap-4 text-xs font-mono">
        <div>
          <span className="text-slate-500 text-[10px] block">Tempo</span>
          <span className="text-slate-200 font-bold">{formatarTempo(tempoExecucaoSegundos)}</span>
        </div>
        <div>
          <span className="text-slate-500 text-[10px] block">Eventos</span>
          <span className="text-emerald-400 font-bold">{totalEventosGerados}</span>
        </div>
      </div>

    </div>
  );
}
