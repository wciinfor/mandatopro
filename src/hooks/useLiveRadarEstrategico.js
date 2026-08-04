import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook customizado desacoplado para consumir o Widget Radar Estratégico (Inteligência Preditiva).
 * 
 * @param {Object} options
 * @param {number} options.pollingIntervalMs Intervalo de polling em ms (padrão: 15s)
 * @param {boolean} options.enabled Se o polling está ativo
 */
export function useLiveRadarEstrategico({ pollingIntervalMs = 15000, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  const timerRef = useRef(null);

  const fetchRadarData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/live/widgets/radar-estrategico');
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
      console.error('[useLiveRadarEstrategico] Erro ao sincronizar radar estratégico:', err);
      setError(err.message || 'Falha ao sincronizar inteligência preditiva do radar');
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    fetchRadarData(true);

    timerRef.current = setInterval(() => {
      fetchRadarData(false);
    }, pollingIntervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [fetchRadarData, pollingIntervalMs, enabled]);

  const refetch = useCallback(() => {
    fetchRadarData(true);
  }, [fetchRadarData]);

  return {
    radarData: data,
    previsoes: data?.previsoes || [],
    previsaoMaisCritica: data?.previsaoMaisCritica || null,
    distribuicao: data?.distribuicao || { riscos: 0, oportunidades: 0, tendencias: 0 },
    indiceTendencia: data?.indiceTendencia || 50,
    loading,
    error,
    empty: !loading && !error && (!data?.previsoes || data.previsoes.length === 0),
    ultimaAtualizacao,
    refetch
  };
}
