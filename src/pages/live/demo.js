import { useState, useEffect } from 'react';
import Head from 'next/head';
import LiveLayout from '@/components/LiveLayout';
import LiveExperienceEngine from '@/components/live/experience/LiveExperienceEngine';
import DemoControlPanel from '@/components/live/experience/DemoControlPanel';
import { CENARIOS_DEMO, gerarDadosCenario, sortearEventoDemo } from '@/components/live/experience/SimulationEngine';
import { getActiveWidgets } from '@/components/live/LiveWidgetRegistry';

export default function MandatoProLiveDemoPage() {
  const [emExecucao, setEmExecucao] = useState(true);
  const [velocidade, setVelocidade] = useState('NORMAL'); // 'PAUSADO' | 'NORMAL' | 'ACELERADO' | 'DEMO'
  const [cenarioAtual, setCenarioAtual] = useState(CENARIOS_DEMO.EXCELENTE);
  const [tempoExecucaoSegundos, setTempoExecucaoSegundos] = useState(0);
  const [totalEventosGerados, setTotalEventosGerados] = useState(0);

  const widgets = getActiveWidgets();
  const parlamentarNome = 'Dep. Gabinete Oficial (Modo UX Lab Demo)';

  // Timer de simulação contínua de eventos realistas
  useEffect(() => {
    if (!emExecucao || velocidade === 'PAUSADO') return;

    let intervaloMs = 4000;
    if (velocidade === 'ACELERADO') intervaloMs = 2000;
    if (velocidade === 'DEMO') intervaloMs = 800;

    const timer = setInterval(() => {
      setTempoExecucaoSegundos((t) => t + 1);
      setTotalEventosGerados((e) => e + 1);

      // Disparar evento de simulação desacoplado
      if (typeof window !== 'undefined') {
        const eventoSorteado = sortearEventoDemo();
        window.dispatchEvent(new CustomEvent('live:demo-event', { detail: eventoSorteado }));
      }
    }, intervaloMs);

    return () => clearInterval(timer);
  }, [emExecucao, velocidade]);

  const handleReset = () => {
    setTempoExecucaoSegundos(0);
    setTotalEventosGerados(0);
  };

  return (
    <>
      <Head>
        <title>MandatoPRO Live | UX Lab Demo Oficial</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <LiveLayout token="demo-ux-lab" parlamentarNome={parlamentarNome}>
        <LiveExperienceEngine modoTv={true}>
          
          {/* Grid Principal de Widgets */}
          <div className="h-full grid grid-cols-12 grid-rows-12 gap-6 pb-12">
            {widgets.map((widgetItem) => {
              const WidgetComponent = widgetItem.component;
              return (
                <div key={widgetItem.id} className={widgetItem.gridClass}>
                  <WidgetComponent />
                </div>
              );
            })}
          </div>

          {/* Painel de Controle de Simulação UX Lab */}
          <DemoControlPanel
            emExecucao={emExecucao}
            onToggleExecucao={() => setEmExecucao(!emExecucao)}
            onReset={handleReset}
            velocidade={velocidade}
            onChangeVelocidade={setVelocidade}
            cenarioAtual={cenarioAtual}
            onChangeCenario={setCenarioAtual}
            tempoExecucaoSegundos={tempoExecucaoSegundos}
            totalEventosGerados={totalEventosGerados}
          />

        </LiveExperienceEngine>
      </LiveLayout>
    </>
  );
}
