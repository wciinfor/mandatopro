/**
 * Disparo PRO - ARQUIVO DE INTEGRAÃ‡ÃƒO
 * 
 * INSTRUÃ‡Ã•ES:
 * 1. Coloque este arquivo na pasta raiz do Disparo PRO
 * 2. Certifique-se de que estÃ¡ no mesmo diretÃ³rio do index.html
 * 3. O arquivo main.js irÃ¡ carregar estas configuraÃ§Ãµes automaticamente
 */

// ========================================
// CONFIGURAÃ‡Ã•ES DOS WEBHOOKS
// ========================================

// Webhook principal para disparo de mensagens
const WEBHOOK_URL = readEnv('N8N_WEBHOOK_DISPARO_PRO');

// ========================================
// FUNÃ‡Ã•ES AUXILIARES
// ========================================

/**
 * Obter configuraÃ§Ã£o completa dos webhooks
 */
function getWebhookConfig() {
    return {
        url: WEBHOOK_URL,
        conexao: WEBHOOK_URL,
        email: WEBHOOK_URL,
        exportContatos: WEBHOOK_URL
    };
}

/**
 * Validar se todas as configuraÃ§Ãµes estÃ£o definidas
 */
function validateWebhookConfig() {
    if (!WEBHOOK_URL) {
        console.error('âŒ URL do webhook nÃ£o configurada');
        return false;
    }

    const urlPattern = /^(https?:\/\/|\/).+/;

    if (!urlPattern.test(WEBHOOK_URL)) {
        console.error('âŒ URL invÃ¡lida no arquivo integracao.js');
        return false;
    }

    return true;
}

/**
 * Log de inicializaÃ§Ã£o
 */
console.log('âœ… Arquivo integracao.js carregado com sucesso!');
console.log('  â€¢ Webhook Principal:', WEBHOOK_URL);

if (validateWebhookConfig()) {
    console.log('âœ… Todas as configuraÃ§Ãµes estÃ£o vÃ¡lidas!');
} else {
    console.warn('âš ï¸ Verifique as configuraÃ§Ãµes no arquivo integracao.js');
}

// ========================================
// EXPORTAÃ‡ÃƒO (COMPATIBILIDADE)
// ========================================

// Para compatibilidade com mÃ³dulos ES6 (se necessÃ¡rio)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        WEBHOOK_URL,
        getWebhookConfig,
        validateWebhookConfig
    };
}