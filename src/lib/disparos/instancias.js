export const INSTANCIA_SELECT = 'id, nome, provider, status, numero, metadata, created_at, updated_at';

export function sanitizeNomeInstancia(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 120);
}

export function maskApiKey(value) {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= 8) return '••••';
  return `${text.slice(0, 4)}••••${text.slice(-4)}`;
}

export function toPublicInstancia(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    provider: row.provider || 'evolution',
    status: row.status || 'desconectada',
    numero: row.numero || '',
    metadata: row.metadata || {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    hasApiKey: Boolean(row.api_key),
    apiKeyMasked: maskApiKey(row.api_key)
  };
}

export function extrairQrCode(payload) {
  const candidates = [
    payload?.base64,
    payload?.qrcode,
    payload?.qr,
    payload?.code,
    payload?.pairingCode,
    payload?.instance?.qrcode,
    payload?.instance?.qr,
    payload?.data?.base64,
    payload?.data?.qrcode,
    payload?.data?.qr
  ].filter(Boolean);

  const value = String(candidates[0] || '');
  if (!value) return { type: 'empty', value: '' };
  if (value.startsWith('data:image')) return { type: 'image', value };
  if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 200) {
    return { type: 'image', value: `data:image/png;base64,${value}` };
  }
  return { type: 'text', value };
}
