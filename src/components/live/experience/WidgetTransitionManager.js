import React from 'react';

/**
 * Gerencia transições suaves entre estados dos widgets e rotação em telas 16:9 de TV
 */
export function WidgetTransitionManager({ children }) {
  return (
    <div className="h-full w-full transition-opacity duration-700 ease-in-out">
      {children}
    </div>
  );
}
