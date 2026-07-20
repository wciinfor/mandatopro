import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import { buscarContaWhatsappPrincipal } from '@/lib/whatsapp-business-accounts';
import { sincronizarContaWhatsappBusiness } from '@/services/whatsapp-business-sync';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  let supabase;
  let usuario;

  try {
    supabase = createServerClient();
    const auth = await obterUsuarioAutenticado(req, supabase);
    usuario = auth.usuario;
    exigirAdministrador(usuario);
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ error: error.message || 'Erro de autenticacao' });
  }

  try {
    const conta = await buscarContaWhatsappPrincipal(supabase, usuario);
    const result = await sincronizarContaWhatsappBusiness(supabase, conta);

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Erro ao sincronizar WhatsApp Business:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao sincronizar WhatsApp Business'
    });
  }
}
