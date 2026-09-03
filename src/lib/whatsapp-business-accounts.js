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
    provider: row?.provider || 'META',
    nome: row?.nome || '',
    businessManagerId: row?.business_manager_id || '',
    businessManagerName: row?.business_manager_name || '',
    businessVerificationStatus: row?.business_verification_status || '',
    wabaId: row?.waba_id || '',
    wabaName: row?.waba_name || '',
    wabaVerificationStatus: row?.waba_verification_status || '',
    verifyTokenConfigured: Boolean(row?.verify_token),
    ycloudApiKeyConfigured: Boolean(row?.ycloud_api_key),
    ycloudWebhookEndpointId: row?.ycloud_webhook_endpoint_id || '',
    ycloudWebhookSecretConfigured: Boolean(row?.ycloud_webhook_secret),
    wablastAccountId: row?.wablast_account_id || '',
    wablastExternalRef: row?.wablast_external_ref || '',
    wablastWabaId: row?.wablast_waba_id || '',
    phoneNumberId: number?.phone_number_id || '',
    displayPhoneNumber: number?.display_phone_number || '',
    displayName: number?.display_name || '',
    verifiedName: number?.verified_name || '',
    bsuid: number?.bsuid || '',
    qualityRating: number?.quality_rating || '',
    messagingLimitTier: number?.messaging_limit_tier || '',
    numberStatus: number?.number_status || '',
    countryCode: number?.country_code || '',
    nameStatus: number?.name_status || '',
    profilePictureUrl: number?.profile_picture_url || '',
    hasAccessToken: Boolean(row?.access_token || row?.ycloud_api_key),
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
    isConnected: Boolean(
      ((row?.provider === 'WABLAST' ? row?.wablast_account_id : (row?.access_token || row?.ycloud_api_key))) && 
      (number?.phone_number_id || number?.display_phone_number)
    ),
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

  const { data: contas, error } = await supabase
    .from('whatsapp_business_accounts')
    .select(`
      id,
      tenant_id,
      provider,
      nome,
      business_manager_id,
      business_manager_name,
      business_verification_status,
      waba_id,
      waba_name,
      waba_verification_status,
      verify_token,
      ycloud_api_key,
      ycloud_webhook_endpoint_id,
      ycloud_webhook_secret,
      wablast_account_id,
      wablast_external_ref,
      wablast_waba_id,
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
        bsuid,
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
    .eq('status', 'ATIVO')
    .order('principal', { ascending: false })
    .order('id', { ascending: true });

  if (error) throw error;

  if (!contas || contas.length === 0) return null;

  // 1. Se existir uma conta explicitamente marcada como principal=true e ATIVA, priorizá-la estritamente
  const contaPrincipal = contas.find(row => row.principal === true);
  if (contaPrincipal) {
    return contaPrincipal;
  }

  // 2. Se nenhuma estiver como principal=true, seleciona a primeira ativa que possua credencial configurada
  const contaComCredencial = contas.find(row => Boolean(row.access_token || row.ycloud_api_key));

  return contaComCredencial || contas[0];
}

export async function alterarProvedorWhatsappAtivo(supabase, usuario, providerDesejado) {
  const tenantId = obterTenantId(usuario);
  if (!tenantId) {
    const err = new Error('Tenant atual não identificado');
    err.statusCode = 400;
    throw err;
  }

  const targetProvider = String(providerDesejado || '').toUpperCase();
  if (!['META', 'YCLOUD', 'WABLAST'].includes(targetProvider)) {
    const err = new Error('Provedor inválido. Escolha META, YCLOUD ou WABLAST');
    err.statusCode = 400;
    throw err;
  }

  // Buscar todas as contas ATIVAS do tenant
  const { data: contas, error } = await supabase
    .from('whatsapp_business_accounts')
    .select(`
      *,
      whatsapp_business_numbers (*)
    `)
    .eq('tenant_id', tenantId)
    .eq('status', 'ATIVO');

  if (error) throw error;

  const contaAlvo = (contas || []).find(c => String(c.provider || '').toUpperCase() === targetProvider);

  if (!contaAlvo) {
    const err = new Error(`Nenhuma conta de WhatsApp do provedor ${targetProvider} cadastrada para este gabinete`);
    err.statusCode = 400;
    throw err;
  }

  // Validação estrita de completude do provedor alvo
  const temNumero = Array.isArray(contaAlvo.whatsapp_business_numbers) && contaAlvo.whatsapp_business_numbers.some(n => n.phone_number_id && n.status !== 'INATIVO');

  if (targetProvider === 'YCLOUD') {
    if (!contaAlvo.ycloud_api_key) {
      const err = new Error('Conta YCloud selecionada não possui API Key preenchida');
      err.statusCode = 400;
      throw err;
    }
    if (!temNumero) {
      const err = new Error('Conta YCloud selecionada não possui número WhatsApp vinculado');
      err.statusCode = 400;
      throw err;
    }
  } else if (targetProvider === 'META') {
    if (!contaAlvo.access_token) {
      const err = new Error('Conta Meta Cloud API selecionada não possui Access Token válido');
      err.statusCode = 400;
      throw err;
    }
    if (!temNumero) {
      const err = new Error('Conta Meta Cloud API selecionada não possui número WhatsApp vinculado');
      err.statusCode = 400;
      throw err;
    }
  } else if (targetProvider === 'WABLAST') {
    if (!contaAlvo.wablast_account_id) {
      const err = new Error('Conta WaBlast selecionada não possui Account ID vinculado');
      err.statusCode = 400;
      throw err;
    }
    if (!temNumero) {
      const err = new Error('Conta WaBlast selecionada não possui número WhatsApp vinculado');
      err.statusCode = 400;
      throw err;
    }
  }

  // Transação segura: Remove principal=true de TODAS as contas do tenant e define principal=true na contaAlvo
  const { error: errReset } = await supabase
    .from('whatsapp_business_accounts')
    .update({ principal: false, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId);

  if (errReset) throw errReset;

  const { error: errSet } = await supabase
    .from('whatsapp_business_accounts')
    .update({ principal: true, updated_at: new Date().toISOString() })
    .eq('id', contaAlvo.id)
    .eq('tenant_id', tenantId);

  if (errSet) throw errSet;

  return buscarContaWhatsappPrincipal(supabase, usuario);
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

export async function buscarContaWhatsappPorYCloudEndpointId(supabase, endpointId) {
  const ep = String(endpointId || '').trim();
  if (!ep) return null;

  const { data, error } = await supabase
    .from('whatsapp_business_accounts')
    .select(`
      id,
      tenant_id,
      provider,
      nome,
      waba_id,
      ycloud_webhook_endpoint_id,
      ycloud_webhook_secret,
      status
    `)
    .eq('ycloud_webhook_endpoint_id', ep)
    .eq('provider', 'YCLOUD')
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

  // Localiza a conta principal existente do tenant (com ou sem credencial, ativa ou não) para evitar duplicidade de principal
  const { data: contasExistentes } = await supabase
    .from('whatsapp_business_accounts')
    .select(`
      id,
      tenant_id,
      provider,
      nome,
      business_manager_id,
      waba_id,
      verify_token,
      access_token,
      access_token_obtained_at,
      status,
      principal,
      whatsapp_business_numbers (
        id,
        phone_number_id,
        status,
        principal
      )
    `)
    .eq('tenant_id', tenantId)
    .order('principal', { ascending: false })
    .order('id', { ascending: true });

  const contaAtual = contasExistentes?.find(c => c.principal) || contasExistentes?.[0] || null;
  const accessToken = String(dados.accessToken || '').trim() || contaAtual?.access_token || '';
  const phoneNumberId = String(dados.phoneNumberId || '').trim();

  const contaPayload = {
    tenant_id: tenantId,
    provider: 'META',
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

export async function salvarContaWhatsappYCloud(supabase, usuario, dados = {}) {
  const tenantId = obterTenantId(usuario);
  if (!tenantId) {
    const err = new Error('Tenant atual não identificado');
    err.statusCode = 400;
    throw err;
  }

  const contaAtual = await buscarContaWhatsappPrincipal(supabase, usuario);
  const ycloudApiKey = String(dados.ycloudApiKey || '').trim() || contaAtual?.ycloud_api_key || '';
  const ycloudWebhookEndpointId = String(dados.ycloudWebhookEndpointId || '').trim() || contaAtual?.ycloud_webhook_endpoint_id || '';
  const ycloudWebhookSecret = String(dados.ycloudWebhookSecret || '').trim() || contaAtual?.ycloud_webhook_secret || '';
  const phoneNumberId = String(dados.phoneNumberId || dados.displayPhoneNumber || '').trim();

  const contaPayload = {
    tenant_id: tenantId,
    provider: 'YCLOUD',
    nome: String(dados.nome || contaAtual?.nome || 'WhatsApp Business YCloud').trim(),
    waba_id: dados.wabaId || contaAtual?.waba_id || null,
    ycloud_api_key: ycloudApiKey,
    ycloud_webhook_endpoint_id: ycloudWebhookEndpointId,
    ycloud_webhook_secret: ycloudWebhookSecret,
    token_validated: Boolean(ycloudApiKey),
    phone_validated: Boolean(phoneNumberId),
    production_ready: Boolean(ycloudApiKey && phoneNumberId),
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
      display_phone_number: dados.displayPhoneNumber || phoneNumberId,
      display_name: dados.displayName || null,
      bsuid: dados.bsuid || null,
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

export async function salvarContaWhatsappWaBlast(supabase, usuario, dados = {}) {
  const tenantId = obterTenantId(usuario);
  if (!tenantId) {
    const err = new Error('Tenant atual não identificado');
    err.statusCode = 400;
    throw err;
  }

  const contaAtual = await buscarContaWhatsappPrincipal(supabase, usuario);
  const wablastAccountId = String(dados.wablastAccountId || dados.accountId || '').trim() || contaAtual?.wablast_account_id || '';
  const wablastWabaId = String(dados.wablastWabaId || dados.wabaId || '').trim() || contaAtual?.wablast_waba_id || null;
  const phoneNumberId = String(dados.phoneNumberId || dados.displayPhoneNumber || '').trim();

  const contaPayload = {
    tenant_id: tenantId,
    provider: 'WABLAST',
    nome: String(dados.nome || contaAtual?.nome || 'WhatsApp Business WaBlast').trim(),
    waba_id: wablastWabaId,
    wablast_waba_id: wablastWabaId,
    wablast_account_id: wablastAccountId,
    wablast_external_ref: `tenant_${tenantId}`,
    token_validated: Boolean(wablastAccountId),
    phone_validated: Boolean(phoneNumberId),
    production_ready: Boolean(wablastAccountId && phoneNumberId),
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
      display_phone_number: dados.displayPhoneNumber || phoneNumberId,
      display_name: dados.displayName || null,
      bsuid: dados.bsuid || null,
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

/**
 * Resolve a conta de WhatsApp correta para responder a uma conversa de atendimento,
 * garantindo que a resposta saia pelo mesmo provedor e número do gabinete que recebeu
 * a última mensagem de entrada do eleitor (preservando a janela de 24 horas aberta).
 *
 * Ordem estrita de resolução:
 * 1. Última mensagem de ENTRADA da conversa (analisando destinatário `to`, provider, WABA ID ou phoneNumberId).
 * 2. Metadados da própria conversa (`metadata.provider`, `metadata.origem`, `metadata.numero_gabinete`).
 * 3. Fallback: conta principal ativa do tenant (`buscarContaWhatsappPrincipal`).
 *
 * @param {Object} supabase - Cliente Supabase do servidor
 * @param {Object} conversa - Registro da conversa em atendimento_connect_conversas
 * @param {Object} usuario - Usuário autenticado
 * @returns {Promise<{ conta: Object, resolucaoInfo: Object }>}
 */
export async function resolverContaWhatsappDaConversa(supabase, conversa, usuario) {
  const tenantId = obterTenantId(usuario) || Number(conversa?.tenant_id || 1);

  // 1. Busca todas as contas ativas do tenant com seus números
  const { data: todasContas, error: errContas } = await supabase
    .from('whatsapp_business_accounts')
    .select(`
      id,
      tenant_id,
      provider,
      nome,
      principal,
      status,
      access_token,
      ycloud_api_key,
      wablast_account_id,
      wablast_waba_id,
      waba_id,
      whatsapp_business_numbers (
        id,
        phone_number_id,
        display_phone_number,
        display_name,
        verified_name,
        status,
        principal
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('status', 'ATIVO');

  if (errContas) {
    console.error('[RESOLVER CONTA CONVERSA] Erro ao buscar contas ativas:', errContas.message);
  }

  const contas = todasContas || [];

  let contaResolvida = null;
  let motivoResolucao = 'fallback_principal';
  let numeroGabineteIdentificado = null;

  // Helper para buscar conta por telefone do gabinete
  const encontrarContaPorTelefone = (telBruto) => {
    if (!telBruto) return null;
    const clean = String(telBruto).replace(/\D/g, '');
    if (!clean) return null;

    return contas.find(c => {
      const nums = Array.isArray(c.whatsapp_business_numbers) ? c.whatsapp_business_numbers : [];
      return nums.some(n => {
        const cleanDisplay = String(n.display_phone_number || '').replace(/\D/g, '');
        const cleanPhoneId = String(n.phone_number_id || '').replace(/\D/g, '');
        return cleanDisplay === clean || cleanPhoneId === clean;
      });
    });
  };

  // Helper para buscar conta por WABA ID
  const encontrarContaPorWaba = (wabaId) => {
    if (!wabaId) return null;
    const wabaStr = String(wabaId).trim();
    return contas.find(c => {
      return String(c.waba_id || '').trim() === wabaStr
        || String(c.wablast_waba_id || '').trim() === wabaStr;
    });
  };

  // Helper para buscar conta por provider ('YCLOUD', 'WABLAST', 'META')
  const encontrarContaPorProvider = (providerNome) => {
    if (!providerNome) return null;
    const provNorm = String(providerNome).toUpperCase();
    return contas.find(c => String(c.provider || '').toUpperCase() === provNorm);
  };

  // ─── PASSO 1: Analisar última mensagem de ENTRADA da conversa ───────────────
  if (conversa?.id) {
    const { data: ultEntrada, error: errEntrada } = await supabase
      .from('atendimento_connect_mensagens')
      .select('id, direcao, raw_payload, created_at')
      .eq('conversa_id', conversa.id)
      .eq('direcao', 'entrada')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!errEntrada && ultEntrada) {
      const payload = ultEntrada.raw_payload || {};
      const inboundMsg = payload.whatsappInboundMessage || {};

      // 1.1 Tentar pelo número receptor (`to`) no payload da mensagem de entrada
      const receptorRaw = inboundMsg.to || payload.to || payload.recipient || null;
      if (receptorRaw) {
        const contaPorReceptor = encontrarContaPorTelefone(receptorRaw);
        if (contaPorReceptor) {
          contaResolvida = contaPorReceptor;
          numeroGabineteIdentificado = receptorRaw;
          motivoResolucao = 'ultima_entrada_numero_to';
        }
      }

      // 1.2 Tentar pelo WABA ID no payload da mensagem de entrada
      if (!contaResolvida) {
        const wabaEntrada = inboundMsg.wabaId || payload.waba_id || payload.wabaId || null;
        if (wabaEntrada) {
          const contaPorWaba = encontrarContaPorWaba(wabaEntrada);
          if (contaPorWaba) {
            contaResolvida = contaPorWaba;
            motivoResolucao = 'ultima_entrada_waba_id';
          }
        }
      }

      // 1.3 Tentar por indicação explícita de provider na mensagem de entrada
      if (!contaResolvida) {
        const provEntrada = payload.provider || (payload.type?.startsWith('whatsapp.') ? 'YCLOUD' : null);
        if (provEntrada) {
          const contaPorProv = encontrarContaPorProvider(provEntrada);
          if (contaPorProv) {
            contaResolvida = contaPorProv;
            motivoResolucao = 'ultima_entrada_provider';
          }
        }
      }
    }
  }

  // ─── PASSO 2: Analisar metadados da Conversa (`metadata`) ───────────────────
  if (!contaResolvida && conversa?.metadata && typeof conversa.metadata === 'object') {
    const meta = conversa.metadata;

    // 2.1 Pelo número do gabinete registrado no metadata
    if (meta.numero_gabinete || meta.phoneNumberId) {
      const contaPorMetaTel = encontrarContaPorTelefone(meta.numero_gabinete || meta.phoneNumberId);
      if (contaPorMetaTel) {
        contaResolvida = contaPorMetaTel;
        numeroGabineteIdentificado = meta.numero_gabinete || meta.phoneNumberId;
        motivoResolucao = 'metadata_conversa_numero_gabinete';
      }
    }

    // 2.2 Pelo WABA ID no metadata
    if (!contaResolvida && meta.wabaId) {
      const contaPorMetaWaba = encontrarContaPorWaba(meta.wabaId);
      if (contaPorMetaWaba) {
        contaResolvida = contaPorMetaWaba;
        motivoResolucao = 'metadata_conversa_waba_id';
      }
    }

    // 2.3 Pelo provider ou origem no metadata
    if (!contaResolvida) {
      let provSugerido = meta.provider || null;
      if (!provSugerido && meta.origem === 'ycloud') provSugerido = 'YCLOUD';
      if (!provSugerido && meta.origem === 'wablast') provSugerido = 'WABLAST';
      if (!provSugerido && meta.origem === 'whatsapp_meta') provSugerido = 'META';

      if (provSugerido) {
        const contaPorMetaProv = encontrarContaPorProvider(provSugerido);
        if (contaPorMetaProv) {
          contaResolvida = contaPorMetaProv;
          motivoResolucao = 'metadata_conversa_origem_provider';
        }
      }
    }
  }

  // ─── PASSO 3: Fallback final para a conta principal do tenant ────────────────
  if (!contaResolvida) {
    contaResolvida = await buscarContaWhatsappPrincipal(supabase, usuario);
    motivoResolucao = 'fallback_conta_principal';
  }

  const normalizada = normalizarWhatsappAccount(contaResolvida);
  const numeroGabineteFinal = numeroGabineteIdentificado || normalizada.displayPhoneNumber || normalizada.phoneNumberId || 'N/A';

  const resolucaoInfo = {
    conversaId: conversa?.id || null,
    provider: contaResolvida?.provider || normalizada.provider || 'DESCONHECIDO',
    account_id: contaResolvida?.id || normalizada.id || null,
    numero_gabinete: numeroGabineteFinal,
    motivo_resolucao: motivoResolucao
  };

  console.log('[ATENDIMENTO CONNECT RESOLVER] Conta resolvida para resposta:', resolucaoInfo);

  return {
    conta: contaResolvida,
    resolucaoInfo
  };
}



