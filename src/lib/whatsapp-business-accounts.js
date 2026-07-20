import { obterTenantId } from './tenant';
import { createTokenStorageService } from '../services/token-storage';

export function normalizarWhatsappAccount(row) {
  const numbers = Array.isArray(row?.whatsapp_business_numbers)
    ? row.whatsapp_business_numbers
    : row?.whatsapp_business_numbers
      ? [row.whatsapp_business_numbers]
      : [];
  const number = numbers.find(item => item?.principal && item?.status !== 'INATIVO')
    || numbers.find(item => item?.status !== 'INATIVO')
    || numbers[0]
    || null;

  return {
    id: row?.id || null,
    tenantId: row?.tenant_id || null,
    nome: row?.nome || '',
    businessManagerId: row?.business_manager_id || '',
    businessManagerName: row?.business_manager_name || '',
    businessVerificationStatus: row?.business_verification_status || '',
    wabaId: row?.waba_id || '',
    wabaName: row?.waba_name || '',
    wabaVerificationStatus: row?.waba_verification_status || '',
    verifyTokenConfigured: Boolean(row?.verify_token),
    phoneNumberId: number?.phone_number_id || '',
    displayPhoneNumber: number?.display_phone_number || '',
    displayName: number?.display_name || '',
    verifiedName: number?.verified_name || '',
    qualityRating: number?.quality_rating || '',
    messagingLimitTier: number?.messaging_limit_tier || '',
    numberStatus: number?.number_status || '',
    countryCode: number?.country_code || '',
    nameStatus: number?.name_status || '',
    profilePictureUrl: number?.profile_picture_url || '',
    hasAccessToken: Boolean(row?.access_token),
    tokenExpiresAt: row?.access_token_expires_at || null,
    tokenObtainedAt: row?.access_token_obtained_at || null,
    tokenType: row?.access_token_type || '',
    tokenSource: row?.access_token_source || '',
    onboarding: {
      embeddedSignupCompleted: Boolean(row?.embedded_signup_completed),
      tokenValidated: Boolean(row?.token_validated),
      wabaValidated: Boolean(row?.waba_validated),
      phoneValidated: Boolean(row?.phone_validated),
      productionReady: Boolean(row?.production_ready),
      phoneRegistrationPending: Boolean(row?.phone_registration_pending),
      phoneRegistered: Boolean(row?.phone_registered),
      phoneRegistrationFailed: Boolean(row?.phone_registration_failed),
      phoneRegisteredAt: row?.phone_registered_at || null,
      phoneRegistrationMessage: row?.phone_registration_message || '',
      webhookPending: Boolean(row?.webhook_pending),
      webhookVerified: Boolean(row?.webhook_verified),
      webhookReceivingEvents: Boolean(row?.webhook_receiving_events),
      webhookLastVerifiedAt: row?.webhook_last_verified_at || null,
      webhookLastEventAt: row?.webhook_last_event_at || null,
      webhookLastSignatureStatus: row?.webhook_last_signature_status || '',
      webhookValidationMessage: row?.webhook_validation_message || ''
    },
    isConfigured: Boolean(row?.production_ready),
    isConnected: Boolean(row?.access_token && number?.phone_number_id),
    productionReady: Boolean(row?.production_ready),
    sync: {
      lastSyncedAt: row?.last_synced_at || null,
      nextSyncAt: row?.next_sync_at || null,
      status: row?.sync_status || '',
      message: row?.sync_message || ''
    },
    status: row?.status || 'INATIVO',
    lastUpdate: row?.updated_at || row?.created_at || null
  };
}

