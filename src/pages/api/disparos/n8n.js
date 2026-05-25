import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterQrCodeInstancia, obterStatusInstancia } from '@/lib/disparos/evolution';

export const runtime = 'nodejs';

function getWebhookUrl() {
  return String(process.env.N8N_WEBHOOK_DISPARO_PRO || process.env.DISPARO_PRO_N8N_WEBHOOK_URL || '').trim();
}

async function readN8nResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function asObject(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return { result: value };
    }
  }
  if (Array.isArray(value)) return value[0] || {};
  return typeof value === 'object' ? value : {};
}

function getNestedValue(source, paths) {
  for (const path of paths) {
    const value = path.split('.').reduce((current, key) => current?.[key], source);
    if (value) return value;
  }
  return '';
}

function toImageDataUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('data:image')) return text;
  if (/^[A-Za-z0-9+/=]+$/.test(text) && text.length > 200) {
    return `data:image/png;base64,${text}`;
  }
  return '';
}

function normalizeConnectionPayload(payload) {
  const data = asObject(payload);
  const state = getNestedValue(data, [
    'result',
    'state',
    'status',
    'connectionState',
    'instance.state',
    'instance.status',
    'data.state',
    'data.status',
    'data.instance.state',
    'data.instance.status'
  ]);

  const normalizedState = String(state || '').toLowerCase();
  if (['open', 'connected', 'connectado', 'conectado'].includes(normalizedState) || data.connected === true) {
    return { ...data, result: 'open' };
  }

  const qrValue = getNestedValue(data, [
    'result',
    'base64',
    'qrcode',
    'qrCode',
    'qr',
    'code',
    'pairingCode',
    'qrcode.base64',
    'qrCode.base64',
    'instance.qrcode',
    'instance.qrCode',
    'instance.qr',
    'instance.code',
    'data.base64',
    'data.qrcode',
    'data.qrCode',
    'data.qr',
    'data.code',
    'data.pairingCode',
    'data.instance.qrcode',
    'data.instance.qrCode',
    'data.instance.qr',
    'data.instance.code'
  ]);

  const imageQr = toImageDataUrl(qrValue);
  if (imageQr) {
    return { ...data, result: imageQr };
  }

  if (data.error || normalizedState === 'error') {
    return { ...data, result: 'error', message: data.message || data.error || 'Instancia nao encontrada' };
  }

  return data;
}

function hasQrOrOpen(payload) {
  return payload?.result === 'open' || String(payload?.result || '').startsWith('data:image');
}

async function getEvolutionConnectionFallback(body = {}) {
  const instanceName = String(body.instanceName || body.instance || '').trim();
  if (!instanceName) return null;
  const instanceApiKey = String(body.instanceAPIKEY || body.apikey || body.instanceKey || '').trim();

  try {
    const statusPayload = await obterStatusInstancia(instanceName, instanceApiKey || undefined);
    const normalizedStatus = normalizeConnectionPayload(statusPayload);
    if (normalizedStatus.result === 'open') return normalizedStatus;
  } catch (error) {
    console.warn('Falha ao consultar status direto na Evolution:', error?.message);
  }

  try {
    const qrPayload = await obterQrCodeInstancia(instanceName, instanceApiKey || undefined);
    const normalizedQr = normalizeConnectionPayload(qrPayload);
    if (hasQrOrOpen(normalizedQr)) return normalizedQr;
  } catch (error) {
    console.warn('Falha ao consultar QR direto na Evolution:', error?.message);
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const isConnectionCheck = String(req.body?.action || '') === 'verificar_conexao';
    const webhookUrl = getWebhookUrl();

    if (!webhookUrl) {
      if (isConnectionCheck) {
        const evolutionFallback = await getEvolutionConnectionFallback(req.body || {});
        if (evolutionFallback) {
          return res.status(200).json(evolutionFallback);
        }
      }

      return res.status(503).json({
        success: false,
        message: 'Webhook N8N do Mandato Connect nao configurado'
      });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body || {})
    });

    const payload = await readN8nResponse(response);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: 'Erro no fluxo N8N',
        data: payload
      });
    }

    if (isConnectionCheck) {
      const normalized = normalizeConnectionPayload(payload);
      if (hasQrOrOpen(normalized)) {
        return res.status(200).json(normalized);
      }

      const evolutionFallback = await getEvolutionConnectionFallback(req.body || {});
      if (evolutionFallback) {
        return res.status(200).json(evolutionFallback);
      }

      return res.status(200).json(normalized);
    }

    if (typeof payload === 'string') {
      return res.status(200).send(payload);
    }

    return res.status(200).json(payload);
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error('Erro no proxy N8N Mandato Connect:', error);
    return res.status(status).json({
      success: false,
      message: error?.message || 'Erro ao acionar fluxo N8N'
    });
  }
}
