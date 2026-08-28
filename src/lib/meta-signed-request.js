import crypto from 'crypto';

/**
 * Decodifica e valida o signed_request enviado pela Meta Graph API
 * (Deauthorize Callback e Data Deletion Request Callback).
 *
 * @param {string} signedRequest - String no formato "encoded_sig.payload"
 * @param {string} appSecret - Segredo do aplicativo Meta (META_APP_SECRET)
 * @returns {object|null} Payload decodificado se válido, ou null se inválido
 */
export function parseAndVerifyMetaSignedRequest(signedRequest, appSecret) {
  if (!signedRequest || typeof signedRequest !== 'string' || !appSecret) {
    return null;
  }

  const parts = signedRequest.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [encodedSig, encodedPayload] = parts;

  const base64UrlDecode = (str) => {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64');
  };

  try {
    const sig = base64UrlDecode(encodedSig);
    const rawPayload = base64UrlDecode(encodedPayload).toString('utf8');
    const data = JSON.parse(rawPayload);

    if (String(data.algorithm || '').toUpperCase() !== 'HMAC-SHA256') {
      return null;
    }

    const expectedSig = crypto
      .createHmac('sha256', appSecret)
      .update(encodedPayload)
      .digest();

    if (sig.length !== expectedSig.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(sig, expectedSig)) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}
