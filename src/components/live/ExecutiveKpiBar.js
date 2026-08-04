import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers, 
  faUserTie, 
  faBullhorn, 
  faHandsHelping, 
  faClipboardList, 
  faMapMarkerAlt, 
  faCalendarAlt,
  faComments
} from '@fortawesome/free-solid-svg-icons';

/**
 * Faixa de KPIs Executivos do MandatoPRO Live
 * Ocupa a posição horizontal logo abaixo do Mission Status Geral.
 * Responde instantaneamente às perguntas do parlamentar em menos de 3 segundos.
 */
export default function ExecutiveKpiBar({
  totalEleitores = 0,
  totalLiderancas = 0,
  campanhasAtivas = 0,
  totalAtendimentos = 0,
  solicitacoesAbertas = 0,
  municipiosAtendidos = 0,
  eventosHoje = 0,
  comunicacoesHoje = 0
}) {
  const kpis = [
    {
      id: 'eleitores',
      titulo: 'Eleitores',
      valor: totalEleitores || '—',
      icone: faUsers,
      cor: 'teal'
    },
    {
      id: 'liderancas',
      titulo: 'Lideranças',
      valor: totalLiderancas || '—',
      icone: faUserTie,
      cor: 'amber'
    },
    {
      id: 'campanhas',
      titulo: 'Campanhas Ativas',
      valor: campanhasAtivas || 0,
      icone: faBullhorn,
      cor: 'purple'
    },
    {
      id: 'atendimentos',
      titulo: 'Atendimentos',
      valor: totalAtendimentos || '—',
      icone: faHandsHelping,
      cor: 'blue'
    },
    {
      id: 'solicitacoes',
      titulo: 'Solicitações',
      valor: solicitacoesAbertas || 0,
      icone: faClipboardList,
      cor: 'sky'
    },
    {
      id: 'municipios',
      titulo: 'Municípios',
      valor: municipiosAtendidos || '—',
      icone: faMapMarkerAlt,
      cor: 'emerald'
    }
  ].filter((kpi) => kpi.valor !== '—' && kpi.valor !== undefined); // Ocultar cards sem informação

  const getCorClasses = (cor) => {
    switch (cor) {
      case 'teal': return 'border-teal-500/30 text-teal-400 bg-teal-500/10';
      case 'amber': return 'border-amber-500/30 text-amber-400 bg-amber-500/10';
      case 'purple': return 'border-purple-500/30 text-purple-400 bg-purple-500/10';
      case 'blue': return 'border-blue-500/30 text-blue-400 bg-blue-500/10';
      case 'sky': return 'border-sky-500/30 text-sky-400 bg-sky-500/10';
      case 'emerald': default: return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10';
    }
  };

  return (
    <div className="w-full flex items-center justify-between gap-3 flex-shrink-0">
      {kpis.map((kpi) => {
        const corClass = getCorClasses(kpi.cor);
        return (
          <div
            key={kpi.id}
            className="flex-1 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between shadow-lg backdrop-blur"
          >
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">
                {kpi.titulo}
              </span>
              <span className="text-xl font-black text-white font-mono leading-none mt-1 block">
                {kpi.valor}
              </span>
            </div>
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center text-sm flex-shrink-0 ${corClass}`}>
              <FontAwesomeIcon icon={kpi.icone} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
