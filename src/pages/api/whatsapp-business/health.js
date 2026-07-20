import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import { buscarContaWhatsappPrincipal } from '@/lib/whatsapp-business-accounts';
import { gerarDiagnosticoWhatsappBusiness } from '@/services/whatsapp-business-health';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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
    if (!conta) {
      return res.status(200).json({
        ready: false,
        summary: 'Existem pendencias antes da producao',
        pending: ['Nenhuma conta WhatsApp Business vinculada ao tenant atual.'],
        checkedAt: new Date().toISOString(),
        indicators: []
      });
    }

    const health = await gerarDiagnosticoWhatsappBusiness(conta, { supabase });
    return res.status(200).json(health);
  } catch (error) {
    console.error('Erro ao executar diagnostico WhatsApp Business:', error);
    return res.status(500).json({
      error: error.message || 'Erro ao executar diagnostico WhatsApp Business'
    });
  }
}
