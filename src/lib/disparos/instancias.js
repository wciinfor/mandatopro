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
  const unwrapValue = (candidate) => {
    if (!candidate) return '';
    if (typeof candidate !== 'object') return candidate;

    return [
      candidate.value,
      candidate.base64,
      candidate.qrcode?.base64,
      candidate.qrCode?.base64,
      candidate.qr?.base64,
      candidate.qrcode,
      candidate.qrCode,
      candidate.qr,
      candidate.code,
      candidate.pairingCode
    ].map(unwrapValue).find(Boolean) || '';
  };

  const candidates = [
    payload?.base64,
    payload?.qrcode?.base64,
    payload?.qrCode?.base64,
    payload?.qr?.base64,
    payload?.qrcode,
    payload?.qrCode,
    payload?.qr,
    payload?.instance?.qrcode?.base64,
    payload?.instance?.qrCode?.base64,
    payload?.instance?.qr?.base64,
    payload?.instance?.qrcode,
    payload?.instance?.qrCode,
    payload?.instance?.qr,
    payload?.data?.base64,
    payload?.data?.qrcode?.base64,
    payload?.data?.qrCode?.base64,
    payload?.data?.qr?.base64,
    payload?.data?.qrcode,
    payload?.data?.qrCode,
    payload?.data?.qr,
    payload?.data?.instance?.qrcode?.base64,
    payload?.data?.instance?.qrCode?.base64,
    payload?.data?.instance?.qr?.base64,
    payload?.data?.instance?.qrcode,
    payload?.data?.instance?.qrCode,
    payload?.data?.instance?.qr,
    payload?.code,
    payload?.pairingCode,
    payload?.instance?.code,
    payload?.data?.code,
    payload?.data?.pairingCode,
    payload?.data?.instance?.code
  ].map(unwrapValue).filter(Boolean);

  const value = String(candidates[0] || '');
  if (!value) return { type: 'empty', value: '' };
  if (value.startsWith('data:image')) return { type: 'image', value };
  if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 200) {
    return { type: 'image', value: `data:image/png;base64,${value}` };
  }
  return { type: 'text', value };
}
