import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook customizado desacoplado para consumir o Widget Mapa de Calor da Base Eleitoral.
 * 
 * @param {Object} options
 * @param {number} options.pollingIntervalMs Intervalo de polling em ms (padrão: 20s)
 * @param {boolean} options.enabled Se o polling está ativo
 */
export function useLiveMapaCalor({ pollingIntervalMs = 20000, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  const timerRef = useRef(null);

  const fetchMapaData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/live/widgets/mapa-calor');
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
      console.error('[useLiveMapaCalor] Erro ao buscar dados do mapa de calor:', err);
      setError(err.message || 'Falha ao sincronizar mapa de calor');
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    fetchMapaData(true);

    timerRef.current = setInterval(() => {
      fetchMapaData(false);
    }, pollingIntervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [fetchMapaData, pollingIntervalMs, enabled]);

  const refetch = useCallback(() => {
    fetchMapaData(true);
  }, [fetchMapaData]);

  return {
    metricasTerritoriais: data?.metricasTerritoriais || null,
    municipios: data?.municipios || [],
    top10Eleitores: data?.top10Eleitores || [],
    top10Crescimento: data?.top10Crescimento || [],
    top10Estagnados: data?.top10Estagnados || [],
    loading,
    error,
    empty: !loading && !error && (!data?.municipios || data.municipios.length === 0),
    ultimaAtualizacao,
    refetch
  };
}
