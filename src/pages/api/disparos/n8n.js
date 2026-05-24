import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  }

  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    return res.status(503).json({
      success: false,
      message: 'Webhook N8N do Disparo PRO nao configurado'
    });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

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

    if (typeof payload === 'string') {
      return res.status(200).send(payload);
    }

    return res.status(200).json(payload);
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error('Erro no proxy N8N Disparo PRO:', error);
    return res.status(status).json({
      success: false,
      message: error?.message || 'Erro ao acionar fluxo N8N'
    });
  }
}
