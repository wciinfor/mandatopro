/**
 * Definições e modelos de dados para o módulo de Insights Automáticos da Comunicação.
 */

/**
 * @typedef {Object} InsightRecomendacao
 * @property {string} id - Identificador do insight
 * @property {'warning' | 'success' | 'info' | 'danger'} tipo - Nível de prioridade/alerta
 * @property {string} titulo - Título descritivo do insight
 * @property {string} descricao - Texto detalhado com a análise explicada
 * @property {string} recomendacao - Ação sugerida para o gestor
 * @property {string} categoria - Grupo da análise (Campanhas, Equipe, Canais, Públicos)
 * @property {string} calculado_em - Timestamp ISO do cálculo
 */
