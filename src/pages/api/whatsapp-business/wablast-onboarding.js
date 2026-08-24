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

    // Determina a redirect_uri e o hostname limpo para registro
    const rawHost = req.headers['x-forwarded-host'] || req.headers.host || 'mandatopro.vercel.app';
    const cleanHost = String(rawHost).split(',')[0].trim().split(':')[0].trim().toLowerCase();
    const protocol = req.headers['x-forwarded-proto'] || (cleanHost.includes('localhost') ? 'http' : 'https');
    const redirectUri = `${protocol}://${rawHost}/comunicacao-oficial/whatsapp-business?onboarding=wablast_complete`;

    const client = createWaBlastApiService();

    // 1. Garante que o hostname esteja registrado como domínio de REDIRECT (Idempotente)
    if (cleanHost && cleanHost !== 'localhost' && cleanHost !== '127.0.0.1') {
      try {
        await client.registerOnboardingDomain(cleanHost);
        console.log(`[WABLAST ONBOARDING] Domínio ${cleanHost} registrado com sucesso.`);
      } catch (domainErr) {
        const errorMsg = String(domainErr?.message || '').toLowerCase();
        const detailsMsg = JSON.stringify(domainErr?.details || '').toLowerCase();
        const status = domainErr?.status || 0;

        // Identifica estritamente se o erro indica que o domínio já está registrado
        const isAlreadyRegistered = status === 409 || 
                                    errorMsg.includes('already') || 
                                    errorMsg.includes('already_exists') ||
                                    errorMsg.includes('exists') || 
                                    errorMsg.includes('duplicate') ||
                                    detailsMsg.includes('already') ||
                                    detailsMsg.includes('already_exists') ||
                                    detailsMsg.includes('exists') ||
                                    detailsMsg.includes('duplicate');

        if (isAlreadyRegistered) {
          console.log(`[WABLAST ONBOARDING] Domínio ${cleanHost} já estava registrado anteriormente.`);
        } else {
          // Erro real no registro do domínio: interrompe o fluxo e não prossegue para a criação de sessão
          console.error(`[WABLAST ONBOARDING] Falha ao registrar domínio ${cleanHost}:`, domainErr.message, domainErr.details || '');
          const domainError = new Error(`Falha ao registrar domínio de redirecionamento no WaBlast: ${domainErr.message}`);
          domainError.status = domainErr.status || 400;
          domainError.details = domainErr.details || null;
          throw domainError;
        }
      }
    }

    // 2. Cria a sessão oficial de Onboarding
    const session = await client.createOnboardingSession({
      externalRef,
      redirectUri
    });

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
