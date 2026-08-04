import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTv, faSyncAlt, faCheckCircle, faClock } from '@fortawesome/free-solid-svg-icons';

import { LiveSnapshotProvider } from '@/context/LiveSnapshotContext';

export default function LiveLayout({ children, token, parlamentarNome = 'Mandato Parlamentar' }) {
  const [dataHora, setDataHora] = useState(new Date());

  // Relógio em tempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setDataHora(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatarData = (d) => {
    return d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatarHora = (d) => {
    return d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <LiveSnapshotProvider pollingIntervalMs={10000}>
      <div className="w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
        {/* Cabeçalho MandatoPRO Live */}
        <header className="h-20 px-8 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shadow-2xl flex-shrink-0">
          {/* Lado Esquerdo: Logo & Nome do Parlamentar */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg shadow-teal-500/20">
                <FontAwesomeIcon icon={faTv} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-teal-400 bg-clip-text text-transparent">
                    MandatoPRO
                  </span>
                  <span className="bg-teal-500/20 text-teal-300 text-xs font-black px-2.5 py-0.5 rounded-full border border-teal-500/30 uppercase tracking-widest">
                    Live
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-400">
                  {parlamentarNome}
                </p>
              </div>
            </div>
          </div>

          {/* Lado Direito: Data, Hora e Indicador em Tempo Real */}
          <div className="flex items-center gap-8">
            {/* Status / Atualização */}
            <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-lg text-sm font-semibold">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span>Atualizado agora</span>
            </div>

            {/* Relógio e Data */}
            <div className="text-right border-l border-slate-800 pl-8">
              <div className="text-2xl font-black font-mono tracking-wider text-teal-300">
                {formatarHora(dataHora)}
              </div>
              <div className="text-xs text-slate-400 font-medium capitalize">
                {formatarData(dataHora)}
              </div>
            </div>
          </div>
        </header>

        {/* Área Conteúdo Principal - Grid 16:9 */}
        <main className="flex-1 p-6 overflow-hidden">
          {children}
        </main>
      </div>
    </LiveSnapshotProvider>
  );
}
