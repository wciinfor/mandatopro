import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook customizado desacoplado para consumir o Widget Performance das Lideranças.
 * 
 * @param {Object} options
 * @param {string} options.filtro Filtro de período ('HOJE' | 'SEMANA' | 'MES' | 'ANO')
 * @param {number} options.pollingIntervalMs Intervalo de polling em ms (padrão: 15s)
 * @param {boolean} options.enabled Se o polling está ativo
 */
export function useLiveLiderancasPerformance({ 
  filtro = 'MES', 
  pollingIntervalMs = 15000, 
  enabled = true 
} = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  const timerRef = useRef(null);

  const fetchPerformanceData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/live/widgets/liderancas-performance?filtro=${filtro}`);
      if (!response.ok) {
        throw new Error(`Erro na API (${response.status})`);
      }
      const json = await response.json();
      setData(json);

      // Formatar hora da última sincronização
      const agora = new Date();
      setUltimaAtualizacao(
        agora.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    } catch (err) {
      console.error('[useLiveLiderancasPerformance] Erro na busca de performance:', err);
      setError(err.message || 'Falha ao sincronizar performance');
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, [filtro]);

  useEffect(() => {
    if (!enabled) return;

    fetchPerformanceData(true);

    timerRef.current = setInterval(() => {
      fetchPerformanceData(false);
    }, pollingIntervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [fetchPerformanceData, pollingIntervalMs, enabled]);

  const refetch = useCallback(() => {
    fetchPerformanceData(true);
  }, [fetchPerformanceData]);

  return {
    metricas: data?.metricas || null,
    topLiderancas: data?.topLiderancas || [],
    liderancasEmRisco: data?.liderancasEmRisco || [],
    loading,
    error,
    empty: !loading && !error && (!data?.topLiderancas || data.topLiderancas.length === 0),
    ultimaAtualizacao,
    refetch
  };
}
