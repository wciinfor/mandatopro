/**
 * Serviço de Controle de Idempotência Atômica para Webhooks de WhatsApp
 * 
 * Implementa aquisição atômica, conclusão e liberação de reservas
 * com suporte estrito a Fencing Tokens (números de tentativa monotônicos).
 */

export class WhatsAppInboundIdempotencyService {
  /**
   * Tenta adquirir a reserva exclusiva para processar a mensagem recebida
   * 
   * @param {Object} supabase - Cliente do Supabase
   * @param {Object} params
   * @returns {Promise<{adquirido: boolean, duplicada: boolean, emProcessamento: boolean, reservaId: number|null, fencingToken: number|null}>}
   */
  static async adquirirReserva(supabase, {
    tenantId,
    provider,
    accountId,
    instanceId = null,
    providerMessageId,
    timeoutSeconds = 60
  }) {
    if (!tenantId || !provider || !accountId || !providerMessageId) {
      return { adquirido: true, duplicada: false, emProcessamento: false, reservaId: null, fencingToken: null };
    }

    try {
      // 1. Tenta via RPC atômica
      const { data, error } = await supabase.rpc('adquirir_reserva_inbound', {
        p_tenant_id: Number(tenantId),
        p_provider: String(provider).toUpperCase(),
        p_account_id: Number(accountId),
        p_instance_id: instanceId ? String(instanceId) : null,
        p_provider_message_id: String(providerMessageId),
        p_timeout_segundos: timeoutSeconds
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        const row = data[0];
        return {
          adquirido: Boolean(row.sucesso),
          duplicada: Boolean(row.duplicada),
          emProcessamento: Boolean(row.bloqueada),
          reservaId: row.reserva_id ? Number(row.reserva_id) : null,
          fencingToken: row.fencing_token ? Number(row.fencing_token) : 1
        };
      }

      // 2. Fallback defensivo com fencing token via PostgREST direto
      return await this._adquirirReservaFallback(supabase, {
        tenantId,
        provider,
        accountId,
        instanceId,
        providerMessageId,
        timeoutSeconds
      });
    } catch (err) {
      console.warn('[IDEMPOTENCY SERVICE] Falha ao consultar tabela de idempotência, operando em modo defensivo:', err?.message);
      return { adquirido: true, duplicada: false, emProcessamento: false, reservaId: null, fencingToken: 1 };
    }
  }

  static async _adquirirReservaFallback(supabase, {
    tenantId,
    provider,
    accountId,
    instanceId,
    providerMessageId,
    timeoutSeconds
  }) {
    const provNorm = String(provider).toUpperCase();
    const nowIso = new Date().toISOString();

    const { data: inserted, error: insertErr } = await supabase
      .from('whatsapp_inbound_idempotency')
      .insert({
        tenant_id: Number(tenantId),
        provider: provNorm,
        account_id: Number(accountId),
        instance_id: instanceId ? String(instanceId) : null,
        provider_message_id: String(providerMessageId),
        status: 'PROCESSING',
        attempt_number: 1,
        locked_at: nowIso,
        updated_at: nowIso
      })
      .select('id, attempt_number')
      .maybeSingle();

    if (!insertErr && inserted?.id) {
      return { 
        adquirido: true, 
        duplicada: false, 
        emProcessamento: false, 
        reservaId: inserted.id,
        fencingToken: inserted.attempt_number || 1
      };
    }

    if (insertErr?.code === '23505' || String(insertErr?.message || '').includes('unique')) {
      const { data: reg } = await supabase
        .from('whatsapp_inbound_idempotency')
        .select('id, status, attempt_number, locked_at')
        .eq('tenant_id', Number(tenantId))
        .eq('provider', provNorm)
        .eq('account_id', Number(accountId))
        .eq('provider_message_id', String(providerMessageId))
        .maybeSingle();

      if (reg) {
        if (reg.status === 'COMPLETED') {
          return { adquirido: false, duplicada: true, emProcessamento: false, reservaId: reg.id, fencingToken: reg.attempt_number };
        }

        const lockTime = new Date(reg.locked_at).getTime();
        const expirado = Number.isFinite(lockTime) && (Date.now() - lockTime > timeoutSeconds * 1000);

        if (reg.status === 'FAILED' || expirado) {
          const novoAttempt = Number(reg.attempt_number || 1) + 1;
          const { data: updated, error: updErr } = await supabase
            .from('whatsapp_inbound_idempotency')
            .update({
              status: 'PROCESSING',
              attempt_number: novoAttempt,
              locked_at: nowIso,
              updated_at: nowIso,
              last_error: null
            })
            .eq('id', reg.id)
            .eq('attempt_number', reg.attempt_number) // Compare-and-swap atômico
            .select('id, attempt_number')
            .maybeSingle();

          if (!updErr && updated?.id) {
            return { adquirido: true, duplicada: false, emProcessamento: false, reservaId: updated.id, fencingToken: updated.attempt_number };
          }
        }

        return { adquirido: false, duplicada: false, emProcessamento: true, reservaId: reg.id, fencingToken: reg.attempt_number };
      }
    }

    return { adquirido: true, duplicada: false, emProcessamento: false, reservaId: null, fencingToken: 1 };
  }

  /**
   * Conclui a reserva com validação de Fencing Token e status = 'PROCESSING'
   * @returns {Promise<boolean>} TRUE se a reserva foi concluída com sucesso; FALSE se expirada, cancelada ou FAILED
   */
  static async concluirReserva(supabase, reservaId, fencingToken = null) {
    if (!reservaId) return true;
    try {
      if (fencingToken !== null) {
        const { data, error } = await supabase.rpc('concluir_reserva_inbound', {
          p_reserva_id: Number(reservaId),
          p_fencing_token: Number(fencingToken)
        });
        if (!error && typeof data === 'boolean') return data;
      }

      let q = supabase
        .from('whatsapp_inbound_idempotency')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', reservaId)
        .eq('status', 'PROCESSING');

      if (fencingToken !== null) {
        q = q.eq('attempt_number', fencingToken);
      }

      const { data: updData, error: updErr } = await q.select('id');
      return !updErr && Array.isArray(updData) && updData.length > 0;
    } catch (e) {
      console.warn('[IDEMPOTENCY SERVICE] Falha ao concluir reserva:', e?.message);
      return false;
    }
  }

  /**
   * Libera a reserva por falha com validação de Fencing Token e status = 'PROCESSING'
   * @returns {Promise<boolean>} TRUE se a reserva foi liberada para FAILED; FALSE se já estava concluída ou reatribuída
   */
  static async liberarReserva(supabase, reservaId, fencingToken = null, erroMsg = null) {
    if (!reservaId) return true;
    try {
      if (fencingToken !== null) {
        const { data, error } = await supabase.rpc('liberar_reserva_inbound', {
          p_reserva_id: Number(reservaId),
          p_fencing_token: Number(fencingToken),
          p_erro: erroMsg ? String(erroMsg).slice(0, 500) : 'Erro desconhecido'
        });
        if (!error && typeof data === 'boolean') return data;
      }

      let q = supabase
        .from('whatsapp_inbound_idempotency')
        .update({
          status: 'FAILED',
          failed_at: new Date().toISOString(),
          last_error: erroMsg ? String(erroMsg).slice(0, 500) : 'Erro desconhecido',
          updated_at: new Date().toISOString()
        })
        .eq('id', reservaId)
        .eq('status', 'PROCESSING');

      if (fencingToken !== null) {
        q = q.eq('attempt_number', fencingToken);
      }

      const { data: updData, error: updErr } = await q.select('id');
      return !updErr && Array.isArray(updData) && updData.length > 0;
    } catch (e) {
      console.warn('[IDEMPOTENCY SERVICE] Falha ao liberar reserva:', e?.message);
      return false;
    }
  }
}

export default WhatsAppInboundIdempotencyService;
