import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook customizado desacoplado para consumir o Widget Centro de Inteligência Estratégica.
 * 
 * @param {Object} options
 * @param {number} options.pollingIntervalMs Intervalo de polling em ms (padrão: 15s)
 * @param {boolean} options.enabled Se o polling está ativo
 */
export function useLiveInteligencia({ pollingIntervalMs = 15000, enabled = true } = {}) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  const timerRef = useRef(null);

  const fetchInteligenciaData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/live/widgets/inteligencia');
      if (!response.ok) {
        throw new Error(`Erro na API (${response.status})`);
      }
      const json = await response.json();
      setInsights(Array.isArray(json?.insights) ? json.insights : []);

      const agora = new Date();
      setUltimaAtualizacao(
        agora.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    } catch (err) {
      console.error('[useLiveInteligencia] Erro ao buscar insights estratégicos:', err);
      setError(err.message || 'Falha ao sincronizar inteligência estratégica');
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    fetchInteligenciaData(true);

    timerRef.current = setInterval(() => {
      fetchInteligenciaData(false);
    }, pollingIntervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [fetchInteligenciaData, pollingIntervalMs, enabled]);

  const refetch = useCallback(() => {
    fetchInteligenciaData(true);
  }, [fetchInteligenciaData]);

  return {
    insights,
    loading,
    error,
    empty: !loading && !error && insights.length === 0,
    ultimaAtualizacao,
    refetch
  };
}
