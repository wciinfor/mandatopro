import { useRouter } from 'next/router';
import Head from 'next/head';
import LiveLayout from '@/components/LiveLayout';
import { getActiveWidgets } from '@/components/live/LiveWidgetRegistry';
import LiveExperienceEngine from '@/components/live/experience/LiveExperienceEngine';

export default function MandatoProLivePage() {
  const router = useRouter();
  const { token } = router.query;

  // Lista de widgets registrados e configurados no sistema
  const widgets = getActiveWidgets();

  // Nome mock do parlamentar (estrutura pronta para backend futuro)
  const parlamentarNome = 'Dep. Gabinete Oficial';

  return (
    <>
      <Head>
        <title>MandatoPRO Live | TV Painel</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <LiveLayout token={token} parlamentarNome={parlamentarNome}>
        <LiveExperienceEngine>
          {/* Grid Responsivo 16:9 de Widgets Desacoplados */}
          <div className="h-full grid grid-cols-12 grid-rows-12 gap-6">
            {widgets.map((widgetItem) => {
              const WidgetComponent = widgetItem.component;
              return (
                <div key={widgetItem.id} className={widgetItem.gridClass}>
                  <WidgetComponent />
                </div>
              );
            })}
          </div>
        </LiveExperienceEngine>
      </LiveLayout>
    </>
  );
}
