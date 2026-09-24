/**
 * Serviço de Gestão de Saldo e Ledger de SMS (SMSDev)
 *
 * Responsável por orquestrar de forma atômica e segura as operações
 * de carteira e reserva de créditos por instituição (tenant_id).
 *
 * Princípios de Segurança e Isolamento:
 * - Nunca confiar em saldo ou tenant_id enviados pelo cliente.
 * - Toda mutação contábil utiliza as funções atômicas do PostgreSQL
 *   com row-level lock (FOR UPDATE), prevenindo concorrência e saldo negativo.
 */

import { obterTenantId } from '../../lib/tenant.js';

/**
 * Valida se o tenantId é numérico positivo.
 * @param {number|string} tenantId
 * @returns {number}
 */
function normalizarTenantId(tenantId) {
  const idNum = Number(tenantId);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    throw new Error('Tenant ID inválido ou não informado para operação de SMS.');
  }
  return idNum;
}

/**
 * Consulta o saldo e o status da carteira de SMS de um tenant.
 *
 * @param {Object} supabase - Cliente Supabase autenticado ou service role
 * @param {number|Object} tenantOuUsuario - ID do tenant ou objeto do usuário autenticado
 * @returns {Promise<Object>} Dados da carteira (saldo_creditos, saldo_reservado, saldo_disponivel, status)
 */
export async function consultarSaldoTenant(supabase, tenantOuUsuario) {
  const tenantId = typeof tenantOuUsuario === 'object'
    ? obterTenantId(tenantOuUsuario)
    : normalizarTenantId(tenantOuUsuario);

  if (!tenantId) {
    throw new Error('Instituição não identificada para verificação de saldo de SMS.');
  }

  const { data, error } = await supabase.rpc('fn_sms_consultar_saldo', {
    p_tenant_id: tenantId
  });

  if (error) {
    console.error(`[SMS Balance] Erro ao consultar saldo do tenant ${tenantId}:`, error);
    throw new Error(`Falha ao verificar saldo de SMS: ${error.message}`);
  }

  return data;
}

/**
 * Reserva créditos na carteira do tenant antes de enviar o SMS.
 * Bloqueia a linha no banco para evitar race conditions.
 *
 * @param {Object} supabase - Cliente Supabase do servidor
 * @param {Object} params
 * @param {number} params.tenantId - ID do tenant
 * @param {number} [params.quantidade=1] - Quantidade de créditos a reservar
 * @param {number} [params.smsMessageId=null] - ID da mensagem em sms_service_messages
 * @param {number} [params.usuarioId=null] - ID do usuário que disparou a ação
 * @param {string} [params.motivo] - Descrição/justificativa
 * @returns {Promise<{success: boolean, transaction_id?: number, saldo_disponivel?: number, error?: string}>}
 */
export async function reservarCreditoSms(supabase, {
  tenantId,
  quantidade = 1,
  smsMessageId = null,
  usuarioId = null,
  motivo = 'Reserva de crédito para envio de SMS'
}) {
  const idValido = normalizarTenantId(tenantId);
  const qtdValida = Math.max(1, parseInt(quantidade, 10) || 1);

  const { data, error } = await supabase.rpc('fn_sms_reservar_credito', {
    p_tenant_id: idValido,
    p_quantidade: qtdValida,
    p_sms_message_id: smsMessageId ? Number(smsMessageId) : null,
    p_usuario_id: usuarioId ? Number(usuarioId) : null,
    p_motivo: String(motivo || '')
  });

  if (error) {
    console.error(`[SMS Balance] Erro ao reservar crédito para tenant ${idValido}:`, error);
    throw new Error(`Falha ao reservar crédito de SMS: ${error.message}`);
  }

  return data;
}

/**
 * Confirma o consumo de créditos após aceite da mensagem pelo gateway.
 * Debita o saldo total e abate a reserva.
 *
 * @param {Object} supabase - Cliente Supabase do servidor
 * @param {Object} params
 * @param {number} params.tenantId - ID do tenant
 * @param {number} [params.quantidade=1] - Quantidade de créditos confirmados
 * @param {number} [params.smsMessageId=null] - ID da mensagem em sms_service_messages
 * @param {number} [params.usuarioId=null] - ID do usuário
 * @param {string} [params.motivo] - Descrição
 * @returns {Promise<{success: boolean, transaction_id?: number, saldo_creditos?: number}>}
 */
export async function confirmarConsumoSms(supabase, {
  tenantId,
  quantidade = 1,
  smsMessageId = null,
  usuarioId = null,
  motivo = 'Confirmação de consumo de SMS'
}) {
  const idValido = normalizarTenantId(tenantId);
  const qtdValida = Math.max(1, parseInt(quantidade, 10) || 1);

  const { data, error } = await supabase.rpc('fn_sms_confirmar_consumo', {
    p_tenant_id: idValido,
    p_quantidade: qtdValida,
    p_sms_message_id: smsMessageId ? Number(smsMessageId) : null,
    p_usuario_id: usuarioId ? Number(usuarioId) : null,
    p_motivo: String(motivo || '')
  });

  if (error) {
    console.error(`[SMS Balance] Erro ao confirmar consumo de crédito para tenant ${idValido}:`, error);
    throw new Error(`Falha ao debitar crédito de SMS: ${error.message}`);
  }

  return data;
}