export async function buscarContaWhatsappPrincipal(supabase, usuario) {
  const tenantId = obterTenantId(usuario);
  if (!tenantId) return null;

  const { data, error } = await supabase
    .from('whatsapp_business_accounts')
    .select(`
      id,
      tenant_id,
      nome,
      business_manager_id,
      business_manager_name,
      business_verification_status,
      waba_id,
      waba_name,
      waba_verification_status,
      verify_token,
      access_token,
      access_token_expires_at,
      access_token_obtained_at,
      access_token_type,
      access_token_source,
      access_token_metadata,
      token_debug_metadata,
      waba_validation_metadata,
      phone_validation_metadata,
      embedded_signup_completed,
      token_validated,
      waba_validated,
      phone_validated,
      production_ready,
      phone_registration_pending,
      phone_registered,
      phone_registration_failed,
      phone_registered_at,
      phone_registration_message,
      phone_registration_metadata,
      webhook_pending,
      webhook_verified,
      webhook_receiving_events,
      webhook_last_verified_at,
      webhook_last_event_at,
      webhook_last_signature_status,
      webhook_validation_message,
      last_synced_at,
      next_sync_at,
      sync_status,
      sync_message,
      status,
      principal,
      created_at,
      updated_at,
      whatsapp_business_numbers (
        id,
        phone_number_id,
        display_phone_number,
        display_name,
        verified_name,
        quality_rating,
        messaging_limit_tier,
        number_status,
        country_code,
        name_status,
        profile_about,
        profile_address,
        profile_description,
        profile_email,
        profile_websites,
        profile_vertical,
        profile_picture_url,
        profile_synced_at,
        status,
        principal
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('principal', true)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function buscarContaWhatsappPorVerifyToken(supabase, verifyToken) {
  const token = String(verifyToken || '').trim();
  if (!token) return null;

  const { data, error } = await supabase
    .from('whatsapp_business_accounts')
    .select(`
      id,
      tenant_id,
      nome,
      business_manager_id,
      waba_id,
      verify_token,
      webhook_verified
    `)
    .eq('verify_token', token)
    .eq('status', 'ATIVO')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function buscarContaWhatsappPorWabaOuNumero(supabase, { wabaId, phoneNumberId } = {}) {
  const waba = String(wabaId || '').trim();
  const phone = String(phoneNumberId || '').trim();

  if (waba) {
    const { data, error } = await supabase
      .from('whatsapp_business_accounts')
      .select('id, tenant_id, waba_id, verify_token, webhook_receiving_events')
      .eq('waba_id', waba)
      .eq('status', 'ATIVO')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  if (phone) {
    const { data, error } = await supabase
      .from('whatsapp_business_numbers')
      .select('account_id, tenant_id, phone_number_id, whatsapp_business_accounts(id, tenant_id, waba_id, verify_token, webhook_receiving_events)')
      .eq('phone_number_id', phone)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.whatsapp_business_accounts || null;
  }

  return null;
}

export async function atualizarWebhookContaWhatsapp(supabase, accountId, tenantId, dados = {}) {
  if (!accountId || !tenantId) return null;

  const payload = {
    updated_at: new Date().toISOString()
  };

  if ('webhook_pending' in dados) payload.webhook_pending = dados.webhook_pending;
  if ('webhook_verified' in dados) payload.webhook_verified = dados.webhook_verified;
  if ('webhook_receiving_events' in dados) payload.webhook_receiving_events = dados.webhook_receiving_events;
  if ('webhook_last_verified_at' in dados) payload.webhook_last_verified_at = dados.webhook_last_verified_at;
  if ('webhook_last_event_at' in dados) payload.webhook_last_event_at = dados.webhook_last_event_at;
  if ('webhook_last_signature_status' in dados) payload.webhook_last_signature_status = dados.webhook_last_signature_status;
  if ('webhook_validation_message' in dados) payload.webhook_validation_message = dados.webhook_validation_message;

  const { data, error } = await supabase
    .from('whatsapp_business_accounts')
    .update(payload)
    .eq('id', accountId)
    .eq('tenant_id', tenantId)
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

export async function salvarContaWhatsappEmbeddedSignup(supabase, usuario, dados = {}) {
  const tenantId = obterTenantId(usuario);
  if (!tenantId) {
    const err = new Error('Tenant atual nao identificado');
    err.statusCode = 400;
    throw err;
  }

  const businessId = String(dados.businessId || dados.business_id || '').trim();
  const wabaId = String(dados.wabaId || dados.waba_id || '').trim();
  const phoneNumberId = String(dados.phoneNumberId || dados.phone_number_id || '').trim();
  const phoneNumber = String(dados.phoneNumber || dados.phone_number || dados.displayPhoneNumber || '').trim();
  const displayName = String(dados.displayName || dados.display_name || '').trim();
  const verifiedName = String(dados.verifiedName || dados.verified_name || '').trim();
  const tokenData = dados.tokenData || null;
  const validationData = dados.validationData || null;
  const tokenStorage = createTokenStorageService();
  const tokenPayload = tokenStorage.prepareMetaAccessToken(tokenData || {});
  const embeddedSignupCompleted = Boolean(wabaId && phoneNumberId);
  const tokenValidated = Boolean(validationData?.tokenValidation?.valid);
  const wabaValidated = Boolean(validationData?.waba?.id);
  const phoneValidated = Boolean(validationData?.phone?.id);
  const productionReady = embeddedSignupCompleted && tokenValidated && wabaValidated && phoneValidated;

  if (!wabaId || !phoneNumberId) {
    const err = new Error('Embedded Signup incompleto: WABA ID e Phone Number ID sao obrigatorios');
    err.statusCode = 400;
    throw err;
  }

  const contaAtual = await buscarContaWhatsappPrincipal(supabase, usuario);
  const contaPayload = {
    tenant_id: tenantId,
    nome: displayName || verifiedName || contaAtual?.nome || 'WhatsApp Business',
    business_manager_id: businessId || contaAtual?.business_manager_id || null,
    waba_id: wabaId,
    verify_token: dados.verifyToken || dados.verify_token || contaAtual?.verify_token || null,
    access_token: tokenPayload.access_token || contaAtual?.access_token || null,
    access_token_expires_at: tokenPayload.access_token_expires_at || null,
    access_token_obtained_at: tokenPayload.access_token_obtained_at || contaAtual?.access_token_obtained_at || null,
    access_token_type: validationData?.tokenValidation?.tokenType || tokenPayload.access_token_type || contaAtual?.access_token_type || null,
    access_token_source: tokenData?.accessToken ? 'EMBEDDED_SIGNUP' : contaAtual?.access_token_source || 'MANUAL',
    access_token_metadata: tokenPayload.access_token
      ? tokenPayload.access_token_metadata
      : contaAtual?.access_token_metadata || {},
    token_debug_metadata: validationData?.debugData || contaAtual?.token_debug_metadata || {},
    waba_validation_metadata: validationData?.waba || contaAtual?.waba_validation_metadata || {},
    phone_validation_metadata: validationData?.phone || contaAtual?.phone_validation_metadata || {},
    embedded_signup_completed: embeddedSignupCompleted,
    token_validated: tokenValidated,
    waba_validated: wabaValidated,
    phone_validated: phoneValidated,
    production_ready: productionReady,
    status: 'ATIVO',
    principal: true,
    atualizado_por_id: usuario?.id || null,
    updated_at: new Date().toISOString()
  };

  if (!contaAtual?.id) {
    contaPayload.criado_por_id = usuario?.id || null;
  }

  const { data: conta, error: contaError } = contaAtual?.id
    ? await supabase
      .from('whatsapp_business_accounts')
      .update(contaPayload)
      .eq('id', contaAtual.id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single()
    : await supabase
      .from('whatsapp_business_accounts')
      .insert(contaPayload)
      .select('*')
      .single();

  if (contaError) throw contaError;

  const numerosAtuais = Array.isArray(contaAtual?.whatsapp_business_numbers)
    ? contaAtual.whatsapp_business_numbers
    : [];
  const numeroAtual = numerosAtuais.find(item => item?.phone_number_id === phoneNumberId)
    || numerosAtuais.find(item => item?.principal && item?.status !== 'INATIVO')
    || null;

  const numeroPayload = {
    tenant_id: tenantId,
    account_id: conta.id,
    phone_number_id: phoneNumberId,
    display_phone_number: phoneNumber || null,
    display_name: displayName || null,
    verified_name: verifiedName || null,
    status: 'ATIVO',
    principal: true,
    updated_at: new Date().toISOString()
  };

  const numeroResult = numeroAtual?.id
    ? await supabase
      .from('whatsapp_business_numbers')
      .update(numeroPayload)
      .eq('id', numeroAtual.id)
      .eq('tenant_id', tenantId)
    : await supabase
      .from('whatsapp_business_numbers')
      .insert(numeroPayload);

  if (numeroResult.error) throw numeroResult.error;

  return buscarContaWhatsappPrincipal(supabase, usuario);
}

export async function atualizarRegistroNumeroWhatsapp(supabase, usuario, dados = {}) {
  const tenantId = obterTenantId(usuario);
  if (!tenantId) {
    const err = new Error('Tenant atual nao identificado');
    err.statusCode = 400;
    throw err;
  }

  const contaAtual = await buscarContaWhatsappPrincipal(supabase, usuario);
  if (!contaAtual?.id) {
    const err = new Error('Conta WhatsApp Business nao encontrada para o tenant atual');
    err.statusCode = 404;
    throw err;
  }

  const status = String(dados.status || '').toUpperCase();
  const registered = status === 'REGISTERED';
  const failed = status === 'FAILED';
  const pending = status === 'PENDING';

  const { error } = await supabase
    .from('whatsapp_business_accounts')
    .update({
      phone_registration_pending: pending,
      phone_registered: registered,
      phone_registration_failed: failed,
      phone_registered_at: registered ? dados.registeredAt || new Date().toISOString() : contaAtual.phone_registered_at || null,
      phone_registration_message: dados.message || null,
      phone_registration_metadata: dados.metadata || {},
      updated_at: new Date().toISOString()
    })
    .eq('id', contaAtual.id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
  return buscarContaWhatsappPrincipal(supabase, usuario);
}

export async function salvarContaWhatsappPrincipal(supabase, usuario, dados = {}) {
  const tenantId = obterTenantId(usuario);
  if (!tenantId) {
    const err = new Error('Tenant atual nao identificado');
    err.statusCode = 400;
    throw err;
  }

  const contaAtual = await buscarContaWhatsappPrincipal(supabase, usuario);
  const accessToken = String(dados.accessToken || '').trim() || contaAtual?.access_token || '';
  const phoneNumberId = String(dados.phoneNumberId || '').trim();

  const contaPayload = {
    tenant_id: tenantId,
    nome: String(dados.nome || contaAtual?.nome || 'WhatsApp Business').trim(),
    business_manager_id: dados.businessManagerId || contaAtual?.business_manager_id || null,
    waba_id: dados.wabaId || contaAtual?.waba_id || null,
    verify_token: dados.verifyToken || contaAtual?.verify_token || null,
    access_token: accessToken,
    access_token_expires_at: null,
    access_token_obtained_at: accessToken ? new Date().toISOString() : contaAtual?.access_token_obtained_at || null,
    access_token_type: null,
    access_token_source: 'MANUAL',
    embedded_signup_completed: false,
    token_validated: false,
    waba_validated: false,
    phone_validated: Boolean(accessToken && phoneNumberId),
    production_ready: Boolean(accessToken && phoneNumberId),
    status: 'ATIVO',
    principal: true,
    atualizado_por_id: usuario?.id || null,
    updated_at: new Date().toISOString()
  };

  if (!contaAtual?.id) {
    contaPayload.criado_por_id = usuario?.id || null;
  }

  const { data: conta, error: contaError } = contaAtual?.id
    ? await supabase
      .from('whatsapp_business_accounts')
      .update(contaPayload)
      .eq('id', contaAtual.id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single()
    : await supabase
      .from('whatsapp_business_accounts')
      .insert(contaPayload)
      .select('*')
      .single();

  if (contaError) throw contaError;

  if (phoneNumberId) {
    const numerosAtuais = Array.isArray(contaAtual?.whatsapp_business_numbers)
      ? contaAtual.whatsapp_business_numbers
      : [];
    const numeroAtual = numerosAtuais.find(item => item?.principal && item?.status !== 'INATIVO')
      || numerosAtuais.find(item => item?.phone_number_id === phoneNumberId)
      || numerosAtuais[0]
      || null;

    const numeroPayload = {
      tenant_id: tenantId,
      account_id: conta.id,
      phone_number_id: phoneNumberId,
      status: 'ATIVO',
      principal: true,
      updated_at: new Date().toISOString()
    };

    const numeroResult = numeroAtual?.id
      ? await supabase
        .from('whatsapp_business_numbers')
        .update(numeroPayload)
        .eq('id', numeroAtual.id)
        .eq('tenant_id', tenantId)
      : await supabase
        .from('whatsapp_business_numbers')
        .insert(numeroPayload);

    if (numeroResult.error) throw numeroResult.error;
  }

  return buscarContaWhatsappPrincipal(supabase, usuario);
}
