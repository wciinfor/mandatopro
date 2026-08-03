import { useRouter } from 'next/router';
import Head from 'next/head';
import LiveLayout from '@/components/LiveLayout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers, 
  faBullhorn, 
  faHandsHelping, 
  faChartLine,
  faMapMarkedAlt,
  faBroadcastTower
} from '@fortawesome/free-solid-svg-icons';

export default function MandatoProLivePage() {
  const router = useRouter();
  const { token } = router.query;

  // Nome mock do parlamentar (estrutura pronta para backend futuro)
  const parlamentarNome = 'Dep. Gabinete Oficial';

  return (
    <>
      <Head>
        <title>MandatoPRO Live | TV Painel</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <LiveLayout token={token} parlamentarNome={parlamentarNome}>
        {/* Grid Responsivo Próprio para TV 16:9 */}
        <div className="h-full grid grid-cols-12 grid-rows-12 gap-6">
          
          {/* Card Container 1: Eleitores & Base (Top Left) */}
          <div className="col-span-4 row-span-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between backdrop-blur shadow-xl relative overflow-hidden group hover:border-teal-500/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold text-base uppercase tracking-wider flex items-center gap-2">
                <FontAwesomeIcon icon={faUsers} className="text-teal-400 text-lg" />
                Eleitores & Base
              </span>
              <span className="bg-slate-800 text-slate-400 text-xs px-2.5 py-1 rounded-full font-mono">
                Módulo
              </span>
            </div>
            
            {/* Slot para métricas futuras */}
            <div className="flex flex-col items-center justify-center flex-1 my-2 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <FontAwesomeIcon icon={faUsers} className="text-slate-700 text-4xl mb-2 opacity-50" />
              <p className="text-slate-500 text-sm font-medium">Container Eleitores</p>
            </div>

            <div className="text-xs text-slate-500 flex justify-between items-center pt-2 border-t border-slate-800/60">
              <span>Status: Aguardando SSE</span>
              <span className="text-teal-400 font-medium">Pronto</span>
            </div>
          </div>

          {/* Card Container 2: Atendimentos & Demandas (Top Center) */}
          <div className="col-span-4 row-span-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between backdrop-blur shadow-xl relative overflow-hidden group hover:border-blue-500/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold text-base uppercase tracking-wider flex items-center gap-2">
                <FontAwesomeIcon icon={faHandsHelping} className="text-blue-400 text-lg" />
                Atendimentos & Demandas
              </span>
              <span className="bg-slate-800 text-slate-400 text-xs px-2.5 py-1 rounded-full font-mono">
                Módulo
              </span>
            </div>

            {/* Slot para métricas futuras */}
            <div className="flex flex-col items-center justify-center flex-1 my-2 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <FontAwesomeIcon icon={faHandsHelping} className="text-slate-700 text-4xl mb-2 opacity-50" />
              <p className="text-slate-500 text-sm font-medium">Container Atendimentos</p>
            </div>

            <div className="text-xs text-slate-500 flex justify-between items-center pt-2 border-t border-slate-800/60">
              <span>Status: Aguardando SSE</span>
              <span className="text-blue-400 font-medium">Pronto</span>
            </div>
          </div>

          {/* Card Container 3: Campanhas Ativas (Top Right) */}
          <div className="col-span-4 row-span-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between backdrop-blur shadow-xl relative overflow-hidden group hover:border-purple-500/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold text-base uppercase tracking-wider flex items-center gap-2">
                <FontAwesomeIcon icon={faBullhorn} className="text-purple-400 text-lg" />
                Campanhas Ativas
              </span>
              <span className="bg-slate-800 text-slate-400 text-xs px-2.5 py-1 rounded-full font-mono">
                Módulo
              </span>
            </div>

            {/* Slot para métricas futuras */}
            <div className="flex flex-col items-center justify-center flex-1 my-2 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <FontAwesomeIcon icon={faBullhorn} className="text-slate-700 text-4xl mb-2 opacity-50" />
              <p className="text-slate-500 text-sm font-medium">Container Campanhas</p>
            </div>

            <div className="text-xs text-slate-500 flex justify-between items-center pt-2 border-t border-slate-800/60">
              <span>Status: Aguardando SSE</span>
              <span className="text-purple-400 font-medium">Pronto</span>
            </div>
          </div>

          {/* Card Container 4: Mapa & Geolocalização (Middle/Bottom Left - 8 Cols) */}
          <div className="col-span-8 row-span-8 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between backdrop-blur shadow-xl relative overflow-hidden group hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold text-base uppercase tracking-wider flex items-center gap-2">
                <FontAwesomeIcon icon={faMapMarkedAlt} className="text-emerald-400 text-lg" />
                Presença Territorial & Mapa
              </span>
              <span className="bg-slate-800 text-slate-400 text-xs px-2.5 py-1 rounded-full font-mono">
                Painel Principal
              </span>
            </div>

            {/* Slot para mapa futuro */}
            <div className="flex flex-col items-center justify-center flex-1 my-3 border border-dashed border-slate-800 rounded-xl bg-slate-950/50">
              <FontAwesomeIcon icon={faMapMarkedAlt} className="text-slate-700 text-6xl mb-3 opacity-40" />
              <p className="text-slate-400 text-base font-semibold">Container Mapa & Geolocalização</p>
              <p className="text-slate-600 text-xs mt-1">Otimizado para exibição em telas Full HD / 4K (3–5m)</p>
            </div>

            <div className="text-xs text-slate-500 flex justify-between items-center pt-2 border-t border-slate-800/60">
              <span>Token da Sessão: <code className="text-slate-400 font-mono">{token || 'token-demo-live'}</code></span>
              <span className="text-emerald-400 font-medium">Infraestrutura OK</span>
            </div>
          </div>

          {/* Card Container 5: Desempenho & Metas (Middle/Bottom Right - 4 Cols) */}
          <div className="col-span-4 row-span-8 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between backdrop-blur shadow-xl relative overflow-hidden group hover:border-amber-500/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold text-base uppercase tracking-wider flex items-center gap-2">
                <FontAwesomeIcon icon={faChartLine} className="text-amber-400 text-lg" />
                Desempenho & Metas
              </span>
              <span className="bg-slate-800 text-slate-400 text-xs px-2.5 py-1 rounded-full font-mono">
                Painel Lateral
              </span>
            </div>

            {/* Slot para gráficos futuros */}
            <div className="flex flex-col items-center justify-center flex-1 my-3 border border-dashed border-slate-800 rounded-xl bg-slate-950/50">
              <FontAwesomeIcon icon={faChartLine} className="text-slate-700 text-5xl mb-2 opacity-40" />
              <p className="text-slate-500 text-sm font-medium">Container Gráficos & Ranking</p>
            </div>

            <div className="text-xs text-slate-500 flex justify-between items-center pt-2 border-t border-slate-800/60">
              <span>Atualização Tempo Real</span>
              <span className="text-amber-400 font-medium">Arquitetura Pronta</span>
            </div>
          </div>

        </div>
      </LiveLayout>
    </>
  );
}
