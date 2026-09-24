/**
 * Webhook Receptor de Callbacks DLR da SMSDev
 * Endpoint: /api/webhooks/smsdev
 *
 * Responsabilidades:
 * 1. Autenticação estrita do webhook via token secreto (query param ?token= ou header).
 * 2. Validação e normalização do payload de DLR (Callback Situation).
 * 3. Idempotência e prevenção contra regressão indevida de status.
 * 4. Isolamento multi-tenant (todas as operações vinculadas ao tenant_id da mensagem).
 * 5. Reconciliação segura de créditos para mensagens que estavam com resultado incerto.
 * 6. Registro de logs seguro sem dados sensíveis ou vazamento de segredos.
 */

import crypto from 'crypto';
import { createServerClient } from '../../../lib/supabase-server.js';
import {
  confirmarConsumoSms,
  liberarReservaSms
} from '../../../services/sms/smsBalanceService.js';
import { mascararTelefone } from '../../../services/sms/smsdev-client.js';

export const config = {
  api: {
    bodyParser: true
  }
};

const STATUS_PRIORITY = {
  pendente: 0,
  reservado: 1,
  enviado: 2,
  entregue: 3,
  falha: 3,
  cancelado: 3
};

/**
 * Normaliza o status informado pela SMSDev para o vocabulário interno do MandatoPRO.
 *
 * @param {string} situacao - Texto da situação retornado pela SMSDev
 * @returns {'entregue'|'falha'|'enviado'|null}
 */
export function normalizarSituacaoSmsDev(situacao = '') {
  const s = String(situacao || '').trim().toUpperCase();

  // 1. Falha de entrega, rejeição ou não entregue (deve ser checado antes de ENTREGUE)
  if (
    s.includes('NAO ENTREGUE') ||
    s.includes('NÃO ENTREGUE') ||
    s.includes('ERRO') ||
    s.includes('FAIL') ||
    s.includes('REJECT') ||
    s.includes('UNDELIV') ||
    s.includes('EXPIR') ||
    s.includes('CANCEL')
  ) {
    return 'falha';
  }

  // 2. Entregue / Recebido no aparelho
  if (
    s.includes('RECEB') ||
    s.includes('RECEIV') ||
    s.includes('ENTREG') ||
    s.includes('DELIV')
  ) {
    return 'entregue';
  }

  // 3. Em trânsito / Na fila
  if (
    s.includes('SENT') ||
    s.includes('ENVIA') ||
    s.includes('FILA') ||
    s.includes('PROCESS') ||
    s.includes('AGUARD')
  ) {
    return 'enviado';
  }

  return null;
}

/**
 * Valida a autenticação do webhook SMSDev.
 *
 * @param {Object} req - Request HTTP
 * @returns {boolean}
 */
export function validarAutenticacaoWebhook(req) {
  const tokenEsperado = process.env.SMSDEV_WEBHOOK_TOKEN || process.env.SMSDEV_API_KEY;

  if (!tokenEsperado || typeof tokenEsperado !== 'string' || tokenEsperado.trim() === '') {
    console.error('[SMSDev Webhook] Token de webhook não configurado no servidor (SMSDEV_WEBHOOK_TOKEN ou SMSDEV_API_KEY).');
    return false;
  }

  let tokenRecebido =
    req.query?.token ||
    req.headers?.['x-smsdev-token'] ||
    (req.headers?.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '').trim() : null);

  if (Array.isArray(tokenRecebido)) {
    tokenRecebido = tokenRecebido[0];
  }

  if (!tokenRecebido || typeof tokenRecebido !== 'string' || tokenRecebido.trim() === '') {
    return false;
  }

  const bufEsperado = Buffer.from(tokenEsperado.trim());
  const bufRecebido = Buffer.from(tokenRecebido.trim());

  if (bufEsperado.length !== bufRecebido.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufEsperado, bufRecebido);
}

/**
 * Processa um único evento de DLR da SMSDev.
 *
 * @param {Object} supabase - Cliente Supabase do servidor
 * @param {Object} evento - Objeto de callback
 * @returns {Promise<Object>} Resultado do processamento
 */
