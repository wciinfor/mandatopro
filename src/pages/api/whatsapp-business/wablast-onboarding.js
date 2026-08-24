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

    // Determina a redirect_uri baseada na origem da requisição ou fallback
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const redirectUri = `${protocol}://${host}/comunicacao-oficial/whatsapp-business?onboarding=wablast_complete`;

    const client = createWaBlastApiService();
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
    console.error('[WABLAST ONBOARDING API] Erro ao criar sessão:', error.message);
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Falha ao criar sessão de onboarding no WaBlast'
    });
  }
}
