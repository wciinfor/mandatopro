import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook customizado para consumir os dados do widget Live de Eleitores com suporte a polling.
 * Preparado para fácil substituição/integração com SSE (Server-Sent Events) no futuro.
 * 
 * @param {Object} options
 * @param {number} options.pollingIntervalMs Intervalo de polling em milissegundos (padrão: 15s)
 * @param {boolean} options.enabled Se o polling está ativo
 */
export function useLiveEleitores({ pollingIntervalMs = 15000, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  const timerRef = useRef(null);

  const fetchEleitoresData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/live/widgets/eleitores');
      if (!response.ok) {
        throw new Error(`Erro na API (${response.status})`);
      }
      const json = await response.json();
      setData(json);

      // Formatar hora da última atualização
      const agora = new Date();
      setUltimaAtualizacao(
        agora.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    } catch (err) {
      console.error('[useLiveEleitores] Erro na busca periódica:', err);
      setError(err.message || 'Falha ao sincronizar dados');
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Busca inicial
    fetchEleitoresData(true);

    // Polling periódico desacoplado
    timerRef.current = setInterval(() => {
      fetchEleitoresData(false);
    }, pollingIntervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [fetchEleitoresData, pollingIntervalMs, enabled]);

  const refetch = useCallback(() => {
    fetchEleitoresData(true);
  }, [fetchEleitoresData]);

  return {
    metricas: data?.metricas || null,
    timeline: data?.timeline || [],
    loading,
    error,
    empty: !loading && !error && (!data?.timeline || data.timeline.length === 0),
    ultimaAtualizacao,
    refetch
  };
}
