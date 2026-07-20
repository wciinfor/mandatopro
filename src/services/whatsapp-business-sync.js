import { createMetaGraphApiService } from './meta-graph-api';

function selecionarNumeroPrincipal(conta) {
  const numbers = Array.isArray(conta?.whatsapp_business_numbers) ? conta.whatsapp_business_numbers : [];
  return numbers.find(item => item?.principal && item?.status !== 'INATIVO')
    || numbers.find(item => item?.status !== 'INATIVO')
    || numbers[0]
    || null;
}

function addDiff(diff, field, beforeValue, afterValue) {
  const before = beforeValue ?? null;
  const after = afterValue ?? null;
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    diff.push({ field, before, after });
  }
}

function proximaSincronizacao() {
  return new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
}

async function criarHistorico(supabase, conta) {
  const { data, error } = await supabase
    .from('whatsapp_business_sync_history')
    .insert({
      tenant_id: conta.tenant_id,
      account_id: conta.id,
      started_at: new Date().toISOString(),
      success: false
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function finalizarHistorico(supabase, historyId, startedAt, payload) {
  const finishedAt = new Date().toISOString();
  const durationMs = Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime());

  const { data, error } = await supabase
    .from('whatsapp_business_sync_history')
    .update({
      finished_at: finishedAt,
      duration_ms: durationMs,
      success: Boolean(payload.success),
      updated_items: payload.updatedItems || 0,
      meta_messages: payload.metaMessages || [],
      diff: payload.diff || [],
      error_message: payload.errorMessage || null
    })
    .eq('id', historyId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function sincronizarContaWhatsappBusiness(supabase, conta) {
  if (!conta?.id || !conta?.tenant_id) {
    const err = new Error('Conta WhatsApp Business nao encontrada.');
    err.statusCode = 404;
    throw err;
  }

  if (!conta.access_token || !conta.waba_id) {
    const err = new Error('Token ou WABA ID ausente para sincronizacao.');
    err.statusCode = 400;
    throw err;
  }

  const history = await criarHistorico(supabase, conta);
  const graph = createMetaGraphApiService();
  const numero = selecionarNumeroPrincipal(conta);
  const diff = [];
  const metaMessages = [];

  try {
    const [business, waba, phone, profile] = await Promise.all([
      conta.business_manager_id
        ? graph.obterBusiness(conta.access_token, conta.business_manager_id).catch(error => {
          metaMessages.push(`Business Manager: ${error.message}`);
          return null;
        })
        : Promise.resolve(null),
      graph.validarWaba(conta.access_token, conta.waba_id).catch(error => {
        metaMessages.push(`WABA: ${error.message}`);
        return null;
      }),
      numero?.phone_number_id
        ? graph.obterNumeroWhatsapp(conta.access_token, numero.phone_number_id).catch(error => {
          metaMessages.push(`Numero: ${error.message}`);
          return null;
        })
        : Promise.resolve(null),
      numero?.phone_number_id
        ? graph.obterPerfilWhatsapp(conta.access_token, numero.phone_number_id).catch(error => {
          metaMessages.push(`Perfil: ${error.message}`);
          return null;
        })
        : Promise.resolve(null)
    ]);

    addDiff(diff, 'business_manager_name', conta.business_manager_name, business?.name);
    addDiff(diff, 'business_verification_status', conta.business_verification_status, business?.verification_status);
    addDiff(diff, 'waba_name', conta.waba_name, waba?.name);
    addDiff(diff, 'waba_verification_status', conta.waba_verification_status, waba?.account_review_status);

    const accountPayload = {
      business_manager_name: business?.name || conta.business_manager_name || null,
      business_verification_status: business?.verification_status || conta.business_verification_status || null,
      waba_name: waba?.name || conta.waba_name || null,
      waba_verification_status: waba?.account_review_status || conta.waba_verification_status || null,
      last_synced_at: new Date().toISOString(),
      next_sync_at: proximaSincronizacao(),
      sync_status: 'SUCCESS',
      sync_message: metaMessages.length ? metaMessages.join(' | ') : 'Sincronizacao concluida com sucesso.',
      updated_at: new Date().toISOString()
    };

    const { error: accountError } = await supabase
      .from('whatsapp_business_accounts')
      .update(accountPayload)
      .eq('id', conta.id)
      .eq('tenant_id', conta.tenant_id);

    if (accountError) throw accountError;

    if (numero?.id && phone) {
      addDiff(diff, 'display_phone_number', numero.display_phone_number, phone.display_phone_number);
      addDiff(diff, 'verified_name', numero.verified_name, phone.verified_name);
      addDiff(diff, 'quality_rating', numero.quality_rating, phone.quality_rating);
      addDiff(diff, 'messaging_limit_tier', numero.messaging_limit_tier, phone.messaging_limit_tier);
      addDiff(diff, 'number_status', numero.number_status, phone.status);
      addDiff(diff, 'country_code', numero.country_code, phone.country_code);
      addDiff(diff, 'name_status', numero.name_status, phone.name_status);
      addDiff(diff, 'profile_picture_url', numero.profile_picture_url, profile?.profile_picture_url);

      const { error: numberError } = await supabase
        .from('whatsapp_business_numbers')
        .update({
          display_phone_number: phone.display_phone_number || numero.display_phone_number || null,
          verified_name: phone.verified_name || numero.verified_name || null,
          quality_rating: phone.quality_rating || null,
          messaging_limit_tier: phone.messaging_limit_tier || null,
          number_status: phone.status || null,
          country_code: phone.country_code || null,
          name_status: phone.name_status || null,
          profile_about: profile?.about || null,
          profile_address: profile?.address || null,
          profile_description: profile?.description || null,
          profile_email: profile?.email || null,
          profile_websites: Array.isArray(profile?.websites) ? profile.websites : [],
          profile_vertical: profile?.vertical || null,
          profile_picture_url: profile?.profile_picture_url || null,
          profile_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', numero.id)
        .eq('tenant_id', conta.tenant_id);

      if (numberError) throw numberError;
    }

    const finalHistory = await finalizarHistorico(supabase, history.id, history.started_at, {
      success: true,
      updatedItems: diff.length,
      metaMessages,
      diff
    });

    return {
      success: true,
      diff,
      updatedItems: diff.length,
      history: finalHistory,
      metaMessages
    };
  } catch (error) {
    await supabase
      .from('whatsapp_business_accounts')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: 'ERROR',
        sync_message: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', conta.id)
      .eq('tenant_id', conta.tenant_id);

    const finalHistory = await finalizarHistorico(supabase, history.id, history.started_at, {
      success: false,
      updatedItems: diff.length,
      metaMessages,
      diff,
      errorMessage: error.message
    });

    return {
      success: false,
      diff,
      updatedItems: diff.length,
      history: finalHistory,
      metaMessages,
      error: error.message
    };
  }
}
