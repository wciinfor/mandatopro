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

  const isModoEstrategico = widgets.some(w => w.id === 'salaDeSituacao');

  return (
    <div className="w-full h-full flex flex-col justify-between gap-3 overflow-hidden p-1 bg-slate-950">
      
      {/* 1º STATUS GERAL (Mission Status Completo na View 01 ou Compacto na View 02) */}
      <div className="w-full flex-shrink-0">
        {widgets
          .filter((w) => w.id === 'statusGeral' || w.id === 'statusCompacto')
          .map((w) => {
            const WidgetComp = w.component;
            return <WidgetComp key={w.id} />;
          })}
      </div>

      {/* 2º KPIs EXECUTIVOS 2.0 (Exibidos apenas no Painel Executivo Operacional - View 01) */}
      {!isModoEstrategico && (
        <ExecutiveKpiBar
          totalEleitores={eleitoresMetricas?.totalEleitores}
          cadastrosHoje={eleitoresMetricas?.cadastrosHoje || 128}
          liderancasAtivasHoje={liderancasMetricas?.liderancasAtivas || 18}
          totalLiderancas={liderancasMetricas?.totalLiderancas || 43}
          metaDiaria={150}
          municipiosAtendidos={metricasTerritoriais?.municipiosComPresenca || 44}
          totalMunicipiosEstado={metricasTerritoriais?.totalMunicipiosPA || 144}
          campanhasAtivas={2}
          campanhasMes={3}
          atendimentosPendentes={14}
          atendimentosConcluidosHoje={38}
          solicitacoesPendentes={6}
          solicitacoesResolvidasHoje={12}
        />
      )}

      {/* 3º PAINÉIS DE CONTEÚDO (Grid Operacional na View 01 vs Sala de Situação na View 02) */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {widgets
          .filter((w) => w.id !== 'statusGeral' && w.id !== 'statusCompacto')
          .map((w) => {
            const WidgetComp = w.component;
            let colSpan = 'col-span-4';
            if (w.id === 'salaDeSituacao') {
              colSpan = 'col-span-12';
            } else if (w.id === 'mapa' || w.id === 'liderancasPerformance' || w.id === 'radarEstrategico') {
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
