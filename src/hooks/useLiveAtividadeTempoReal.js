import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook customizado desacoplado para consumir o Widget Central de Atividade em Tempo Real.
 * 
 * @param {Object} options
 * @param {string} options.filtroCategoria Categoria selecionada ('TUDO' | 'CADASTROS' | 'LIDERANCAS' | 'ATENDIMENTOS' | 'CAMPANHAS' | 'EVENTOS')
 * @param {number} options.pollingIntervalMs Intervalo de polling em ms (padrão: 10s)
 * @param {boolean} options.enabled Se o polling está ativo
 */
export function useLiveAtividadeTempoReal({
  filtroCategoria = 'TUDO',
  pollingIntervalMs = 10000,
  enabled = true
} = {}) {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  const timerRef = useRef(null);

  const fetchAtividades = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/live/widgets/atividade-tempo-real');
      if (!response.ok) {
        throw new Error(`Erro na API (${response.status})`);
      }
      const json = await response.json();
      
      const listaRecebida = Array.isArray(json?.eventos) ? json.eventos : [];

      setEventos(listaRecebida);

      const agora = new Date();
      setUltimaAtualizacao(
        agora.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    } catch (err) {
      console.error('[useLiveAtividadeTempoReal] Erro ao sincronizar atividades:', err);
      setError(err.message || 'Falha ao sincronizar atividades em tempo real');
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    fetchAtividades(true);

    timerRef.current = setInterval(() => {
      fetchAtividades(false);
    }, pollingIntervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [fetchAtividades, pollingIntervalMs, enabled]);

  const refetch = useCallback(() => {
    fetchAtividades(true);
  }, [fetchAtividades]);

  return {
    eventos,
    loading,
    error,
    empty: !loading && !error && eventos.length === 0,
    ultimaAtualizacao,
    refetch
  };
}
