/**
 * Definições e modelos de dados para o módulo de Públicos (Segmentações / Audiências de Campanhas).
 */

/**
 * @typedef {Object} PublicoOficial
 * @property {string} id - Identificador único do público/audiência
 * @property {string} nome - Nome do público (Ex: "Jovens Centro", "Mulheres Bairro Liberdade")
 * @property {string} descricao - Descrição breve do público
 * @property {'whatsapp' | 'whatsapp_legacy' | 'instagram'} canal - Canal focado para essa audiência
 * @property {number} quantidade_contatos - Total de contatos qualificados e com opt-in ativo
 * @property {string} origem - Origem da segmentação (ex: "Filtro Dinâmico", "Importação", "Tags")
 * @property {string} ultima_atualizacao - Data e hora ISO da última sincronização/atualização dos contatos
 * @property {Object} [filtros_ativos] - Critérios de filtro ativos (cidade, bairro, tags, faixa_etaria, lideranca, etc)
 */
