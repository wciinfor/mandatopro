import { createMetaGraphApiService } from './meta-graph-api';
import { createWhatsAppWebhookEventLogger } from './whatsapp-webhook-event-logger';

const REQUIRED_SCOPES = ['whatsapp_business_management'];

function nowIso() {
  return new Date().toISOString();
}

function indicator(id, name, status, description, checkedAt = nowIso(), details = null) {
  return { id, name, status, description, checkedAt, details };
}

function pendingIf(list, condition, message) {
  if (condition) list.push(message);
}

async function safeCall(fn) {
  try {
    return { data: await fn(), error: null };
  } catch (error) {
    return { data: null, error };
  }
}

function hasScope(scopes, scope) {
  return Array.isArray(scopes) && scopes.includes(scope);
}

function phoneQualityStatus(value) {
  const quality = String(value || '').toUpperCase();
  if (['GREEN', 'HIGH'].includes(quality)) return 'OK';
  if (['YELLOW', 'MEDIUM', 'UNKNOWN', ''].includes(quality)) return 'Atenção';
  return 'Erro';
}

export async function gerarDiagnosticoWhatsappBusiness(conta, options = {}) {
  const checkedAt = nowIso();
  const graph = createMetaGraphApiService();
  const accessToken = conta?.access_token || '';
  const businessId = conta?.business_manager_id || '';
  const wabaId = conta?.waba_id || '';
  const number = Array.isArray(conta?.whatsapp_business_numbers)
    ? conta.whatsapp_business_numbers.find(item => item?.principal && item?.status !== 'INATIVO') || conta.whatsapp_business_numbers[0]
    : null;
  const phoneNumberId = number?.phone_number_id || '';
  const onboarding = {
    embeddedSignupCompleted: Boolean(conta?.embedded_signup_completed),
    tokenValidated: Boolean(conta?.token_validated),
    wabaValidated: Boolean(conta?.waba_validated),
    phoneValidated: Boolean(conta?.phone_validated),
    productionReady: Boolean(conta?.production_ready),
    webhookPending: Boolean(conta?.webhook_pending),
    webhookVerified: Boolean(conta?.webhook_verified),
    webhookReceivingEvents: Boolean(conta?.webhook_receiving_events),
    webhookLastVerifiedAt: conta?.webhook_last_verified_at || null,
    webhookLastEventAt: conta?.webhook_last_event_at || null,
    webhookLastSignatureStatus: conta?.webhook_last_signature_status || '',
    webhookValidationMessage: conta?.webhook_validation_message || ''
  };
  const latestWebhookEvent = options.supabase
    ? await createWhatsAppWebhookEventLogger(options.supabase).latestForTenant(conta?.tenant_id)
    : null;

  const debugResult = accessToken ? await safeCall(() => graph.debugToken(accessToken)) : { data: null, error: null };
  const debugData = debugResult.data || null;
  const tokenValidation = debugData ? graph.validarDebugToken(debugData, wabaId) : null;
  const businessResult = accessToken && businessId
    ? await safeCall(() => graph.obterBusiness(accessToken, businessId))
    : { data: null, error: null };
  const wabaResult = accessToken && wabaId
    ? await safeCall(() => graph.validarWaba(accessToken, wabaId))
    : { data: null, error: null };
  const phoneResult = accessToken && phoneNumberId
    ? await safeCall(() => graph.obterNumeroWhatsapp(accessToken, phoneNumberId))
    : { data: null, error: null };
  const numbersResult = accessToken && wabaId
    ? await safeCall(() => graph.listarNumerosWaba(accessToken, wabaId))
    : { data: null, error: null };
  const phoneBelongsToWaba = Array.isArray(numbersResult.data)
    ? numbersResult.data.some(item => String(item?.id || '') === String(phoneNumberId))
    : false;

  const scopes = tokenValidation?.scopes || [];
  const missingScopes = REQUIRED_SCOPES.filter(scope => !hasScope(scopes, scope));
  const expiresAt = tokenValidation?.expiresAt || conta?.access_token_expires_at || null;
  const expiresSoon = expiresAt
    ? new Date(expiresAt).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 30
    : false;
  const phoneQuality = phoneResult.data?.quality_rating || '';
  const messageLimit = phoneResult.data?.messaging_limit_tier || '';
  const productionReady = Boolean(
    onboarding.embeddedSignupCompleted
    && tokenValidation?.valid
    && wabaResult.data
    && phoneBelongsToWaba
  );

  const indicators = [
    indicator(
      'connection',
      'Status da conexão',
      accessToken && phoneNumberId ? 'OK' : 'Erro',
      accessToken && phoneNumberId
        ? 'Credenciais e número principal encontrados.'
        : 'Token ou número principal ausente.',
      checkedAt
    ),
    indicator(
      'embedded_signup',
      'Embedded Signup',
      onboarding.embeddedSignupCompleted ? 'OK' : 'Atenção',
      onboarding.embeddedSignupCompleted
        ? 'Fluxo Embedded Signup concluído para este tenant.'
        : 'Embedded Signup ainda não foi concluído.',
      checkedAt
    ),
    indicator(
      'token',
      'Token',
      tokenValidation?.valid ? (expiresSoon ? 'Atenção' : 'OK') : 'Erro',
      tokenValidation?.valid
        ? (expiresAt ? `Token válido até ${new Date(expiresAt).toLocaleDateString('pt-BR')}.` : 'Token válido sem expiração informada pela Meta.')
        : debugResult.error?.message || tokenValidation?.errors?.join(' ') || 'Token ausente ou inválido.',
      checkedAt,
      { expiresAt, tokenType: tokenValidation?.tokenType || conta?.access_token_type || null }
    ),
    indicator(
      'scopes',
      'Permissões (Scopes)',
      missingScopes.length ? 'Erro' : 'OK',
      missingScopes.length
        ? `Scopes ausentes: ${missingScopes.join(', ')}.`
        : 'Scopes obrigatórios concedidos.',
      checkedAt,
      { scopes, granularScopes: tokenValidation?.granularScopes || [] }
    ),
    indicator(
      'business_manager',
      'Business Manager',
      businessResult.data ? 'OK' : (businessId ? 'Erro' : 'Atenção'),
      businessResult.data
        ? `Business Manager ${businessResult.data.name || businessResult.data.id} acessível.`
        : businessResult.error?.message || 'Business Manager ID não informado.',
      checkedAt,
      businessResult.data
    ),
    indicator(
      'waba',
      'WABA',
      wabaResult.data ? 'OK' : (wabaId ? 'Erro' : 'Atenção'),
      wabaResult.data
        ? `WABA ${wabaResult.data.name || wabaResult.data.id} acessível.`
        : wabaResult.error?.message || 'WABA ID não informado.',
      checkedAt,
      wabaResult.data
    ),
    indicator(
      'phone_number',
      'Número do WhatsApp',
      phoneResult.data && phoneBelongsToWaba ? 'OK' : 'Erro',
      phoneResult.data && phoneBelongsToWaba
        ? `Número ${phoneResult.data.display_phone_number || phoneNumberId} pertence ao WABA autorizado.`
        : phoneResult.error?.message || 'Número não encontrado no WABA autorizado.',
      checkedAt,
      phoneResult.data
    ),
    indicator(
      'phone_quality',
      'Qualidade do Número',
      phoneQualityStatus(phoneQuality),
      phoneQuality
        ? `Qualidade informada pela Meta: ${phoneQuality}.`
        : 'Qualidade ainda não informada pela Meta.',
      checkedAt,
      { quality: phoneQuality || null }
    ),
    indicator(
      'message_limit',
      'Limite de Mensagens',
      messageLimit ? 'OK' : 'Atenção',
      messageLimit
        ? `Limite atual: ${messageLimit}.`
        : 'Limite de mensagens não retornado pela Meta.',
      checkedAt,
      { messagingLimitTier: messageLimit || null }
    ),
    indicator(
      'onboarding',
      'Estado do Onboarding',
      productionReady ? 'OK' : 'Atenção',
      productionReady
        ? 'Todas as etapas obrigatórias do onboarding técnico foram concluídas.'
        : 'Ainda existem etapas obrigatórias pendentes.',
      checkedAt,
      onboarding
    ),
    indicator(
      'webhook_configured',
      'Webhook configurado',
      conta?.verify_token ? 'OK' : 'Atenção',
      conta?.verify_token
        ? 'Verify token configurado para validação da Meta.'
        : 'Verify token ainda não configurado.',
      checkedAt
    ),
    indicator(
      'webhook_verified',
      'Webhook validado',
      onboarding.webhookVerified ? 'OK' : 'Atenção',
      onboarding.webhookVerified
        ? 'Callback validado pelo hub.challenge da Meta.'
        : 'Webhook ainda não foi validado pela Meta.',
      onboarding.webhookLastVerifiedAt || checkedAt
    ),
    indicator(
      'webhook_last_event',
      'Último evento recebido',
      latestWebhookEvent ? 'OK' : 'Atenção',
      latestWebhookEvent
        ? `Último evento: ${latestWebhookEvent.event_type || 'unknown'}.`
        : 'Nenhum evento oficial recebido até o momento.',
      latestWebhookEvent?.created_at || onboarding.webhookLastEventAt || checkedAt,
      latestWebhookEvent
    ),
    indicator(
      'webhook_last_validation',
      'Última validação',
      onboarding.webhookLastVerifiedAt ? 'OK' : 'Atenção',
      onboarding.webhookValidationMessage || 'Nenhuma validação registrada.',
      onboarding.webhookLastVerifiedAt || checkedAt
    ),
    indicator(
      'webhook_signature',
      'Status da assinatura',
      latestWebhookEvent?.signature_status === 'VALID' || onboarding.webhookLastSignatureStatus === 'VALID' ? 'OK' : 'Atenção',
      latestWebhookEvent?.signature_status
        ? `Assinatura do último evento: ${latestWebhookEvent.signature_status}.`
        : onboarding.webhookLastSignatureStatus
          ? `Último status de assinatura: ${onboarding.webhookLastSignatureStatus}.`
          : 'Nenhuma assinatura validada ainda.',
      latestWebhookEvent?.created_at || checkedAt
    ),
    indicator(
      'last_sync',
      'Última sincronização',
      'OK',
      `Diagnóstico executado em ${new Date(checkedAt).toLocaleString('pt-BR')}.`,
      checkedAt
    )
  ];

  const pendencias = [];
  pendingIf(pendencias, !accessToken, 'Token de acesso não encontrado.');
  pendingIf(pendencias, !phoneNumberId, 'Phone Number ID não encontrado.');
  pendingIf(pendencias, !onboarding.embeddedSignupCompleted, 'Embedded Signup ainda não concluído.');
  pendingIf(pendencias, !tokenValidation?.valid, 'Token não validado pela Meta.');
  pendingIf(pendencias, missingScopes.length > 0, `Scopes obrigatórios ausentes: ${missingScopes.join(', ')}.`);
  pendingIf(pendencias, !businessResult.data, 'Business Manager não validado.');
  pendingIf(pendencias, !wabaResult.data, 'WABA não validada.');
  pendingIf(pendencias, !phoneBelongsToWaba, 'Número do WhatsApp não validado dentro do WABA.');
  pendingIf(pendencias, !conta?.verify_token, 'Verify token do webhook não configurado.');
  pendingIf(pendencias, !onboarding.webhookVerified, 'Webhook ainda não validado pela Meta.');
  pendingIf(pendencias, expiresSoon, 'Token expira em menos de 30 dias.');

  return {
    ready: pendencias.length === 0,
    summary: pendencias.length === 0
      ? 'Integração pronta'
      : 'Existem pendências antes da produção',
    pending: pendencias,
    checkedAt,
    indicators
  };
}
