import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAcessoMandatoConnect } from '@/lib/api-auth';
import {
  configurarWebhookInstancia,
  enviarMidiaInstancia,
  enviarTextoInstancia,
  obterQrCodeInstancia,
  obterStatusInstancia
} from '@/lib/disparos/evolution';
import { extrairQrCode } from '@/lib/disparos/instancias';
import QRCode from 'qrcode';

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

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
}

function getRequestBaseUrl(req) {
  const configured = String(process.env.MANDATO_CONNECT_WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');

  const host = req.headers['x-forwarded-host'] || req.headers.host || process.env.VERCEL_URL || '';
  const proto = req.headers['x-forwarded-proto'] || (String(host).includes('localhost') ? 'http' : 'https');
  return host ? `${proto}://${host}`.replace(/\/+$/, '') : '';
}

function buildAtendimentoWebhookUrl(req) {
  const baseUrl = getRequestBaseUrl(req);
  if (!baseUrl) return '';

  const url = new URL('/api/atendimento-connect/webhook', baseUrl);
  const secret = String(process.env.MANDATO_CONNECT_WEBHOOK_SECRET || '').trim();
  if (secret) url.searchParams.set('secret', secret);
  return url.toString();
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
    'qrcode.base64',
    'qrCode.base64',
    'qr.base64',
    'instance.qrcode.base64',
    'instance.qrCode.base64',
    'instance.qr.base64',
    'data.base64',
    'data.qrcode.base64',
    'data.qrCode.base64',
    'data.qr.base64',
    'data.instance.qrcode.base64',
    'data.instance.qrCode.base64',
    'data.instance.qr.base64',
    'qrcode',
    'qrCode',
    'qr',
    'instance.qrcode',
    'instance.qrCode',
    'instance.qr',
    'data.qrcode',
    'data.qrCode',
    'data.qr',
    'data.instance.qrcode',
    'data.instance.qrCode',
    'data.instance.qr'
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

    const extractedQr = extrairQrCode(qrPayload);
    if (extractedQr.type === 'image' && extractedQr.value) {
      return { ...normalizedQr, result: extractedQr.value };
    }
    if (extractedQr.type === 'text' && extractedQr.value) {
      return {
        ...normalizedQr,
        result: await QRCode.toDataURL(extractedQr.value, { margin: 2, width: 320 })
      };
    }
  } catch (error) {
    console.warn('Falha ao consultar QR direto na Evolution:', error?.message);
  }

  return null;
}

function buildEvolutionMediaPayload(body, number) {
  const media = body?.media || {};
  if (!media || typeof media !== 'object') return null;

  const rawType = String(media.type || media.mediaType || media.mediatype || '').toLowerCase();
  const mimetype = String(media.mimetype || media.mimeType || '').trim();
  const mediaValue = media.url || media.data || media.media || media.base64 || '';
  if (!mediaValue) return null;

  const inferredType = rawType === 'url'
    ? (mimetype.split('/')[0] || 'document')
    : (mimetype.split('/')[0] || rawType || 'document');

  const mediatype = ['image', 'video', 'audio', 'document'].includes(inferredType)
    ? inferredType
    : 'document';

  return {
    number,
    mediatype,
    mimetype: mimetype || undefined,
    caption: body.message || '',
    media: mediaValue,
    fileName: media.filename || media.fileName || undefined
  };
}

async function ensureAtendimentoWebhook(instanceName, instanceApiKey, req) {
  const webhookUrl = buildAtendimentoWebhookUrl(req);
  if (!webhookUrl) return null;

  try {
    return await configurarWebhookInstancia(instanceName, instanceApiKey, webhookUrl);
  } catch (error) {
    console.warn('Falha ao configurar webhook de retorno da Evolution:', error?.message);
    return null;
  }
}

async function sendEvolutionMessageFallback(body = {}, req) {
  const instanceName = String(body.instanceName || body.instance || '').trim();
  const instanceApiKey = String(body.instanceAPIKEY || body.apikey || body.instanceKey || '').trim();
  const number = normalizePhone(body.contact?.phone || body.phone || body.number);
  const text = String(body.message || '').trim();

  if (!instanceName) {
    return { status: 400, payload: { success: false, message: 'Instancia nao informada' } };
  }
  if (!instanceApiKey) {
    return { status: 400, payload: { success: false, message: 'API key da instancia nao informada' } };
  }
  if (!number) {
    return { status: 400, payload: { success: false, message: 'Telefone do contato nao informado' } };
  }

  const mediaPayload = buildEvolutionMediaPayload(body, number);
  if (!mediaPayload && !text) {
    return { status: 400, payload: { success: false, message: 'Mensagem ou midia obrigatoria' } };
  }

  const data = mediaPayload
    ? await enviarMidiaInstancia(instanceName, instanceApiKey, mediaPayload)
    : await enviarTextoInstancia(instanceName, instanceApiKey, number, text);

  return {
    status: 200,
    payload: {
      success: true,
      provider: 'evolution',
      direct: true,
      instanceName,
      number,
      messageId: body.messageId || null,
      data
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAcessoMandatoConnect(usuario);

    const isConnectionCheck = String(req.body?.action || '') === 'verificar_conexao';
    const isSendMessage = String(req.body?.action || '') === 'enviar_mensagem';
    const webhookUrl = getWebhookUrl();

    if (isSendMessage) {
      const instanceName = String(req.body?.instanceName || req.body?.instance || '').trim();
      const instanceApiKey = String(req.body?.instanceAPIKEY || req.body?.apikey || req.body?.instanceKey || '').trim();
      if (instanceName && instanceApiKey) {
        await ensureAtendimentoWebhook(instanceName, instanceApiKey, req);
      }
    }

    if (!webhookUrl) {
      if (isConnectionCheck) {
        const evolutionFallback = await getEvolutionConnectionFallback(req.body || {});
        if (evolutionFallback) {
          return res.status(200).json(evolutionFallback);
        }
      }

      if (isSendMessage) {
        const directSend = await sendEvolutionMessageFallback(req.body || {}, req);
        return res.status(directSend.status).json(directSend.payload);
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
