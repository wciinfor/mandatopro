import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { consultarSaldoTenant } from '@/services/sms/smsBalanceService';

/**
 * GET /api/sms/saldo
 * 
 * Consulta o saldo de créditos e status da carteira de SMS do tenant autenticado.
 * Utiliza a infraestrutura atômica fn_sms_consultar_saldo via consultarSaldoTenant.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const saldoData = await consultarSaldoTenant(supabase, usuario);

    return res.status(200).json({
      success: true,
      saldo: saldoData
    });
  } catch (error) {
    console.error('[API /api/sms/saldo] Erro ao consultar saldo SMS:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao consultar saldo de SMS'
    });
  }
}
