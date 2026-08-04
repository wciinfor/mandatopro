import React from 'react';
import ExecutiveKpiBar from '../ExecutiveKpiBar';
import { useLiveEleitores } from '@/hooks/useLiveEleitores';
import { useLiveLiderancasPerformance } from '@/hooks/useLiveLiderancasPerformance';
import { useLiveMapaCalor } from '@/hooks/useLiveMapaCalor';

/**
 * DashboardLayoutEngine
 * Hierarquia Executiva:
 * 1. Mission Status (Topo 100%)
 * 2. Executive KPIs Bar (Faixa de Números Chave)
 * 3. Painel Operacional / Estratégico (Sem Scroll)
 */
export function DashboardLayoutEngine({ widgets = [] }) {
  // Coletar indicadores globais para a ExecutiveKpiBar sem requisições adicionais (reutilização)
  const { metricas: eleitoresMetricas } = useLiveEleitores({ pollingIntervalMs: 20000 });
  const { metricas: liderancasMetricas } = useLiveLiderancasPerformance({ pollingIntervalMs: 20000 });
  const { metricasTerritoriais } = useLiveMapaCalor({ pollingIntervalMs: 20000 });

  return (
    <div className="w-full h-full flex flex-col justify-between gap-3 overflow-hidden p-1 bg-slate-950">
      
      {/* 1º STATUS GERAL (Mission Status) */}
      <div className="w-full flex-shrink-0">
        {widgets
          .filter((w) => w.id === 'statusGeral')
          .map((w) => {
            const WidgetComp = w.component;
            return <WidgetComp key={w.id} />;
          })}
      </div>

      {/* 2º KPIs EXECUTIVOS (Faixa Horizontal de Resposta Instantânea) */}
      <ExecutiveKpiBar
        totalEleitores={eleitoresMetricas?.totalEleitores}
        totalLiderancas={liderancasMetricas?.totalLiderancas}
        campanhasAtivas={2}
        totalAtendimentos={148}
        solicitacoesAbertas={12}
        municipiosAtendidos={metricasTerritoriais?.municipiosComPresenca}
      />

      {/* 3º & 4º PAINÉIS OPERACIONAIS E ESTRATÉGICOS (Grid Ajustada sem Scroll) */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {widgets
          .filter((w) => w.id !== 'statusGeral')
          .map((w) => {
            const WidgetComp = w.component;
            // Ajustar larguras responsivas sem estouro de altura
            let colSpan = 'col-span-4';
            if (w.id === 'mapa' || w.id === 'liderancasPerformance' || w.id === 'radarEstrategico') {
              colSpan = 'col-span-6';
            }

            return (
              <div key={w.id} className={`${colSpan} h-full overflow-hidden flex flex-col`}>
                <WidgetComp />
              </div>
            );
          })}
      </div>

    </div>
  );
}

export default DashboardLayoutEngine;
