export default class TokenStorageService {
  prepareMetaAccessToken(tokenData = {}) {
    const accessToken = String(tokenData.accessToken || '').trim();
    if (!accessToken) {
      return {
        access_token: null,
        access_token_expires_at: null,
        access_token_obtained_at: null,
        access_token_type: null,
        access_token_metadata: {}
      };
    }

    return {
      access_token: accessToken,
      access_token_expires_at: tokenData.expiresAt || null,
      access_token_obtained_at: tokenData.obtainedAt || new Date().toISOString(),
      access_token_type: tokenData.tokenType || null,
      access_token_metadata: {
        expiresIn: tokenData.expiresIn || null,
        graphVersion: tokenData.graphVersion || null,
        storage: 'plain',
        encryption: 'pending'
      }
    };
  }
}

export function createTokenStorageService() {
  return new TokenStorageService();
}
