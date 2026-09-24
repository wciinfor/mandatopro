/**
 * Repositório de Mensagens SMS de Serviços (sms_service_messages)
 *
 * Centraliza as operações de banco de dados para a tabela sms_service_messages,
 * em conformidade com as regras de segurança do projeto (ALLOWED_SUPABASE_FROM_DIRS).
 */

/**
 * Busca mensagem SMS por refer_id único.
 *
 * @param {Object} supabase - Cliente Supabase do servidor
 * @param {string} referId - Identificador único de conciliação
 * @returns {Promise<Object|null>}
 */
export async function buscarMensagemPorReferId(supabase, referId) {
  if (!referId) return null;

  const { data, error } = await supabase
    .from('sms_service_messages')
    .select('*')
    .eq('refer_id', String(referId).trim())
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Busca mensagem SMS por provider_message_id (ID da SMSDev).
 *
 * @param {Object} supabase - Cliente Supabase do servidor
 * @param {string} providerMessageId - ID retornado pela SMSDev
 * @returns {Promise<Object|null>}
 */
export async function buscarMensagemPorProviderId(supabase, providerMessageId) {
  if (!providerMessageId) return null;

  const { data, error } = await supabase
    .from('sms_service_messages')
    .select('*')
    .eq('provider_message_id', String(providerMessageId).trim())
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Insere um novo registro de mensagem SMS.
 *
 * @param {Object} supabase - Cliente Supabase do servidor
 * @param {Object} payload - Dados da mensagem
 * @returns {Promise<Object>} Registro inserido
 */
export async function criarMensagemSms(supabase, payload) {
  const { data, error } = await supabase
    .from('sms_service_messages')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Atualiza o registro de mensagem SMS com isolamento de tenant.
 *
 * @param {Object} supabase - Cliente Supabase do servidor
 * @param {number|string} id - ID da mensagem
 * @param {number|string} tenantId - ID do tenant para garantia de isolamento
 * @param {Object} payload - Campos a atualizar
 * @returns {Promise<Object>}
 */
export async function atualizarMensagemSms(supabase, id, tenantId, payload) {
  let query = supabase
    .from('sms_service_messages')
    .update(payload)
    .eq('id', Number(id));

  if (tenantId) {
    query = query.eq('tenant_id', Number(tenantId));
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
}
