/**
 * Utilitário de Resolução Segura de Campanha para Mensagens Inbound
 * Atendimento Connect / MandatoPRO
 */

/**
 * Gera as variações possíveis de um número de telefone brasileiro
 * considerando a divergência do 9º dígito (ex: 559196010717 e 5591996010717).
 *
 * @param {string} phone - Telefone em qualquer formato
 * @returns {string[]} Array com as variantes possíveis normalizadas
 */
export function obterVariantesTelefoneBr(phone) {
  if (!phone) return [];
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return [];

  const variantes = new Set();
  variantes.add(digits);

  // Normalização Brasil com DDI 55
  if (digits.startsWith('55')) {
    const ddd = digits.substring(2, 4);
    const numero = digits.substring(4);

    // Se tem 8 dígitos no número local (ex: 55 + DDD + 8 dígitos = 12 dígitos)
    if (numero.length === 8) {
      variantes.add('55' + ddd + '9' + numero);
    }
    // Se tem 9 dígitos no número local (ex: 55 + DDD + 9 + 8 dígitos = 13 dígitos)
    else if (numero.length === 9 && numero.startsWith('9')) {
      variantes.add('55' + ddd + numero.substring(1));
    }
  } else if (digits.length === 10) {
    // DDD + 8 dígitos sem 55
    const ddd = digits.substring(0, 2);
    const numero = digits.substring(2);
    variantes.add('55' + digits);
    variantes.add('55' + ddd + '9' + numero);
  } else if (digits.length === 11) {
    // DDD + 9 dígitos sem 55
    const ddd = digits.substring(0, 2);
    const numero = digits.substring(2);
    variantes.add('55' + digits);
    if (numero.startsWith('9')) {
      variantes.add('55' + ddd + numero.substring(1));
    }
  }

  return Array.from(variantes);
}

/**
 * Resolve com segurança e sem suposições se uma mensagem inbound de WhatsApp
 * está associada a uma campanha de disparo oficial (communication_campaigns).
 *
 * NÍVEL 1: Quote / Context Reply (Citação direta de mensagem disparada)
 * NÍVEL 2: Temporal Recente Seguro (Única campanha nos últimos 48h com status enviado/entregue/lido)
 *
 * @param {Object} params
 * @param {Object} params.supabase - Cliente Supabase autenticado/service
 * @param {number|string} params.tenantId - ID do tenant
 * @param {string} [params.quotedMessageId] - ID da mensagem citada (wamid ou provider_message_id)
 * @param {string} params.contatoTelefone - Telefone de quem enviou a resposta
 * @param {string} [params.timestamp] - Data/hora do recebimento (ISO string)
 * @param {string} [params.provider] - Provedor receptor (META, YCLOUD, WABLAST)
 * @param {number|string} [params.campanhaIdExistente] - Campanha já vinculada à conversa (se houver)
 * @returns {Promise<{
 *   campanhaId: number|null,
 *   campaignItemId: number|null,
 *   metodoAtribuicao: 'direto_quote'|'temporal_recente'|null,
 *   detalhes?: string
 * }>}
 */
