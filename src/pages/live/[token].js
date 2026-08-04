import { useRouter } from 'next/router';
import Head from 'next/head';
import LiveLayout from '@/components/LiveLayout';
import LiveExperienceEngine from '@/components/live/experience/LiveExperienceEngine';
import ViewEngine from '@/components/live/experience/ViewEngine';

export default function MandatoProLivePage() {
  const router = useRouter();
  const { token } = router.query;

  // Nome mock do parlamentar (estrutura pronta para backend futuro)
  const parlamentarNome = 'Dep. Gabinete Oficial';

  return (
    <>
      <Head>
        <title>MandatoPRO Live | TV Painel Multi-View</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <LiveLayout token={token} parlamentarNome={parlamentarNome}>
        <LiveExperienceEngine>
          <ViewEngine modoInicial="auto" />
        </LiveExperienceEngine>
      </LiveLayout>
    </>
  );
}
