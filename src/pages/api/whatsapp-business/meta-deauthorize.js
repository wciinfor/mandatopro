import { createServerClient } from '@/lib/supabase-server';
import { parseAndVerifyMetaSignedRequest } from '@/lib/meta-signed-request';

export const runtime = 'nodejs';

/**
 * Meta Deauthorize Callback URL
 * POST /api/whatsapp-business/meta-deauthorize
 *
 * Recebe o evento de desautorização enviado pela Meta quando um usuário remove
 * ou revoga o acesso do aplicativo MandatoPRO em seu perfil/gerenciador.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.warn('[META DEAUTHORIZE] META_APP_SECRET nao configurado no servidor');
    return res.status(500).json({ error: 'Configuracao de segredo ausente' });
  }

  const signedRequest = req.body?.signed_request;
  if (!signedRequest) {
    return res.status(400).json({ error: 'signed_request obrigatorio' });
  }

  const payload = parseAndVerifyMetaSignedRequest(signedRequest, appSecret);
  if (!payload) {
    return res.status(400).json({ error: 'signed_request invalido ou assinatura incorreta' });
  }

  const metaUserId = payload.user_id || payload.user?.id || null;
  const issuedAt = payload.issued_at ? new Date(payload.issued_at * 1000).toISOString() : new Date().toISOString();

  try {
    const supabase = createServerClient();

    // Se houver metaUserId identificado, busca e desmarca tokens locais se vinculados
    if (metaUserId) {
      const { data: contas } = await supabase
        .from('whatsapp_business_accounts')
        .select('id, nome, tenant_id, token_debug_metadata')
        .eq('provider', 'META');

      const contaAfetada = (contas || []).find(
        (c) => c.token_debug_metadata?.user_id === metaUserId || c.token_debug_metadata?.app_id === payload.app_id
      );

      if (contaAfetada?.id) {
        await supabase
          .from('whatsapp_business_accounts')
          .update({
            token_validated: false,
            production_ready: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', contaAfetada.id);
      }
    }

    // Registra evento de auditoria na tabela oficial logs_auditoria
    await supabase.from('logs_auditoria').insert({
      acao: 'META_DEAUTHORIZE',
      modulo: 'WHATSAPP_BUSINESS',
      descricao: `Aplicativo Meta desautorizado pelo usuário ${metaUserId || 'desconhecido'}`,
      status: 'SUCESSO',
      dados_novos: {
        meta_user_id: metaUserId,
        issued_at: issuedAt,
        app_id: payload.app_id || null
      }
    }).catch((err) => {
      console.warn('[META DEAUTHORIZE] Aviso ao persistir log:', err?.message);
    });

    return res.status(200).json({ success: true, message: 'Deauthorization processed' });
  } catch (error) {
    console.error('[META DEAUTHORIZE] Erro ao processar:', error);
    return res.status(500).json({ error: 'Erro interno ao processar desautorizacao' });
  }
}

