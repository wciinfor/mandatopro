import metaWebhookHandler from './meta-webhook';

/**
 * Endpoint de compatibilidade legado para Webhook da Meta.
 * Redireciona a requisição integralmente para o handler unificado meta-webhook.js,
 * garantindo a obrigatoriedade da assinatura HMAC SHA-256 e eliminando fallbacks hardcoded.
 */
export const config = {
  api: {
    bodyParser: false
  }
};

export default function handler(req, res) {
  return metaWebhookHandler(req, res);
}

