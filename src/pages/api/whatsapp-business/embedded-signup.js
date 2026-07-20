import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import {
  normalizarWhatsappAccount,
  salvarContaWhatsappEmbeddedSignup
} from '@/lib/whatsapp-business-accounts';
import { createMetaGraphApiService } from '@/services/meta-graph-api';

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
    const body = req.body || {};
    const code = String(body.code || '').trim();

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Codigo de autorizacao do Embedded Signup nao informado'
      });
    }

    const metaGraph = createMetaGraphApiService();
    const tokenData = await metaGraph.exchangeEmbeddedSignupCode(code);
    const validationData = await metaGraph.validarEmbeddedSignup({
      accessToken: tokenData.accessToken,
      wabaId: body.wabaId || body.waba_id,
      phoneNumberId: body.phoneNumberId || body.phone_number_id
    });
    const conta = await salvarContaWhatsappEmbeddedSignup(supabase, usuario, {
      ...body,
      tokenData: {
        ...tokenData,
        expiresAt: validationData.tokenValidation?.expiresAt || tokenData.expiresAt,
        tokenType: validationData.tokenValidation?.tokenType || tokenData.tokenType,
        graphVersion: metaGraph.graphVersion
      },
      validationData
    });

    return res.status(200).json({
      success: true,
      account: normalizarWhatsappAccount(conta)
    });
  } catch (error) {
    console.error('Erro ao salvar Embedded Signup:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao salvar dados do Embedded Signup'
    });
  }
}
