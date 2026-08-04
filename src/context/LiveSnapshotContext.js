import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

/**
 * Contexto Singleton do MandatoPRO Live.
 * Garante que exista estritamente UMA única requisição HTTP para /api/live/snapshot por ciclo de polling.
 */
const LiveSnapshotContext = createContext({
  snapshot: null,
  kpisExecutivos: null,
  healthReport: null,
  loading: true,
  error: null,
  refetch: () => {}
});

export function LiveSnapshotProvider({ children, pollingIntervalMs = 10000, enabled = true }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const latestRequestIdRef = useRef(0);
  const activeControllerRef = useRef(null);
  const isFetchingRef = useRef(false);

  const fetchSnapshot = useCallback(async (isInitial = false) => {
    if (isFetchingRef.current) return;

    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }

    const requestId = ++latestRequestIdRef.current;
    const controller = new AbortController();
    activeControllerRef.current = controller;
    isFetchingRef.current = true;

    if (isInitial && !snapshot) setLoading(true);

    const timeoutDuration = Math.max(3000, pollingIntervalMs - 2000);
    const timeoutId = setTimeout(() => {
      if (latestRequestIdRef.current === requestId) {
        controller.abort();
      }
    }, timeoutDuration);

    try {
      const response = await fetch('/api/live/snapshot', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (latestRequestIdRef.current !== requestId) return;
      if (!response.ok) throw new Error(`Erro na API (${response.status})`);

      const json = await response.json();

      if (latestRequestIdRef.current === requestId) {
        setSnapshot(json);
        setError(null);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (latestRequestIdRef.current !== requestId) return;

      if (err.name === 'AbortError') {
        setError('Tempo limite atingido na sincronização');
      } else {
        console.error(`[LiveSnapshotProvider] Erro na requisição #${requestId}:`, err);
        setError(err.message || 'Falha ao sincronizar snapshot');
      }
    } finally {
      if (latestRequestIdRef.current === requestId) {
        setLoading(false);
        isFetchingRef.current = false;
        activeControllerRef.current = null;
      }
    }
  }, [pollingIntervalMs, snapshot]);

  useEffect(() => {
    if (!enabled) return;
    fetchSnapshot(true);

    const interval = setInterval(() => {
      fetchSnapshot(false);
    }, pollingIntervalMs);

    return () => {
      clearInterval(interval);
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }
    };
  }, [pollingIntervalMs, enabled, fetchSnapshot]);

  const value = {
    snapshot,
    kpisExecutivos: snapshot?.kpisExecutivos || null,
    healthReport: snapshot?.healthReport || null,
    loading,
    error,
    refetch: () => fetchSnapshot(true)
  };

  return (
    <LiveSnapshotContext.Provider value={value}>
      {children}
    </LiveSnapshotContext.Provider>
  );
}

/**
 * Hook para consumo do Contexto Singleton do LiveSnapshot.
 */
export function useLiveSnapshotContext() {
  const context = useContext(LiveSnapshotContext);
  if (!context) {
    throw new Error('useLiveSnapshotContext deve ser utilizado dentro de um LiveSnapshotProvider');
  }
  return context;
}

/**
 * Manter compatibilidade com useLiveSnapshot
 */
export function useLiveSnapshot() {
  return useLiveSnapshotContext();
}
