/**
 * Definições e modelos de dados para o módulo de Resultados de Campanhas (Métricas de Conversão/Funil).
 */

/**
 * @typedef {Object} ResultadosCampanhaOficial
 * @property {string} campaign_id - ID da campanha de disparos oficial vinculada
 * @property {number} cliques_botoes - Total de interações em botões de resposta rápida (Quick Reply)
 * @property {number} cliques_links - Total de cliques em links de redirecionamento externos mapeados
 * @property {number} respostas_recebidas - Total de respostas ativas de texto inseridas pelos contatos
 * @property {number} conversas_iniciadas - Sessões de atendimento abertas na Central após o disparo
 * @property {number} conversoes - Volume de objetivos cumpridos pelo contato (ex: preencheu ficha)
 * @property {number} taxa_conversao - Percentual consolidado de conversões em relação ao total enviado
 * @property {number | null} custo_por_conversa - Custo financeiro estimado repassado pela Meta Cloud API
 */
