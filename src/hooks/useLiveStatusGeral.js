import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook customizado desacoplado para consumir o Widget Status Geral do Mandato (Mission Status).
 * 
 * @param {Object} options
 * @param {number} options.pollingIntervalMs Intervalo de polling em ms (padrão: 15s)
 * @param {boolean} options.enabled Se o polling está ativo
 */
export function useLiveStatusGeral({ pollingIntervalMs = 15000, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  const timerRef = useRef(null);

  const fetchStatusData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/live/widgets/status-geral');
      if (!response.ok) {
        throw new Error(`Erro na API (${response.status})`);
      }
      const json = await response.json();
      setData(json);

      const agora = new Date();
      setUltimaAtualizacao(
        agora.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    } catch (err) {
      console.error('[useLiveStatusGeral] Erro ao sincronizar status do mandato:', err);
      setError(err.message || 'Falha ao sincronizar o status geral do mandato');
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    fetchStatusData(true);

    timerRef.current = setInterval(() => {
      fetchStatusData(false);
    }, pollingIntervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [fetchStatusData, pollingIntervalMs, enabled]);

  const refetch = useCallback(() => {
    fetchStatusData(true);
  }, [fetchStatusData]);

  return {
    statusData: data,
    loading,
    error,
    empty: !loading && !error && !data,
    ultimaAtualizacao,
    refetch
  };
}
