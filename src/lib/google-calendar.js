import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

/**
 * Cria e configura um cliente OAuth2 para o Google API.
 */
export function criarOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Credenciais do Google OAuth2 não configuradas no ambiente (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Gera a URL de autorização OAuth2 com permissão estrita de leitura offline.
 * @param {string} state - Token de estado assinado/codificado para validação CSRF e identificação do mandato
 */
export function gerareUrlAutorizacaoGoogle(state) {
  const oauth2Client = criarOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: state,
  });
}

/**
 * Troca o código de autorização pelos tokens de acesso e refresh.
 * @param {string} code 
 */
export async function trocarCodigoPorTokens(code) {
  const oauth2Client = criarOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Retorna uma instância autenticada do cliente de API do Google Calendar.
 * Se o token de acesso estiver expirado e houver refresh_token, ele será renovado automaticamente.
 */
export async function obterClienteCalendarAutenticado(tokensPersistidos, onTokenRefreshed) {
  const oauth2Client = criarOAuth2Client();

  oauth2Client.setCredentials({
    access_token: tokensPersistidos.access_token,
    refresh_token: tokensPersistidos.refresh_token,
    expiry_date: tokensPersistidos.token_expires_at ? new Date(tokensPersistidos.token_expires_at).getTime() : undefined,
  });

  oauth2Client.on('tokens', async (novosTokens) => {
    if (novosTokens.access_token && typeof onTokenRefreshed === 'function') {
      await onTokenRefreshed(novosTokens);
    }
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}
