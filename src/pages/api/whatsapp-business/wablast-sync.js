import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import { obterTenantId } from '@/lib/tenant';
import { createWaBlastApiService } from '@/services/wablast-api';
import { normalizarWhatsappAccount } from '@/lib/whatsapp-business-accounts';

/**
 * Endpoint para consultar e sincronizar o status da sessão de onboarding WaBlast.
 * 
 * Regras:
 * 1. Não cria nova sessão.
 * 2. Consulta a sessão pendente do tenant via WaBlastApiService.getOnboardingSession().
 * 3. Se a sessão estiver concluída, persiste os dados oficiais (account_id, waba_id, number)
 *    de forma idempotente nas tabelas whatsapp_business_accounts e whatsapp_business_numbers.
 * 4. Mantém o provider como 'WABLAST' sem forçar principal=true para não alterar Meta/YCloud indevidamente.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  let supabase;
  let usuario;

  try {
    supabase = createServerClient();
    const auth = await obterUsuarioAutenticado(req, supabase);
    usuario = auth.usuario;
    exigirAdministrador(usuario);
  } catch (error) {
    const status = error?.statusCode || 401;
    return res.status(status).json({ success: false, error: error.message || 'Erro de autenticação' });
  }

  try {
    const tenantId = obterTenantId(usuario);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant atual não identificado' });
    }

    // 1. Localiza a conta WaBlast do tenant contendo a sessão persistida
    const { data: contaWablast } = await supabase
      .from('whatsapp_business_accounts')
      .select('id, token_debug_metadata, wablast_account_id, wablast_waba_id, wablast_external_ref')
      .eq('tenant_id', tenantId)
      .eq('provider', 'WABLAST')
      .maybeSingle();

    const sessionId = req.query?.session_id || req.body?.session_id || contaWablast?.token_debug_metadata?.wablast_session?.id;

    if (!sessionId) {
      return res.status(200).json({
        success: true,
        status: 'NO_SESSION',
        message: 'Nenhuma sessão de onboarding pendente para este tenant'
      });
    }

    const client = createWaBlastApiService();
    let sessionData = null;

    try {
      sessionData = await client.getOnboardingSession(sessionId);
    } catch (sessionErr) {
      console.error('[WABLAST SYNC] Erro ao consultar sessão:', sessionErr.message, sessionErr.details || '');
      return res.status(200).json({
        success: false,
        status: 'ERROR',
        error: sessionErr.message || 'Falha ao consultar sessão na WaBlast',
        details: sessionErr.details || null
      });
    }

    const sessionStatus = String(sessionData?.status || '').toUpperCase();
    const isCompleted = sessionStatus === 'COMPLETED' || sessionStatus === 'CONNECTED' || sessionStatus === 'SUCCESS' || Boolean(sessionData?.account_id);

    // Se ainda estiver pendente
    if (!isCompleted) {
      return res.status(200).json({
        success: true,
        status: 'PENDING',
        session_status: sessionStatus,
        message: 'A sessão de onboarding ainda está sendo processada pela WaBlast/Meta'
      });
    }

    // 2. Extrai campos oficiais retornados pela API WaBlast
    const accountId = sessionData.account_id || sessionData.id;
    const wabaId = sessionData.waba_id || null;
    const rawPhone = sessionData.phone_number || sessionData.display_phone_number || null;
    const phoneNumberId = sessionData.phone_number_id || rawPhone || null;
    const displayName = sessionData.display_name || sessionData.verified_name || 'Ação Social';
    const externalRef = sessionData.external_ref || `tenant_${tenantId}`;

    const metadataAtual = (contaWablast?.token_debug_metadata && typeof contaWablast.token_debug_metadata === 'object')
      ? contaWablast.token_debug_metadata
      : {};

    const metadataAtualizada = {
      ...metadataAtual,
      wablast_session: {
        ...(metadataAtual.wablast_session || {}),
        id: sessionId,
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        raw_result: {
          account_id: accountId,
          waba_id: wabaId,
          phone_number: rawPhone
        }
      }
    };

    const updateAccountPayload = {
      wablast_account_id: accountId,
      wablast_waba_id: wabaId,
      wablast_external_ref: externalRef,
      waba_id: wabaId || undefined,
      phone_validated: Boolean(phoneNumberId),
      production_ready: Boolean(accountId),
      token_debug_metadata: metadataAtualizada,
      updated_at: new Date().toISOString()
    };

    let targetAccountId = contaWablast?.id;

    if (targetAccountId) {
      await supabase
        .from('whatsapp_business_accounts')
        .update(updateAccountPayload)
        .eq('id', targetAccountId)
        .eq('tenant_id', tenantId);
    } else {
      const { data: novaConta, error: errCriaConta } = await supabase
        .from('whatsapp_business_accounts')
        .insert({
          tenant_id: tenantId,
          provider: 'WABLAST',
          nome: 'WhatsApp Business WaBlast',
          status: 'ATIVO',
          principal: false,
          created_at: new Date().toISOString(),
          ...updateAccountPayload
        })
        .select('id')
        .single();

      if (errCriaConta) throw errCriaConta;
      targetAccountId = novaConta?.id;
    }

    // 3. Persiste/Atualiza whatsapp_business_numbers de forma idempotente
    if (targetAccountId && phoneNumberId) {
      const { data: numExistente } = await supabase
        .from('whatsapp_business_numbers')
        .select('id')
        .eq('account_id', targetAccountId)
        .maybeSingle();

      const numPayload = {
        tenant_id: tenantId,
        account_id: targetAccountId,
        phone_number_id: phoneNumberId,
        display_phone_number: rawPhone || phoneNumberId,
        display_name: displayName,
        verified_name: displayName,
        status: 'ATIVO',
        principal: true,
        updated_at: new Date().toISOString()
      };

      if (numExistente?.id) {
        await supabase
          .from('whatsapp_business_numbers')
          .update(numPayload)
          .eq('id', numExistente.id);
      } else {
        await supabase
          .from('whatsapp_business_numbers')
          .insert(numPayload);
      }
    }

    console.log(`[WABLAST SYNC] Sincronização concluída com sucesso para tenant=${tenantId}, accountId=${accountId}`);

    return res.status(200).json({
      success: true,
      status: 'COMPLETED',
      message: 'WhatsApp WABLAST conectado e sincronizado com sucesso.',
      account_id: accountId,
      waba_id: wabaId,
      phone_number: rawPhone
    });

  } catch (error) {
    console.error('[WABLAST SYNC API] Erro interno:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao sincronizar onboarding WaBlast'
    });
  }
}