export async function resolverCampanhaInbound({
  supabase,
  tenantId,
  quotedMessageId,
  contatoTelefone,
  timestamp,
  provider,
  campanhaIdExistente = null
}) {
  const agora = timestamp ? new Date(timestamp) : new Date();
  const agoraIso = agora.toISOString();

  // ─── REGRA DE PRESERVAÇÃO: NÃO SOBRESCREVER ATRIBUIÇÃO EXISTENTE SEM EVIDÊNCIA SUPERIOR ───
  if (campanhaIdExistente && !quotedMessageId) {
    return {
      campanhaId: campanhaIdExistente,
      campaignItemId: null,
      metodoAtribuicao: null,
      detalhes: 'preservada_existente'
    };
  }

  // ─── NÍVEL 1: QUOTE / CONTEXT REPLY (CITAÇÃO DIRETA) ─────────────────────────
  if (quotedMessageId && typeof quotedMessageId === 'string' && quotedMessageId.trim()) {
    const qId = quotedMessageId.trim();

    let queryQuote = supabase
      .from('communication_campaign_items')
      .select('id, campaign_id, tenant_id, status, provider_message_id, communication_campaigns!inner(id, tenant_id, status)')
      .eq('provider_message_id', qId);

    if (tenantId) {
      queryQuote = queryQuote.eq('tenant_id', tenantId);
    }

    const { data: itensCitados, error: errQuote } = await queryQuote.limit(5);

    if (!errQuote && itensCitados && itensCitados.length > 0) {
      const validos = itensCitados.filter(it =>
        ['enviado', 'entregue', 'lido'].includes(String(it.status).toLowerCase())
      );

      if (validos.length === 1) {
        const itemEscolhido = validos[0];
        return {
          campanhaId: itemEscolhido.campaign_id,
          campaignItemId: itemEscolhido.id,
          metodoAtribuicao: 'direto_quote',
          detalhes: 'match_quote_unico'
        };
      } else if (validos.length > 1) {
        const campanhasDistintas = Array.from(new Set(validos.map(v => v.campaign_id)));
        if (campanhasDistintas.length === 1) {
          return {
            campanhaId: campanhasDistintas[0],
            campaignItemId: validos[0].id,
            metodoAtribuicao: 'direto_quote',
            detalhes: 'match_quote_multi_item_mesma_campanha'
          };
        }
      }
    }
  }

  // ─── NÍVEL 2: ATRIBUIÇÃO TEMPORAL SEGURA (48 HORAS) ─────────────────────────
  if (campanhaIdExistente) {
    return {
      campanhaId: campanhaIdExistente,
      campaignItemId: null,
      metodoAtribuicao: null,
      detalhes: 'preservada_existente'
    };
  }

  if (!contatoTelefone) {
    return { campanhaId: null, campaignItemId: null, metodoAtribuicao: null, detalhes: 'sem_telefone' };
  }

  const variantesTelefone = obterVariantesTelefoneBr(contatoTelefone);
  if (variantesTelefone.length === 0) {
    return { campanhaId: null, campaignItemId: null, metodoAtribuicao: null, detalhes: 'telefone_invalido' };
  }

  // Janela máxima de 48 horas retroativas a partir do timestamp do inbound
  const limiteTemporalMs = 48 * 60 * 60 * 1000;
  const dataLimite = new Date(agora.getTime() - limiteTemporalMs).toISOString();

  let queryTemporal = supabase
    .from('communication_campaign_items')
    .select('id, campaign_id, tenant_id, status, contact_id, created_at, communication_campaigns!inner(id, tenant_id, canal, status)')
    .in('contact_id', variantesTelefone)
    .in('status', ['enviado', 'entregue', 'lido'])
    .gte('created_at', dataLimite)
    .lte('created_at', agoraIso)
    .order('created_at', { ascending: false });

  if (tenantId) {
    queryTemporal = queryTemporal.eq('tenant_id', tenantId);
  }

  const { data: itensRecentes, error: errTemporal } = await queryTemporal.limit(20);

  if (errTemporal || !itensRecentes || itensRecentes.length === 0) {
    return {
      campanhaId: null,
      campaignItemId: null,
      metodoAtribuicao: null,
      detalhes: errTemporal ? 'erro_consulta_temporal' : 'sem_disparos_recentes'
    };
  }

  // Analisar campanhas distintas encontradas na janela de 48 horas
  const campanhasUnicas = Array.from(new Set(itensRecentes.map(item => item.campaign_id)));

  // Regra Obrigatória 5: Se existir EXATAMENTE UMA campanha distinta nesse intervalo
  if (campanhasUnicas.length === 1) {
    const campanhaId = campanhasUnicas[0];
    const itemCorrespondente = itensRecentes[0];

    return {
      campanhaId,
      campaignItemId: itemCorrespondente.id,
      metodoAtribuicao: 'temporal_recente',
      detalhes: 'unica_campanha_48h'
    };
  }

  // Regra Obrigatória 6: Se houver duas ou mais campanhas distintas no intervalo → NÃO atribuir
  return {
    campanhaId: null,
    campaignItemId: null,
    metodoAtribuicao: null,
    detalhes: 'multiplas_campanhas_recentes_' + campanhasUnicas.length
  };
}

