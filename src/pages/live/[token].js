import { useRouter } from 'next/router';
import Head from 'next/head';
import LiveLayout from '@/components/LiveLayout';
import { getActiveWidgets } from '@/components/live/LiveWidgetRegistry';
import LiveExperienceEngine from '@/components/live/experience/LiveExperienceEngine';
import DashboardLayoutEngine from '@/components/live/experience/DashboardLayoutEngine';

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
          <DashboardLayoutEngine widgets={widgets} />
        </LiveExperienceEngine>
      </LiveLayout>
    </>
  );
}
