import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import {
  atualizarRegistroNumeroWhatsapp,
  buscarContaWhatsappPrincipal,
  normalizarWhatsappAccount
} from '@/lib/whatsapp-business-accounts';
import { createMetaGraphApiService } from '@/services/meta-graph-api';

function selecionarNumeroPrincipal(conta) {
  const numbers = Array.isArray(conta?.whatsapp_business_numbers) ? conta.whatsapp_business_numbers : [];
  return numbers.find(item => item?.principal && item?.status !== 'INATIVO')
    || numbers.find(item => item?.status !== 'INATIVO')
    || numbers[0]
    || null;
}

function validarPreRequisitos(conta, numero) {
  const faltas = [];
  if (!conta?.production_ready) faltas.push('A integração ainda não está pronta para produção.');
  if (!conta?.access_token) faltas.push('Token válido não encontrado.');
  if (!conta?.waba_validated || !conta?.waba_id) faltas.push('WABA válida não encontrada.');
  if (!conta?.phone_validated || !numero?.phone_number_id) faltas.push('Phone Number ID válido não encontrado.');
  return faltas;
}

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

  const pin = String(req.body?.pin || '').trim();
  if (!/^\d{6}$/.test(pin)) {
    return res.status(400).json({
      success: false,
      error: 'Informe um PIN de 6 digitos para registrar o numero.'
    });
  }

  try {
    const conta = await buscarContaWhatsappPrincipal(supabase, usuario);
    const numero = selecionarNumeroPrincipal(conta);
    const faltas = validarPreRequisitos(conta, numero);

    if (faltas.length) {
      const atualizada = await atualizarRegistroNumeroWhatsapp(supabase, usuario, {
        status: 'FAILED',
        message: faltas.join(' '),
        metadata: { pendingRequirements: faltas }
      });

      return res.status(400).json({
        success: false,
        error: faltas.join(' '),
        account: normalizarWhatsappAccount(atualizada)
      });
    }

    const metaGraph = createMetaGraphApiService();
    const phoneBefore = await metaGraph.obterNumeroWhatsapp(conta.access_token, numero.phone_number_id)
      .catch(() => null);

    if (metaGraph.isStatusNumeroRegistrado(phoneBefore)) {
      const atualizada = await atualizarRegistroNumeroWhatsapp(supabase, usuario, {
        status: 'REGISTERED',
        message: 'Numero ja estava registrado na WhatsApp Cloud API.',
        metadata: { phone: phoneBefore, idempotent: true }
      });

      return res.status(200).json({
        success: true,
        alreadyRegistered: true,
        message: 'Numero ja estava registrado na WhatsApp Cloud API.',
        account: normalizarWhatsappAccount(atualizada)
      });
    }

    await atualizarRegistroNumeroWhatsapp(supabase, usuario, {
      status: 'PENDING',
      message: 'Registro do numero iniciado.',
      metadata: { phoneBefore }
    });

    try {
      const result = await metaGraph.registrarNumeroWhatsapp(conta.access_token, numero.phone_number_id, pin);
      const atualizada = await atualizarRegistroNumeroWhatsapp(supabase, usuario, {
        status: 'REGISTERED',
        message: result?.success ? 'Numero registrado com sucesso.' : 'Registro concluido pela Meta.',
        metadata: { result, phoneBefore }
      });

      return res.status(200).json({
        success: true,
        alreadyRegistered: false,
        message: 'Numero registrado com sucesso.',
        account: normalizarWhatsappAccount(atualizada)
      });
    } catch (error) {
      if (metaGraph.isNumeroJaRegistrado(error)) {
        const atualizada = await atualizarRegistroNumeroWhatsapp(supabase, usuario, {
          status: 'REGISTERED',
          message: 'Numero ja estava registrado na WhatsApp Cloud API.',
          metadata: { metaError: error.details || error.message, idempotent: true }
        });

        return res.status(200).json({
          success: true,
          alreadyRegistered: true,
          message: 'Numero ja estava registrado na WhatsApp Cloud API.',
          account: normalizarWhatsappAccount(atualizada)
        });
      }

      const atualizada = await atualizarRegistroNumeroWhatsapp(supabase, usuario, {
        status: 'FAILED',
        message: error.message || 'Falha ao registrar numero.',
        metadata: { metaError: error.details || error.message }
      });

      return res.status(400).json({
        success: false,
        error: error.message || 'Falha ao registrar numero.',
        account: normalizarWhatsappAccount(atualizada)
      });
    }
  } catch (error) {
    console.error('Erro ao registrar numero WhatsApp:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao registrar numero WhatsApp'
    });
  }
}