/**
 * Libera créditos previamente reservados (caso ocorra erro de validação ou cancelamento antes do disparo).
 *
 * @param {Object} supabase - Cliente Supabase do servidor
 * @param {Object} params
 * @param {number} params.tenantId - ID do tenant
 * @param {number} [params.quantidade=1] - Quantidade a liberar
 * @param {number} [params.smsMessageId=null] - ID da mensagem
 * @param {number} [params.usuarioId=null] - ID do usuário
 * @param {string} [params.motivo] - Motivo do cancelamento/liberação
 * @returns {Promise<{success: boolean, saldo_reservado?: number}>}
 */
export async function liberarReservaSms(supabase, {
  tenantId,
  quantidade = 1,
  smsMessageId = null,
  usuarioId = null,
  motivo = 'Liberação de reserva de SMS'
}) {
  const idValido = normalizarTenantId(tenantId);
  const qtdValida = Math.max(1, parseInt(quantidade, 10) || 1);

  const { data, error } = await supabase.rpc('fn_sms_liberar_reserva', {
    p_tenant_id: idValido,
    p_quantidade: qtdValida,
    p_sms_message_id: smsMessageId ? Number(smsMessageId) : null,
    p_usuario_id: usuarioId ? Number(usuarioId) : null,
    p_motivo: String(motivo || '')
  });

  if (error) {
    console.error(`[SMS Balance] Erro ao liberar reserva de crédito para tenant ${idValido}:`, error);
    throw new Error(`Falha ao liberar reserva de SMS: ${error.message}`);
  }

  return data;
}

/**
 * Estorna crédito já debitado em caso de falha irreversível de transmissão confirmada.
 *
 * @param {Object} supabase - Cliente Supabase do servidor
 * @param {Object} params
 * @param {number} params.tenantId - ID do tenant
 * @param {number} [params.quantidade=1] - Quantidade a estornar
 * @param {number} [params.smsMessageId=null] - ID da mensagem
 * @param {number} [params.usuarioId=null] - ID do usuário
 * @param {string} [params.motivo] - Motivo do estorno
 * @returns {Promise<{success: boolean, saldo_creditos?: number}>}
 */
export async function estornarCreditoSms(supabase, {
  tenantId,
  quantidade = 1,
  smsMessageId = null,
  usuarioId = null,
  motivo = 'Estorno de crédito por falha na entrega'
}) {
  const idValido = normalizarTenantId(tenantId);
  const qtdValida = Math.max(1, parseInt(quantidade, 10) || 1);

  const { data, error } = await supabase.rpc('fn_sms_estornar_credito', {
    p_tenant_id: idValido,
    p_quantidade: qtdValida,
    p_sms_message_id: smsMessageId ? Number(smsMessageId) : null,
    p_usuario_id: usuarioId ? Number(usuarioId) : null,
    p_motivo: String(motivo || '')
  });

  if (error) {
    console.error(`[SMS Balance] Erro ao estornar crédito para tenant ${idValido}:`, error);
    throw new Error(`Falha ao estornar crédito de SMS: ${error.message}`);
  }

  return data;
}

/**
 * Adiciona créditos à carteira do tenant (Recarga administrativa).
 *
 * @param {Object} supabase - Cliente Supabase do servidor
 * @param {Object} params
 * @param {number} params.tenantId - ID do tenant
 * @param {number} params.quantidade - Quantidade de créditos a adicionar
 * @param {number} [params.usuarioId=null] - ID do administrador responsável
 * @param {string} [params.motivo] - Motivo/origem da recarga
 * @returns {Promise<{success: boolean, saldo_creditos?: number}>}
 */
export async function adicionarCreditoSms(supabase, {
  tenantId,
  quantidade,
  usuarioId = null,
  motivo = 'Recarga de créditos de SMS'
}) {
  const idValido = normalizarTenantId(tenantId);
  const qtdValida = parseInt(quantidade, 10);

  if (!Number.isFinite(qtdValida) || qtdValida <= 0) {
    throw new Error('Quantidade de créditos para recarga deve ser maior que zero.');
  }

  const { data, error } = await supabase.rpc('fn_sms_adicionar_credito', {
    p_tenant_id: idValido,
    p_quantidade: qtdValida,
    p_usuario_id: usuarioId ? Number(usuarioId) : null,
    p_motivo: String(motivo || '')
  });

  if (error) {
    console.error(`[SMS Balance] Erro ao adicionar crédito para tenant ${idValido}:`, error);
    throw new Error(`Falha ao adicionar créditos de SMS: ${error.message}`);
  }

  return data;
}
