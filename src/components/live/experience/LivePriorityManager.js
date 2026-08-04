import React from 'react';

/**
 * Gerenciador visual de prioridade e destaques críticos
 */
export function LivePriorityManager({ children, isCritical = false }) {
  return (
    <div className={`transition-all duration-700 h-full w-full ${isCritical ? 'ring-2 ring-rose-500/80 shadow-2xl shadow-rose-950/40' : ''}`}>
      {children}
    </div>
  );
}
