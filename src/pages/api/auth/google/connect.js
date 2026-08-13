import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterContextoMandato } from '@/lib/mandato-auth';
import { gerareUrlAutorizacaoGoogle } from '@/lib/google-calendar';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    // Resolva estritamente o mandato ativo do usuário (impede acoplamento com mandato arbitrário enviado via query)
    const contextoMandato = await obterContextoMandato(req, usuario, supabase);

    // Payload de estado contendo o mandato id autorizado e timestamp para evitar CSRF
    const statePayload = Buffer.from(JSON.stringify({
      mandatoId: contextoMandato.mandatoId,
      usuarioId: usuario.id,
      timestamp: Date.now()
    })).toString('base64url');

    const authUrl = gerareUrlAutorizacaoGoogle(statePayload);

    return res.status(200).json({ authUrl, mandatoId: contextoMandato.mandatoId });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({
      error: error.message || 'Erro ao gerar URL de conexão com Google Calendar'
    });
  }
}
