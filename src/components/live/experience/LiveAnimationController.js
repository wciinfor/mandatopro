import { useState, useEffect } from 'react';

/**
 * Controller central para disparar animações e efeitos visuais
 */
export const LiveAnimationController = {
  triggerHighlight: (widgetId) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('live:widget-highlight', { detail: { widgetId } }));
    }
  },
  triggerCriticalAlert: (alertData) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('live:critical-alert', { detail: alertData }));
    }
  }
};
