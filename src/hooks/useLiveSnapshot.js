import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook customizado desacoplado para consumir exclusivamente o LiveSnapshot.
 * HOTFIX H03 — Controle estrito de concorrência, requestId incremental e abort de in-flight.
 */
export function useLiveSnapshot({ pollingIntervalMs = 10000, enabled = true } = {}) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Referências para controle estrito de estado e concorrência
  const latestRequestIdRef = useRef(0);
  const activeControllerRef = useRef(null);
  const isFetchingRef = useRef(false);

  const fetchSnapshot = useCallback(async (isInitial = false) => {
    // 1. Evitar acumular requisições se já existir uma em andamento (in-flight)
    if (isFetchingRef.current) {
      return;
    }

    // 2. Abortar qualquer controller ativo pendente e cancelar requisições anteriores
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }

    // 3. Incrementar requestId para garantir que apenas a requisição mais recente atualize o estado
    const requestId = ++latestRequestIdRef.current;
    const controller = new AbortController();
    activeControllerRef.current = controller;
    isFetchingRef.current = true;

    if (isInitial) setLoading(true);

    // 4. Timeout sempre menor que o intervalo de polling (8s timeout para 10s polling)
    const timeoutDuration = Math.max(3000, pollingIntervalMs - 2000);
    const timeoutId = setTimeout(() => {
      if (latestRequestIdRef.current === requestId) {
        controller.abort();
      }
    }, timeoutDuration);

    try {
      const response = await fetch('/api/live/snapshot', { signal: controller.signal });
      clearTimeout(timeoutId);

      // Verificar se esta requisição ainda é a mais recente
      if (latestRequestIdRef.current !== requestId) return;

      if (!response.ok) throw new Error(`Erro na API (${response.status})`);
      const json = await response.json();

      // Verificar novamente após parse assíncrono do JSON
      if (latestRequestIdRef.current === requestId) {
        setSnapshot(json);
        setError(null); // Sucesso limpa explicitamente qualquer erro antigo
      }
    } catch (err) {
      clearTimeout(timeoutId);

      // Se a requisição foi cancelada por ser antiga ou por nova busca, ignorar o erro silenciosamente
      if (latestRequestIdRef.current !== requestId) return;

      if (err.name === 'AbortError') {
        console.warn(`[useLiveSnapshot] Request #${requestId} abortado por timeout (${timeoutDuration}ms).`);
        setError('Tempo limite atingido na sincronização');
      } else {
        console.error(`[useLiveSnapshot] Erro na request #${requestId}:`, err);
        setError(err.message || 'Falha ao sincronizar snapshot');
      }
    } finally {
      if (latestRequestIdRef.current === requestId) {
        if (isInitial) setLoading(false);
        isFetchingRef.current = false;
        activeControllerRef.current = null;
      }
    }
  }, [pollingIntervalMs]);

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

  return {
    snapshot,
    kpisExecutivos: snapshot?.kpisExecutivos || null,
    healthReport: snapshot?.healthReport || null,
    loading,
    error,
    refetch: () => fetchSnapshot(true)
  };
}
