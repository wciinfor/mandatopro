/**
 * Definições e modelos de dados para o módulo de Templates oficiais do WhatsApp Business (HSM).
 */

/**
 * @typedef {Object} TemplateComponente
 * @property {'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'} type - Tipo do bloco/componente do template
 * @property {string} [format] - Formato do header (TEXT, IMAGE, VIDEO, DOCUMENT)
 * @property {string} [text] - Conteúdo textual do bloco
 * @property {Array<Object>} [buttons] - Lista de botões vinculados (QUICK_REPLY, PHONE_NUMBER, URL)
 * @property {Array<string>} [variables] - Variáveis identificadas no corpo (Ex: {{1}}, {{2}})
 */

/**
 * @typedef {Object} TemplateOficial
 * @property {string} id - ID único do template
 * @property {string} nome - Nome técnico único do template (Ex: "boas_vindas_eleitor")
 * @property {string} categoria - Categoria do template (MARKETING, UTILITY, AUTHENTICATION)
 * @property {string} idioma - Código do idioma (Ex: "pt_BR", "en_US")
 * @property {'APPROVED' | 'PENDING' | 'REJECTED'} status - Situação de aprovação do modelo na Meta
 * @property {'whatsapp'} canal - Canal focado para transmissão
 * @property {string} ultima_sincronizacao - Timestamp ISO da última sincronização com o Meta Business Suite
 * @property {Array<TemplateComponente>} componentes - Blocos estruturais do template (Cabeçalho, Corpo, Rodapé, Botões)
 */
export const TemplateStatus = {
  APPROVED: 'APPROVED',
  PENDING: 'PENDING',
  REJECTED: 'REJECTED'
};
