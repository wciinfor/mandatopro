import React, { useEffect, useState } from 'react';
import { WidgetHighlighter } from './WidgetHighlighter';
import { WidgetTransitionManager } from './WidgetTransitionManager';
import { LivePriorityManager } from './LivePriorityManager';

/**
 * LiveExperienceEngine
 * Camada independente de visual & TV Experience para o MandatoPRO Live.
 * Não altera a lógica de nenhum widget, apenas enriquece a apresentação com animações e transições silenciosas.
 */
export function LiveExperienceEngine({ children, modoTv = true }) {
  const [alertaCriticoAtivo, setAlertaCriticoAtivo] = useState(null);

  useEffect(() => {
    const handleAlerta = (e) => {
      if (e.detail) {
        setAlertaCriticoAtivo(e.detail);
        const timer = setTimeout(() => setAlertaCriticoAtivo(null), 8000);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('live:critical-alert', handleAlerta);
    return () => window.removeEventListener('live:critical-alert', handleAlerta);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-slate-950">
      
      {/* Banner de Alerta Crítico Global Flutuante (Overhead TV) */}
      {alertaCriticoAtivo && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-rose-600/95 text-white border border-rose-400 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur flex items-center gap-3 animate-bounce">
          <span className="w-3 h-3 rounded-full bg-white animate-ping"></span>
          <span className="font-black text-sm uppercase tracking-wider">
            {alertaCriticoAtivo.titulo || 'Alerta Crítico no Gabinete'}
          </span>
        </div>
      )}

      {/* Conteúdo Principal do Painel */}
      <WidgetTransitionManager>
        <LivePriorityManager isCritical={!!alertaCriticoAtivo}>
          {children}
        </LivePriorityManager>
      </WidgetTransitionManager>

    </div>
  );
}

export default LiveExperienceEngine;
