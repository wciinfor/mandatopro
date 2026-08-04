import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook customizado desacoplado para consumir exclusivamente o LiveSnapshot.
 */
export function useLiveSnapshot({ pollingIntervalMs = 10000, enabled = true } = {}) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const fetchSnapshot = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch('/api/live/snapshot', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Erro na API (${response.status})`);
      const json = await response.json();
      setSnapshot(json);
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('[useLiveSnapshot] Erro ao buscar snapshot:', err);
      setError(err.name === 'AbortError' ? 'Tempo limite atingido na sincronização' : (err.message || 'Falha ao sincronizar snapshot'));
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    fetchSnapshot(true);
    const interval = setInterval(() => fetchSnapshot(false), pollingIntervalMs);
    return () => clearInterval(interval);
  }, [pollingIntervalMs, enabled]);

  return {
    snapshot,
    kpisExecutivos: snapshot?.kpisExecutivos || null,
    healthReport: snapshot?.healthReport || null,
    loading,
    error,
    refetch: () => fetchSnapshot(true)
  };
}
