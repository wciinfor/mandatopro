/**
 * Camada de classificação amigável para códigos de erro conhecidos da Meta Cloud API / WhatsApp Business API.
 * Preserva a mensagem técnica original da Meta enquanto fornece uma explicação operacional em português.
 */
export const META_ERRORS_MAP = {
  '131049': {
    classificacao: 'Restrição de entrega por proteção de engajamento do ecossistema Meta.',
    descricao: 'A Meta bloqueou temporariamente o envio desta mensagem de marketing para este destinatário a fim de evitar sobrecarga ou spam no WhatsApp do usuário (Frequency Cap).'
  },
  '132001': {
    classificacao: 'Template inexistente ou idioma não homologado.',
    descricao: 'O nome do template enviado não existe na conta WABA ou não possui tradução para o idioma configurado.'
  },
  '132000': {
    classificacao: 'Divergência nos parâmetros do template.',
    descricao: 'A quantidade de variáveis ({{1}}, {{2}}...) enviadas não corresponde à estrutura homologada do template.'
  },
  '131026': {
    classificacao: 'Mensagem não entregue (Número indisponível).',
    descricao: 'O número do destinatário não pôde receber a mensagem neste momento (número inválido, fora de área ou sem WhatsApp ativo).'
  },
  '131047': {
    classificacao: 'Janela de 24 horas encerrada.',
    descricao: 'Mais de 24 horas se passaram desde a última mensagem do eleitor. É necessário utilizar um template homologado (HSM).'
  },
  '131056': {
    classificacao: 'Parâmetro de mídia inválido.',
    descricao: 'A URL da imagem, vídeo ou documento de cabeçalho do template está inacessível ou é inválida.'
  },
  '130429': {
    classificacao: 'Limite de taxa de envio atingido (Rate Limit).',
    descricao: 'Muitas mensagens foram enviadas simultaneamente. Aguarde um instante antes de tentar novamente.'
  }
};

/**
 * Normaliza e resolve as informações de falha de um destinatário a partir dos campos
 * error_code, error_message e last_error de communication_campaign_items.
 * 
 * Ordem de prioridade estrita:
 * 1. error_code e error_message explícitos no item
 * 2. Fallback para campos dentro de last_error (que pode ser string ou objeto JSON)
 * 
 * @param {Object} item - Objeto do item de transmissão
 * @returns {Object|null} Objeto contendo errorCode, errorMessage, lastError, e classificacaoAmigavel
 */
export function resolverDetalhesFalhaMeta(item) {
  if (!item) return null;

  let rawErrorCode = item.error_code || null;
  let rawErrorMessage = item.error_message || null;
  let parsedLastError = null;

  if (item.last_error) {
    if (typeof item.last_error === 'object') {
      parsedLastError = item.last_error;
    } else if (typeof item.last_error === 'string') {
      try {
        parsedLastError = JSON.parse(item.last_error);
      } catch (e) {
        parsedLastError = { message: item.last_error };
      }
    }
  }

  // Prioridade de extração do Código do Erro
  const errorCode = String(
    rawErrorCode ||
    parsedLastError?.code ||
    parsedLastError?.error_code ||
    '—'
  );

  // Prioridade de extração da Mensagem do Erro
  const errorMessage = String(
    rawErrorMessage ||
    parsedLastError?.title ||
    parsedLastError?.message ||
    (typeof item.last_error === 'string' ? item.last_error : 'Falha na transmissão da mensagem.')
  );

  // Consulta classificação amigável se o código for conhecido
  const infoMeta = META_ERRORS_MAP[errorCode] || null;

  return {
    errorCode: errorCode !== '—' ? errorCode : null,
    errorMessage,
    classificacaoAmigavel: infoMeta?.classificacao || null,
    descricaoAmigavel: infoMeta?.descricao || null,
    lastErrorBruto: item.last_error || null
  };
}