export async function processarEventoDlr(supabase, evento) {
  const providerMessageId = evento.id ? String(evento.id).trim() : null;
  const referId = evento.refer ? String(evento.refer).trim() : null;
  const situacaoRaw = evento.situacao || evento.status || '';
  const codigo = evento.codigo ? String(evento.codigo) : '';
  const descricao = evento.descricao || '';

  if (!providerMessageId && !referId) {
    return {
      success: false,
      ignorado: true,
      motivo: 'Evento sem identificador (id ou refer ausentes).'
    };
  }

  // 1. Localização da mensagem no banco
  let query = supabase.from('sms_service_messages').select('*');

  if (referId) {
    query = query.eq('refer_id', referId);
  } else {
    query = query.eq('provider_message_id', providerMessageId);
  }

  const { data: mensagem, error: errBusca } = await query.maybeSingle();

  if (errBusca) {
    console.error('[SMSDev Webhook] Erro ao buscar mensagem no banco:', errBusca.message);
    throw errBusca;
  }

  if (!mensagem) {
    console.warn(`[SMSDev Webhook] Mensagem não encontrada no banco (id: ${providerMessageId}, refer: ${referId}).`);
    return {
      success: true,
      ignorado: true,
      motivo: 'Mensagem não encontrada no sistema'
    };
  }

  const telMascarado = mascararTelefone(mensagem.destinatario_telefone);
  const tenantId = mensagem.tenant_id;
  const statusAtual = mensagem.status;
  const novoStatus = normalizarSituacaoSmsDev(situacaoRaw);

  if (!novoStatus) {
    console.log(`[SMSDev Webhook] Situação '${situacaoRaw}' não mapeada. Mantendo status atual '${statusAtual}'.`);
    return {
      success: true,
      ignorado: true,
      motivo: `Situação desconhecida: ${situacaoRaw}`
    };
  }

  const prioridadeAtual = STATUS_PRIORITY[statusAtual] ?? 0;
  const prioridadeNova = STATUS_PRIORITY[novoStatus] ?? 0;

  // 2. Prevenção contra regressão indevida e eventos fora de ordem
  if (prioridadeAtual >= prioridadeNova && (statusAtual === 'entregue' || statusAtual === 'falha')) {
    console.log(`[SMSDev Webhook] Idempotência: Mensagem #${mensagem.id} já está em estado terminal '${statusAtual}'. Evento '${novoStatus}' ignorado.`);
    return {
      success: true,
      ignorado: true,
      motivo: `Mensagem já em estado terminal (${statusAtual})`
    };
  }

  const timestampAgora = new Date().toISOString();
  const updatePayload = {
    updated_at: timestampAgora,
    raw_response: {
      ...(mensagem.raw_response || {}),
      webhook_dlr: evento,
      webhook_processado_em: timestampAgora
    }
  };

  // 3. Reconciliação segura de créditos se a mensagem estava incerta (pendente/reservada)
  if (['pendente', 'reservado'].includes(statusAtual)) {
    if (['enviado', 'entregue'].includes(novoStatus)) {
      console.log(`[SMSDev Webhook] Reconciliando consumo pendente para tenant ${tenantId}, mensagem #${mensagem.id}...`);
      try {
        await confirmarConsumoSms(supabase, {
          tenantId,
          quantidade: 1,
          smsMessageId: mensagem.id,
          motivo: `Reconciliação confirmada via webhook DLR (SMSDev ID: ${providerMessageId || mensagem.provider_message_id})`
        });
      } catch (errReconcilia) {
        console.error('[SMSDev Webhook] Erro ao reconciliar consumo de crédito:', errReconcilia.message);
      }
    } else if (novoStatus === 'falha') {
      console.log(`[SMSDev Webhook] Liberando reserva retida para tenant ${tenantId}, mensagem #${mensagem.id} após falha confirmada...`);
      try {
        await liberarReservaSms(supabase, {
          tenantId,
          quantidade: 1,
          smsMessageId: mensagem.id,
          motivo: `Liberação por falha confirmada em webhook DLR: ${descricao || codigo}`
        });
      } catch (errLibera) {
        console.error('[SMSDev Webhook] Erro ao liberar reserva de crédito:', errLibera.message);
      }
    }
  }

  // 4. Aplicação da transição de status
  updatePayload.status = novoStatus;

  if (novoStatus === 'entregue' && !mensagem.entregue_em) {
    updatePayload.entregue_em = timestampAgora;
  }

  if (novoStatus === 'falha') {
    if (!mensagem.falhou_em) updatePayload.falhou_em = timestampAgora;
    updatePayload.ultimo_erro = descricao || codigo || situacaoRaw || 'Falha de entrega reportada via DLR';
  }

  if (providerMessageId && !mensagem.provider_message_id) {
    updatePayload.provider_message_id = providerMessageId;
  }

  const { error: errUpdate } = await supabase
    .from('sms_service_messages')
    .update(updatePayload)
    .eq('id', mensagem.id)
    .eq('tenant_id', tenantId); // Garantia de isolamento multi-tenant

  if (errUpdate) {
    console.error('[SMSDev Webhook] Erro ao atualizar mensagem:', errUpdate.message);
    throw errUpdate;
  }

  console.log(`[SMSDev Webhook] Mensagem #${mensagem.id} (${telMascarado}) atualizada de '${statusAtual}' para '${novoStatus}'.`);

  return {
    success: true,
    messageId: mensagem.id,
    statusAnterior: statusAtual,
    statusNovo: novoStatus
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // 1. Autenticação do webhook
  if (!validarAutenticacaoWebhook(req)) {
    console.warn('[SMSDev Webhook] Tentativa de acesso não autorizada (token ausente ou inválido).');
    return res.status(401).json({ error: 'Não autorizado: token de webhook inválido.' });
  }

  const supabase = createServerClient();

  // 2. Extração dos eventos (suporta POST com objeto/array ou GET com query params)
  let eventos = [];
  if (req.method === 'POST') {
    const body = req.body;
    if (Array.isArray(body)) {
      eventos = body;
    } else if (body && typeof body === 'object') {
      eventos = [body];
    }
  } else {
    // GET com parâmetros na query string
    if (req.query?.id || req.query?.refer || req.query?.situacao) {
      eventos = [req.query];
    }
  }

  if (eventos.length === 0) {
    return res.status(200).json({ success: true, message: 'Nenhum evento recebido para processamento.' });
  }

  try {
    const resultados = [];
    for (const ev of eventos) {
      const resEv = await processarEventoDlr(supabase, ev);
      resultados.push(resEv);
    }

    return res.status(200).json({
      success: true,
      processados: resultados.length,
      resultados
    });
  } catch (error) {
    console.error('[SMSDev Webhook] Erro interno durante processamento de DLR:', error.message);
    // Retorna HTTP 500 para permitir retry do gateway apenas em falhas inesperadas de servidor
    return res.status(500).json({ error: 'Erro interno ao processar callback de status.' });
  }
}
