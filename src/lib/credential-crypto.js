import crypto from 'crypto';

/**
 * Utilitário de Criptografia AES-256-GCM para Credenciais Sensíveis de Provedores
 * 
 * - Chave derivada de segredo seguro de ambiente (CREDENTIALS_ENCRYPTION_KEY ou SUPABASE_SERVICE_ROLE_KEY).
 * - Utiliza AES-256-GCM com IV aleatório de 12 bytes e Auth Tag de 16 bytes.
 * - Formato serializado: enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
 * - Nunca lança exceção fatal em descriptografia de texto legado (fallback defensivo se não estiver criptografado).
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recomendado para GCM
const PREFIX = 'enc:v1:';

function getMasterKey() {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!secret || typeof secret !== 'string' || !secret.trim()) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY não configurada no ambiente do servidor.');
  }
  // Deriva estritamente uma chave de 32 bytes (256 bits) usando SHA-256
  return crypto.createHash('sha256').update(secret.trim()).digest();
}

/**
 * Criptografa uma string de credencial sensível
 * Se a CREDENTIALS_ENCRYPTION_KEY não estiver configurada, interrompe com erro explícito.
 * @param {string} text - Texto puro a ser criptografado
 * @returns {string} - String cifrada no formato enc:v1:<iv>:<tag>:<ciphertext>
 */
export function encryptCredential(text) {
  if (!text || typeof text !== 'string') return text;
  if (text.startsWith(PREFIX)) return text; // Já está criptografado

  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return `${PREFIX}${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Descriptografa uma credencial cifrada
 * Se a string não estiver no formato enc:v1, retorna o texto original intacto (garante 100% de compatibilidade retroativa)
 * @param {string} cipherText - String cifrada ou texto puro legado
 * @returns {string} - Texto puro descriptografado
 */
export function decryptCredential(cipherText) {
  if (!cipherText || typeof cipherText !== 'string') return cipherText;
  if (!cipherText.startsWith(PREFIX)) {
    return cipherText; // Formato em texto puro / legada intacta
  }

  try {
    const masterKey = getMasterKey();
    const parts = cipherText.slice(PREFIX.length).split(':');
    if (parts.length !== 3) return cipherText;

    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[CREDENTIAL_CRYPTO] Falha ao descriptografar credencial:', err?.message);
    return null;
  }
}
