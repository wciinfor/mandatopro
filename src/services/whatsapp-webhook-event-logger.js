function extrairEvento(payload = {}) {
  const entry = Array.isArray(payload.entry) ? payload.entry[0] : null;
  const change = Array.isArray(entry?.changes) ? entry.changes[0] : null;
  const value = change?.value || {};
  const metadata = value.metadata || {};
  const message = Array.isArray(value.messages) ? value.messages[0] : null;
  const status = Array.isArray(value.statuses) ? value.statuses[0] : null;

  return {
    eventType: change?.field || message?.type || status?.status || payload.object || 'unknown',
    wabaId: entry?.id || null,
    phoneNumberId: metadata.phone_number_id || null,
    timestamp: message?.timestamp || status?.timestamp || null
  };
}

function normalizarTimestamp(timestamp) {
  const value = Number(timestamp || 0);
  if (!Number.isFinite(value) || value <= 0) return new Date().toISOString();
  return new Date(value * 1000).toISOString();
}

export default class WhatsAppWebhookEventLogger {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async log({ conta = null, payload = {}, validationStatus = 'INVALID', signatureStatus = 'MISSING' }) {
    const event = extrairEvento(payload);

    const { data, error } = await this.supabase
      .from('whatsapp_business_webhook_events')
      .insert({
        tenant_id: conta?.tenant_id || null,
        account_id: conta?.id || null,
        event_type: event.eventType,
        event_timestamp: normalizarTimestamp(event.timestamp),
        waba_id: event.wabaId,
        phone_number_id: event.phoneNumberId,
        raw_payload: payload || {},
        validation_status: validationStatus,
        signature_status: signatureStatus
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  async latestForTenant(tenantId) {
    if (!tenantId) return null;

    const { data, error } = await this.supabase
      .from('whatsapp_business_webhook_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }
}

export function createWhatsAppWebhookEventLogger(supabase) {
  return new WhatsAppWebhookEventLogger(supabase);
}

export function extractWebhookRouting(payload = {}) {
  const event = extrairEvento(payload);
  return {
    wabaId: event.wabaId,
    phoneNumberId: event.phoneNumberId,
    eventType: event.eventType
  };
}
