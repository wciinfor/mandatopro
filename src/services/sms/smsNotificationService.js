/**
 * Serviço de Notificação Transacional Individual por SMS (SMSDev)
 *
 * Responsável pelo ciclo completo de envio de notificações transacionais de serviços:
 * 1. Validação estrita de número brasileiro (DDD + celular) e conteúdo.
 * 2. Validação da identidade do tenant e checagem de saldo pré-pago.
 * 3. Idempotência por evento e referência externa única (`refer_id`).
 * 4. Reserva atômica de crédito via RPC com row-level lock.
 * 5. Tentativa de disparo com SMSDev Client.
 * 6. Tratamento tripartido de desfecho:
 *    - Aceite: Efetivação do débito (confirmar consumo) e status 'enviado'.
 *    - Rejeição explícita: Liberação da reserva e status 'falha'.
 *    - Falha incerta/timeout: Manutenção da reserva para reconciliação segura.
 */

import SmsDevClient from './smsdev-client.js';
import {
  consultarSaldoTenant,
  reservarCreditoSms,
  confirmarConsumoSms,
  liberarReservaSms
} from './smsBalanceService.js';
import { obterTenantId } from '../../lib/tenant.js';
import {
  buscarMensagemPorReferId,
  criarMensagemSms,
  atualizarMensagemSms
} from '../../lib/sms-messages.js';

/**
 * Valida e formata número de celular brasileiro para o padrão SMSDev (55 + DDD + 9 dígitos).
 *
 * Regras:
 * - DDD entre 11 e 99.
 * - Celulares possuem 9 dígitos iniciando com 9.
 * - Telefones fixos (8 dígitos) e números internacionais fora do Brasil são rejeitados.
 *
 * @param {string} telefone
 * @returns {{valido: boolean, telefoneFormatado?: string, erro?: string}}
 */
export function validarEFormatarCelularBR(telefone) {
  if (!telefone) {
    return { valido: false, erro: 'Telefone do destinatário não informado.' };
  }

  const limpo = String(telefone).replace(/\D/g, '');

  // Caso 1: Com DDI Brasil (55) -> Deve ter exatamente 13 dígitos: 55 + DDD (2) + 9 dígitos
  if (limpo.startsWith('55')) {
    if (limpo.length !== 13) {
      return {
        valido: false,
        erro: `Número com DDI 55 inválido: esperado 13 dígitos (55 + DDD + 9 dígitos), recebido ${limpo.length}.`
      };
    }

    const ddd = parseInt(limpo.substring(2, 4), 10);
    const nonoDigito = limpo.charAt(4);

    if (ddd < 11 || ddd > 99) {
      return { valido: false, erro: `DDD ${ddd} é inválido.` };
    }

    if (nonoDigito !== '9') {
      return { valido: false, erro: 'Apenas celulares (iniciados com 9) são permitidos para notificações por SMS.' };
    }

    return { valido: true, telefoneFormatado: limpo };
  }

  // Caso 2: Sem DDI Brasil -> Deve ter exatamente 11 dígitos: DDD (2) + 9 dígitos
  if (limpo.length === 11) {
    const ddd = parseInt(limpo.substring(0, 2), 10);
    const nonoDigito = limpo.charAt(2);

    if (ddd < 11 || ddd > 99) {
      return { valido: false, erro: `DDD ${ddd} é inválido.` };
    }

    if (nonoDigito !== '9') {
      return { valido: false, erro: 'Apenas celulares (iniciados com 9) são permitidos para notificações por SMS.' };
    }

    return { valido: true, telefoneFormatado: `55${limpo}` };
  }

  return {
    valido: false,
    erro: `Formato de celular inválido (${limpo.length} dígitos). Informe o DDD + 9 dígitos.`
  };
}

/**
 * Valida o conteúdo da mensagem SMS de serviço.
 *
 * @param {string} mensagem
 * @returns {{valido: boolean, mensagemSanitizada?: string, erro?: string}}
 */
