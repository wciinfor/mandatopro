import React, { useMemo } from 'react';

/**
 * DashboardLayoutEngine
 * Calcula e distribui automaticamente os widgets ocupando 100% da viewport (100vh x 100vw)
 * Elimina espaços mortos, scrollbars e foca na proporção baseada em peso.
 */
export function DashboardLayoutEngine({ widgets = [] }) {
  // Configuração de pesos e prioridades para distribuição proporcional
  const layoutCalculado = useMemo(() => {
    return widgets.map((w) => {
      // Atribuir peso e proporção com base no ID do widget
      let weightClass = 'col-span-4 h-full';
      if (w.id === 'statusGeral') {
        weightClass = 'col-span-12 h-auto max-h-[22vh]';
      } else if (w.id === 'eleitores' || w.id === 'atividadeTempoReal' || w.id === 'inteligencia') {
        weightClass = 'col-span-4 flex-1 min-h-[34vh]';
      } else if (w.id === 'mapa' || w.id === 'liderancasPerformance' || w.id === 'radarEstrategico') {
        weightClass = 'col-span-6 flex-1 min-h-[38vh]';
      }

      return {
        ...w,
        calculatedClass: weightClass
      };
    });
  }, [widgets]);

  return (
    <div className="w-full h-full flex flex-col justify-between gap-3 overflow-hidden p-1 bg-slate-950">
      
      {/* Linha 1: Status Geral de Topo (Ocupação total 100% largura) */}
      <div className="w-full flex-shrink-0">
        {layoutCalculado
          .filter((w) => w.id === 'statusGeral')
          .map((w) => {
            const WidgetComp = w.component;
            return <WidgetComp key={w.id} />;
          })}
      </div>

      {/* Linha 2: Grid Tripla Superior (Eleitores | Atividade | Inteligencia) */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {layoutCalculado
          .filter((w) => ['eleitores', 'atividadeTempoReal', 'inteligencia'].includes(w.id))
          .map((w) => {
            const WidgetComp = w.component;
            return (
              <div key={w.id} className="col-span-4 h-full overflow-hidden flex flex-col">
                <WidgetComp />
              </div>
            );
          })}
      </div>

      {/* Linha 3: Grid Dupla Inferior (Mapa | Lideranças / Radar) */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {layoutCalculado
          .filter((w) => ['mapa', 'liderancasPerformance', 'radarEstrategico'].includes(w.id))
          .slice(0, 2)
          .map((w) => {
            const WidgetComp = w.component;
            return (
              <div key={w.id} className="col-span-6 h-full overflow-hidden flex flex-col">
                <WidgetComp />
              </div>
            );
          })}
      </div>

    </div>
  );
}

export default DashboardLayoutEngine;
