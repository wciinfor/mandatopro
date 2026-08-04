import React, { useState, useEffect } from 'react';

/**
 * Envolve visualmente qualquer Widget e aplica efeitos de destaque temporários sem acoplamento
 */
export function WidgetHighlighter({ widgetId, children }) {
  const [highlighted, setHighlighted] = useState(false);

  useEffect(() => {
    const handleHighlight = (event) => {
      if (event.detail?.widgetId === widgetId) {
        setHighlighted(true);
        const timer = setTimeout(() => setHighlighted(false), 3000);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('live:widget-highlight', handleHighlight);
    return () => window.removeEventListener('live:widget-highlight', handleHighlight);
  }, [widgetId]);

  return (
    <div className={`h-full w-full transition-all duration-500 rounded-2xl ${
      highlighted ? 'ring-2 ring-emerald-400 shadow-xl shadow-emerald-950/50 scale-[1.005]' : ''
    }`}>
      {children}
    </div>
  );
}