export function validarMensagemSms(mensagem) {
  if (!mensagem || typeof mensagem !== 'string') {
    return { valido: false, erro: 'Conteúdo da mensagem é obrigatório.' };
  }

  const sanitizada = mensagem.trim();

  if (sanitizada.length === 0) {
    return { valido: false, erro: 'Conteúdo da mensagem não pode ser vazio.' };
  }

  // Limite padrão de 1 segmento GSM-7 (160 caracteres)
  if (sanitizada.length > 160) {
    return {
      valido: false,
      erro: `Mensagem excede o limite de 160 caracteres para SMS individual (${sanitizada.length} caracteres).`
    };
  }

  return { valido: true, mensagemSanitizada: sanitizada };
}

/**
 * Gera uma chave determinística de idempotência (refer_id) para a notificação de serviço.
 *
 * @param {Object} params
 * @param {number} params.tenantId
 * @param {number|string} params.atendimentoId
 * @param {string} [params.evento='protocolo']
 * @returns {string}
 */
export function gerarReferIdNotificacao({ tenantId, atendimentoId, evento = 'protocolo' }) {
  const tId = String(tenantId || '0');
  const aId = String(atendimentoId || 'avulso');
  const ev = String(evento || 'geral').toLowerCase().replace(/[^a-z0-9_]/g, '');
  return `t${tId}_atend_${aId}_${ev}`;
}

/**
 * Envia uma notificação transacional de serviço por SMS (um destinatário por vez).
 *
 * @param {Object} params
 * @param {Object} params.supabase - Cliente Supabase do servidor (service_role)
 * @param {Object|number} params.usuarioOuTenant - Objeto do usuário autenticado ou ID do tenant resolvido
 * @param {number|null} [params.atendimentoId=null] - ID do atendimento vinculado
 * @param {number|null} [params.eleitorId=null] - ID do eleitor vinculado
 * @param {string} params.telefone - Telefone do destinatário
 * @param {string} [params.destinatarioNome=null] - Nome do eleitor/cidadão
 * @param {string} params.mensagem - Texto da notificação
 * @param {string} [params.evento='protocolo'] - Tipo do evento (protocolo, status_alterado, etc.)
 * @param {string} [params.referIdCustom] - Chave de idempotência customizada (opcional)
 * @param {Object} [params.clientCustom] - Instância de SmsDevClient (opcional, para injeção de dependência/testes)
 * @returns {Promise<Object>} Resultado da operação com status e dados contábeis
 */
