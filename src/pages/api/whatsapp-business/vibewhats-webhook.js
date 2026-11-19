import { createServerClient } from '../../../lib/supabase-server.js';

export const runtime = 'nodejs';

/**
 * Endpoint de Webhook VibeWhats (Estrutura Preparada)
 * 
 * Rota: POST /api/whatsapp-business/vibewhats-webhook?token={verify_token}
 * 
 * Nesta etapa de integração, a estrutura está preparada para recepção de eventos
 * de entrega, status e mensagens recebidas, sem ativar o processamento definitivo de eventos.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const { token } = req.query;
  const payload = req.body;

  // Auditoria básica de recebimento se configurado
  try {
    const supabase = req.supabaseClient || createServerClient();
    
    // Se o token foi informado, tenta registrar o evento auditado
    if (token && typeof token === 'string') {
      const { data: conta } = await supabase
        .from('whatsapp_business_accounts')
        .select('id, tenant_id')
        .eq('verify_token', token)
        .eq('provider', 'VIBEWHATS')
        .maybeSingle();

      if (conta) {
        await supabase
          .from('whatsapp_business_webhook_events')
          .insert({
            tenant_id: conta.tenant_id,
            account_id: conta.id,
            provider: 'VIBEWHATS',
            event_type: payload?.type || 'webhook_received',
            raw_payload: payload,
            status: 'RECEIVED_STANDBY',
            created_at: new Date().toISOString()
          });
      }
    }
  } catch (err) {
    console.warn('[VIBEWHATS WEBHOOK] Auditoria ignorada:', err?.message);
  }

  // Responde 200 OK para confirmar recepção ao servidor VibeWhats
  return res.status(200).json({
    received: true,
    status: 'STANDBY',
    message: 'Webhook VibeWhats estruturado e recebido com sucesso'
  });
}
