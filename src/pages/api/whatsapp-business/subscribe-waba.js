import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import { createMetaGraphApiService } from '@/services/meta-graph-api';

/**
 * Endpoint administrativo para inscrever a WABA Meta existente no aplicativo via Graph API.
 * Executa POST /{waba_id}/subscribed_apps usando o access_token armazenado no servidor.
 * Protegido com autenticação e autorização administrativa.
 */
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
    // Busca a conta META ativa no banco de dados
    const { data: conta, error: contaErr } = await supabase
      .from('whatsapp_business_accounts')
      .select('id, waba_id, access_token, status, provider')
      .eq('provider', 'META')
      .eq('status', 'ATIVO')
      .limit(1)
      .maybeSingle();

    if (contaErr || !conta) {
      return res.status(404).json({
        success: false,
        error: 'Conta WhatsApp Business oficial (META) ativa nao encontrada'
      });
    }

    if (!conta.waba_id || !conta.access_token) {
      return res.status(400).json({
        success: false,
        error: 'WABA ID ou Access Token nao configurado na conta META'
      });
    }

    console.log(`[INSCREVER WABA ROUTE] Iniciando inscricao para WABA ${conta.waba_id}`);

    const metaGraph = createMetaGraphApiService();
    const result = await metaGraph.inscreverAppNaWaba(conta.access_token, conta.waba_id);

    // Atualiza metadados da conta se necessário
    await supabase
      .from('whatsapp_business_accounts')
      .update({
        updated_at: new Date().toISOString()
      })
      .eq('id', conta.id);

    return res.status(200).json({
      success: true,
      message: `WABA ${conta.waba_id} inscrita no aplicativo com sucesso`,
      wabaId: conta.waba_id,
      metaResponse: result.data
    });
  } catch (error) {
    console.error('[INSCREVER WABA ROUTE] Erro ao inscrever WABA:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro interno ao inscrever WABA no app Meta'
    });
  }
}