export async function enviarNotificacaoSmsServico({
  supabase,
  usuarioOuTenant,
  atendimentoId = null,
  eleitorId = null,
  telefone,
  destinatarioNome = null,
  mensagem,
  evento = 'protocolo',
  referIdCustom = null,
  clientCustom = null
}) {
  if (!supabase) {
    throw new Error('Cliente Supabase do servidor é obrigatório para envio de notificação SMS.');
  }

  // 1. Resolução estrita do tenant_id (nunca confiar em dados não autenticados do frontend)
  const tenantId = typeof usuarioOuTenant === 'object'
    ? obterTenantId(usuarioOuTenant)
    : Number(usuarioOuTenant);

  if (!tenantId || !Number.isFinite(tenantId) || tenantId <= 0) {
    throw new Error('Instituição (tenant_id) inválida ou não autenticada.');
  }

  const usuarioId = typeof usuarioOuTenant === 'object' && usuarioOuTenant?.id
    ? Number(usuarioOuTenant.id)
    : null;

  // 2. Validação de Telefone Brasileiro
  const telValidacao = validarEFormatarCelularBR(telefone);
  if (!telValidacao.valido) {
    return {
      success: false,
      status: 'rejeitado_validacao',
      erro: telValidacao.erro
    };
  }
  const telefoneFormatado = telValidacao.telefoneFormatado;

  // 3. Validação de Conteúdo da Mensagem
  const msgValidacao = validarMensagemSms(mensagem);
  if (!msgValidacao.valido) {
    return {
      success: false,
      status: 'rejeitado_validacao',
      erro: msgValidacao.erro
    };
  }
  const mensagemSanitizada = msgValidacao.mensagemSanitizada;

  // 4. Verificação de Carteira e Saldo Disponível
  const dadosCarteira = await consultarSaldoTenant(supabase, tenantId);
  if (!dadosCarteira?.existe || dadosCarteira.status !== 'ATIVO') {
    return {
      success: false,
      status: 'bloqueado_carteira',
      erro: dadosCarteira?.status === 'SUSPENSO'
        ? 'Carteira de SMS da instituição está suspensa.'
        : 'Carteira de SMS da instituição não está ativa.'
    };
  }

  if (dadosCarteira.saldo_disponivel < 1) {
    return {
      success: false,
      status: 'saldo_insuficiente',
      erro: 'Saldo insuficiente de créditos de SMS na instituição.',
      saldo_disponivel: dadosCarteira.saldo_disponivel
    };
  }

  // 5. Idempotência por Referência Única
  const referId = referIdCustom || gerarReferIdNotificacao({
    tenantId,
    atendimentoId,
    evento
  });

  const mensagemExistente = await buscarMensagemPorReferId(supabase, referId);

  if (mensagemExistente) {
    // Se já foi enviada ou entregue com sucesso, retorna sem duplicar envio
    if (['enviado', 'entregue'].includes(mensagemExistente.status)) {
      console.log(`[SMS Notification] Idempotência: notificação com refer_id=${referId} já enviada anteriormente.`);
      return {
        success: true,
        ja_enviado: true,
        messageId: mensagemExistente.id,
        providerMessageId: mensagemExistente.provider_message_id,
        status: mensagemExistente.status
      };
    }

    // Se estiver em processamento recente (menos de 5 minutos), evita corrida
    if (['reservado', 'pendente'].includes(mensagemExistente.status)) {
      const criadoEm = new Date(mensagemExistente.created_at).getTime();
      const diffMinutos = (Date.now() - criadoEm) / (1000 * 60);

      if (diffMinutos < 5) {
        return {
          success: false,
          em_processamento: true,
          status: mensagemExistente.status,
          erro: 'Notificação já está em processamento para este atendimento. Aguarde a confirmação.',
          messageId: mensagemExistente.id
        };
      }
    }
  }

  // 6. Registro Inicial na Tabela de Histórico (sms_service_messages)
  let smsMessageRecord = mensagemExistente;

  if (!smsMessageRecord) {
    try {
      const novoRegistro = await criarMensagemSms(supabase, {
        tenant_id: tenantId,
        atendimento_id: atendimentoId ? Number(atendimentoId) : null,
        eleitor_id: eleitorId ? Number(eleitorId) : null,
        destinatario_telefone: telefoneFormatado,
        destinatario_nome: destinatarioNome || null,
        mensagem: mensagemSanitizada,
        refer_id: referId,
        provider: 'SMSDEV',
        status: 'pendente',
        creditos_cobrados: 1,
        criado_por_id: usuarioId
      });
      smsMessageRecord = novoRegistro;
    } catch (erroInsert) {
      console.error('[SMS Notification] Erro ao criar registro de mensagem:', erroInsert);
      throw new Error(`Falha ao registrar histórico de mensagem SMS: ${erroInsert.message}`);
    }
  }

  const smsMessageId = smsMessageRecord.id;

  // 7. Reserva Atômica de Crédito (RPC com Lock no PostgreSQL)
  let reservaResult;
  try {
    reservaResult = await reservarCreditoSms(supabase, {
      tenantId,
      quantidade: 1,
      smsMessageId,
      usuarioId,
      motivo: `Reserva para notificação de atendimento #${atendimentoId || 'avulso'}`
    });
  } catch (errReserva) {
    await atualizarMensagemSms(supabase, smsMessageId, tenantId, {
      status: 'falha',
      falhou_em: new Date().toISOString(),
      ultimo_erro: `Falha na reserva: ${errReserva.message}`
    });

    throw errReserva;
  }

  if (!reservaResult?.success) {
    await atualizarMensagemSms(supabase, smsMessageId, tenantId, {
      status: 'falha',
      falhou_em: new Date().toISOString(),
      ultimo_erro: reservaResult?.message || 'Saldo insuficiente para reserva'
    });

    return {
      success: false,
      status: 'falha_reserva',
      erro: reservaResult?.message || 'Não foi possível reservar crédito de SMS.'
    };
  }

  // Atualiza mensagem para o estado 'reservado'
  await atualizarMensagemSms(supabase, smsMessageId, tenantId, {
    status: 'reservado',
    updated_at: new Date().toISOString()
  });

  // 8. Disparo via Cliente SMSDev
  const smsClient = clientCustom || new SmsDevClient();

  const resultadoEnvio = await smsClient.enviarSms({
    telefone: telefoneFormatado,
    mensagem: mensagemSanitizada,
    referId
  });

  const timestampAgora = new Date().toISOString();

  // ─── CENÁRIO A: ACEITE DO PROVEDOR (Sucesso) ─────────────────────────────────
  if (resultadoEnvio.success && resultadoEnvio.providerMessageId) {
    // Confirma consumo atomicamente (debita saldo total e zera a reserva)
    await confirmarConsumoSms(supabase, {
      tenantId,
      quantidade: 1,
      smsMessageId,
      usuarioId,
      motivo: `Consumo confirmado (SMSDev ID: ${resultadoEnvio.providerMessageId})`
    });

    await atualizarMensagemSms(supabase, smsMessageId, tenantId, {
      status: 'enviado',
      provider_message_id: resultadoEnvio.providerMessageId,
      enviado_em: timestampAgora,
      raw_response: resultadoEnvio.raw || {},
      tentativas: (smsMessageRecord.tentativas || 0) + 1,
      updated_at: timestampAgora
    });

    return {
      success: true,
      status: 'enviado',
      messageId: smsMessageId,
      providerMessageId: resultadoEnvio.providerMessageId,
      telefoneFormatado
    };
  }

  // ─── CENÁRIO B: REJEIÇÃO EXPLÍCITA DO PROVEDOR ────────────────────────────────
  // O servidor da SMSDev processou e explicitamente rejeitou o SMS (ex: situacao='ERRO', 4xx).
  // É seguro liberar os créditos reservados de volta para o tenant.
  if (resultadoEnvio.isExplicitRejection) {
    console.warn(`[SMS Notification] Rejeição explícita da SMSDev. Liberando reserva do tenant ${tenantId}...`);

    await liberarReservaSms(supabase, {
      tenantId,
      quantidade: 1,
      smsMessageId,
      usuarioId,
      motivo: `Liberação por rejeição do gateway: ${resultadoEnvio.descricao || resultadoEnvio.codigo}`
    });

    await atualizarMensagemSms(supabase, smsMessageId, tenantId, {
      status: 'falha',
      falhou_em: timestampAgora,
      ultimo_erro: resultadoEnvio.descricao || resultadoEnvio.codigo || 'Mensagem rejeitada pelo provedor SMSDev',
      raw_response: resultadoEnvio.raw || {},
      tentativas: (smsMessageRecord.tentativas || 0) + 1,
      updated_at: timestampAgora
    });

    return {
      success: false,
      status: 'falha',
      erro: resultadoEnvio.descricao || 'Mensagem rejeitada pela SMSDev.',
      codigo: resultadoEnvio.codigo,
      messageId: smsMessageId
    };
  }

  // ─── CENÁRIO C: FALHA DE COMUNICAÇÃO COM RESULTADO INCERTO (Timeout/5xx) ─────
  // A requisição HTTP falhou antes da confirmação ou após envio do pacote.
  // NÃO LIBERAR A RESERVA! O crédito permanece reservado até reconciliação via DLR ou consulta.
  if (resultadoEnvio.isUncertain) {
    console.error(`[SMS Notification] Falha de comunicação com resultado incerto para tenant ${tenantId}. Reserva retida.`);

    await atualizarMensagemSms(supabase, smsMessageId, tenantId, {
      status: 'pendente', // Mantém pendente para reconciliação
      ultimo_erro: `FALHA_COMUNICACAO_INCERTA: ${resultadoEnvio.descricao}`,
      raw_response: resultadoEnvio.raw || {},
      tentativas: (smsMessageRecord.tentativas || 0) + 1,
      updated_at: timestampAgora
    });

    return {
      success: false,
      status: 'pendente',
      incerto: true,
      erro: 'Instabilidade de conexão com o provedor. O envio está pendente de confirmação.',
      detalhe: resultadoEnvio.descricao,
      messageId: smsMessageId
    };
  }

  // Fallback de segurança genérico
  return {
    success: false,
    status: 'falha_desconhecida',
    erro: 'Desfecho não identificado no processamento da notificação.',
    messageId: smsMessageId
  };
}
