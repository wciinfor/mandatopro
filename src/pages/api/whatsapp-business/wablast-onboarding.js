import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import { obterTenantId } from '@/lib/tenant';
import { createWaBlastApiService } from '@/services/wablast-api';

/**
 * Endpoint para iniciar a sessão oficial de Onboarding Partner do WaBlast.
 * 
 * Regras de Segurança:
 * 1. Autenticação obrigatória (somente Administrador/Liderança do Tenant).
 * 2. external_ref determinístico por tenant: `tenant_${tenantId}`.
 * 3. WABLAST_API_KEY executada exclusivamente no servidor.
 * 4. Retorna somente `id`, `embed_url`, `expires_at`, `external_ref`.
 * 5. Não altera o provider ativo nem persiste account_id antecipadamente.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    const externalRef = `tenant_${tenantId}`;

    // Determina a redirect_uri preservando o hostname e protocolo da requisição
    const rawHost = req.headers['x-forwarded-host'] || req.headers.host || 'mandatopro.vercel.app';
    const cleanHost = String(rawHost).split(',')[0].trim().split(':')[0].trim().toLowerCase();
    const protocol = req.headers['x-forwarded-proto'] || (cleanHost.includes('localhost') ? 'http' : 'https');
    const redirectUri = `${protocol}://${rawHost}/comunicacao-oficial/whatsapp-business?onboarding=wablast_complete`;

    const client = createWaBlastApiService();

    // Cria a sessão oficial de Onboarding diretamente
    const session = await client.createOnboardingSession({
      externalRef,
      redirectUri
    });

    // Persiste a sessão no banco para permitir consulta/sincronização posterior
    try {
      const { data: contaExistente } = await supabase
        .from('whatsapp_business_accounts')
        .select('id, token_debug_metadata')
        .eq('tenant_id', tenantId)
        .eq('provider', 'WABLAST')
        .maybeSingle();

      const metadataAtual = (contaExistente?.token_debug_metadata && typeof contaExistente.token_debug_metadata === 'object')
        ? contaExistente.token_debug_metadata
        : {};

      const metadataAtualizada = {
        ...metadataAtual,
        wablast_session: {
          id: session.id,
          external_ref: externalRef,
          expires_at: session.expires_at || null,
          created_at: new Date().toISOString(),
          status: 'PENDING'
        }
      };

      if (contaExistente?.id) {
        await supabase
          .from('whatsapp_business_accounts')
          .update({
            wablast_external_ref: externalRef,
            token_debug_metadata: metadataAtualizada,
            updated_at: new Date().toISOString()
          })
          .eq('id', contaExistente.id);
      } else {
        await supabase
          .from('whatsapp_business_accounts')
          .insert({
            tenant_id: tenantId,
            provider: 'WABLAST',
            nome: 'WhatsApp Business WaBlast',
            status: 'ATIVO',
            principal: false,
            production_ready: false,
            wablast_external_ref: externalRef,
            token_debug_metadata: metadataAtualizada,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }
    } catch (saveSessionErr) {
      console.warn('[WABLAST ONBOARDING] Falha ao persistir sessão localmente:', saveSessionErr.message);
    }

    // Resposta estritamente segura para o frontend
    return res.status(200).json({
      success: true,
      id: session.id,
      embed_url: session.embed_url,
      expires_at: session.expires_at,
      external_ref: externalRef
    });
  } catch (error) {
    console.error('[WABLAST ONBOARDING API] Erro ao criar sessão:', error.message, error.details || '');
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Falha ao criar sessão de onboarding no WaBlast',
      details: error.details || null
    });
  }
}