/**
 * Recupera com segurança os dados do disparo de origem associado à conversa
 * para enriquecer a resposta do endpoint GET /api/atendimento-connect/conversas/[id].
 *
 * @param {Object} params
 * @param {Object} params.supabase - Cliente Supabase autenticado
 * @param {number|string} params.tenantId - ID do tenant autenticado
 * @param {Object} params.conversa - Objeto da conversa do banco
 * @returns {Promise<Object|null>} Objeto disparoOrigem ou null
 */
export async function buscarDisparoOrigem({ supabase, tenantId, conversa }) {
  if (!conversa) return null;
  // Se a conversa não possui campanha_id vinculado (ex: ambígua ou sem campanha), não há disparo válido
  if (!conversa.campanha_id) return null;
  const campaignItemId = conversa.metadata?.campaign_item_id;
  if (!campaignItemId) return null;

  try {
    // 1. Buscar o item de disparo garantindo tenant_id
    let query = supabase
      .from('communication_campaign_items')
      .select('id, tenant_id, campaign_id, contact_id, status, provider_message_id, variaveis_mapeadas, started_at, finished_at, communication_campaigns(id, canal)')
      .eq('id', campaignItemId);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: item, error: errItem } = await query.maybeSingle();
    if (errItem || !item) return null;

    // 2. Validação de integridade entre campaign_id da conversa e campaign_id do item
    if (conversa.campanha_id && Number(conversa.campanha_id) !== Number(item.campaign_id)) {
      console.warn(`[ATENDIMENTO CONNECT] Inconsistência de campanha na conversa ${conversa.id}: conversa.campanha_id=${conversa.campanha_id} != item.campaign_id=${item.campaign_id}`);
      return null;
    }

    // 3. Buscar a mensagem enviada de saída correspondente, quando disponível
    let mensagemTexto = null;
    let provider = null;

    const conversationIdComm = item.variaveis_mapeadas?.conversation_id;
    if (item.provider_message_id || conversationIdComm) {
      let msgQuery = supabase
        .from('communication_messages')
        .select('id, mensagem, provider, created_at')
        .eq('direction', 'saida');

      if (item.provider_message_id) {
        msgQuery = msgQuery.eq('provider_message_id', item.provider_message_id);
      } else if (conversationIdComm) {
        msgQuery = msgQuery.eq('conversation_id', conversationIdComm);
      }

      if (tenantId) {
        msgQuery = msgQuery.eq('tenant_id', tenantId);
      }

      const { data: msgOut } = await msgQuery.limit(1).maybeSingle();
      if (msgOut) {
        mensagemTexto = msgOut.mensagem || null;
        provider = msgOut.provider || null;
      }
    }

    // Se não encontrou provider na mensagem, busca via canal da campanha
    if (!provider && item.communication_campaigns?.canal) {
      provider = String(item.communication_campaigns.canal).toUpperCase();
    }

    // 4. Buscar número remetente associado à conta do tenant, quando disponível
    let numeroRemetente = null;
    try {
      const { data: accNumber } = await supabase
        .from('whatsapp_business_numbers')
        .select('display_phone_number')
        .eq('tenant_id', tenantId || item.tenant_id)
        .eq('status', 'ATIVO')
        .order('principal', { ascending: false })
        .limit(1)
        .maybeSingle();
      numeroRemetente = accNumber?.display_phone_number || null;
    } catch (eNum) {
      // Silencioso defensivo
    }

    return {
      campaignItemId: item.id,
      campaignId: item.campaign_id,
      providerMessageId: item.provider_message_id || null,
      status: item.status || null,
      startedAt: item.started_at || null,
      finishedAt: item.finished_at || null,
      variaveisMapeadas: item.variaveis_mapeadas || null,
      mensagemEnviada: mensagemTexto,
      provider: provider || null,
      numeroRemetente: numeroRemetente || null
    };
  } catch (err) {
    console.error('[ATENDIMENTO CONNECT] Erro ao buscar disparoOrigem:', err?.message);
    return null;
  }
}
