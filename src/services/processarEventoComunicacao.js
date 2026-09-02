import { buscarContaWhatsappPorWabaOuNumero } from '@/lib/whatsapp-business-accounts';
import { normalizarTelefone } from '@/lib/atendimento-connect';

/**
 * Processa um evento inbound normalizado da Meta Cloud API diretamente no servidor,
 * sem autochamada HTTP entre APIs internas.
 *
 * Responsabilidades:
 * - Idempotência por provider_message_id/wamid
 * - Resolução dinâmica do tenant via whatsapp_business_accounts
 * - Vinculação automática de eleitor pelo telefone
 * - Gravação em communication_conversations e communication_messages
 * - Sincronização em atendimento_connect_conversas e atendimento_connect_mensagens
 *
 * @param {Object} supabase - Cliente Supabase do servidor
 * @param {Object} evento - Evento normalizado pelo MetaWebhookNormalizer
 * @returns {Promise<{success: boolean, duplicated?: boolean, mensagem?: Object}>}
 */
export async function processarEventoMensagem(supabase, evento) {
  console.log(`[META WEBHOOK] processando evento mensagem wamid=${evento.provider_message_id} telefone=${evento.contact_id}`);

  // ─── 1. IDEMPOTÊNCIA ─────────────────────────────────────────────────────────
  const { data: msgExistenteComm } = await supabase
    .from('communication_messages')
    .select('id')
    .eq('provider_message_id', evento.provider_message_id)
    .maybeSingle();

  const { data: msgExistenteConnect } = await supabase
    .from('atendimento_connect_mensagens')
    .select('id')
    .eq('provider_message_id', evento.provider_message_id)
    .maybeSingle();

  if (msgExistenteComm || msgExistenteConnect) {
    console.log(`[META WEBHOOK] idempotência: wamid=${evento.provider_message_id} já processado, ignorando.`);
    return { success: true, duplicated: true };
  }

  // ─── 2. RESOLUÇÃO DO TENANT ───────────────────────────────────────────────────
  console.log('[META WEBHOOK] processando tenant');
  let tenantId = null;
  try {
    const contaMeta = await buscarContaWhatsappPorWabaOuNumero(supabase, {
      wabaId: evento.waba_id,
      phoneNumberId: evento.phone_number_id
    });
    tenantId = contaMeta?.tenant_id || null;
  } catch (errConta) {
    console.warn('[META WEBHOOK] falha ao resolver conta Meta por WABA/Número:', errConta?.message);
  }

  if (!tenantId) {
    const { data: contaFallback } = await supabase
      .from('whatsapp_business_accounts')
      .select('tenant_id')
      .eq('status', 'ATIVO')
      .order('principal', { ascending: false })
      .limit(1)
      .maybeSingle();
    tenantId = contaFallback?.tenant_id || 1;
  }

  console.log(`[META WEBHOOK] tenant resolvido: ${tenantId}`);

  // ─── 3. LOCALIZAÇÃO DO ELEITOR ─────────────────────────────────────────────────
  const telefoneLimpo = normalizarTelefone(evento.contact_id || '');
  let eleitorId = null;
  let contatoNome = evento.contato_nome || evento.contact_id || 'Contato sem nome';

  if (telefoneLimpo) {
    // Tenta DDD + 9 dígitos (11 chars) e DDD + 8 dígitos (10 chars) para compatibilidade
    const dddNumero = telefoneLimpo.length >= 10 ? telefoneLimpo.slice(-11) : telefoneLimpo;
    const dddNumeroSemNono = (dddNumero.length === 11)
      ? `${dddNumero.slice(0, 2)}${dddNumero.slice(3)}`
      : dddNumero;

    const { data: eleitor } = await supabase
      .from('eleitores')
      .select('id, nome, whatsapp, celular, telefone')
      .or(`whatsapp.ilike.%${dddNumero}%,celular.ilike.%${dddNumero}%,telefone.ilike.%${dddNumero}%,whatsapp.ilike.%${dddNumeroSemNono}%,celular.ilike.%${dddNumeroSemNono}%,telefone.ilike.%${dddNumeroSemNono}%`)
      .limit(1)
      .maybeSingle();

    if (eleitor?.id) {
      eleitorId = eleitor.id;
      contatoNome = eleitor.nome || contatoNome;
      console.log(`[META WEBHOOK] eleitor vinculado: id=${eleitorId} nome=${contatoNome}`);
    }
  }

  // ─── 4. COMMUNICATION_CONVERSATIONS & COMMUNICATION_MESSAGES ──────────────────
  let { data: conversaComm } = await supabase
    .from('communication_conversations')
    .select('*')
    .eq('contact_id', evento.contact_id)
    .neq('status', 'finalizada')
    .limit(1)
    .maybeSingle();

  if (!conversaComm) {
    const { data: novaConvComm, error: errCriaConvComm } = await supabase
      .from('communication_conversations')
      .insert({
        tenant_id: tenantId,
        contact_id: evento.contact_id,
        channel: evento.mensagem_tipo === 'instagram' ? 'instagram' : 'whatsapp',
        status: 'nova',
        unread_count: 1,
        last_message_at: evento.timestamp,
        last_message_preview: evento.conteudo
      })
      .select('*')
      .single();

    if (errCriaConvComm) throw errCriaConvComm;
    conversaComm = novaConvComm;
  } else {
    const { error: errUpdateComm } = await supabase
      .from('communication_conversations')
      .update({
        last_message_preview: evento.conteudo,
        last_message_at: evento.timestamp,
        unread_count: (conversaComm.unread_count || 0) + 1
      })
      .eq('id', conversaComm.id);

    if (errUpdateComm) throw errUpdateComm;
  }

  const { data: msgInserida, error: errMsgComm } = await supabase
    .from('communication_messages')
    .insert({
      tenant_id: tenantId,
      conversation_id: conversaComm.id,
      provider_message_id: evento.provider_message_id,
      provider: 'whatsapp',
      channel: conversaComm.channel || 'whatsapp',
      direction: 'entrada',
      mensagem: evento.conteudo
    })
    .select('*')
    .single();

  if (errMsgComm) throw errMsgComm;

  // ─── 5. ATENDIMENTO_CONNECT_CONVERSAS & ATENDIMENTO_CONNECT_MENSAGENS ──────────
  try {
    const now = evento.timestamp || new Date().toISOString();

    const { data: conversaConnectExistente } = await supabase
      .from('atendimento_connect_conversas')
      .select('*')
      .eq('canal', 'whatsapp')
      .eq('contato_telefone', telefoneLimpo)
      .maybeSingle();

    let conversaConnectId = conversaConnectExistente?.id;

    const connectMetadata = {
      ...(conversaConnectExistente?.metadata || {}),
      origem: 'whatsapp_meta',
      provider: 'META',
      wabaId: evento.waba_id || null,
      phoneNumberId: evento.phone_number_id || null,
      lastProviderMessageId: evento.provider_message_id
    };

    if (!conversaConnectExistente) {
      const { data: novaConvConnect, error: errNovaConnect } = await supabase
        .from('atendimento_connect_conversas')
        .insert({
          contato_nome: contatoNome,
          contato_telefone: telefoneLimpo,
          canal: 'whatsapp',
          status: 'nova',
          eleitor_id: eleitorId,
          unread_count: 1,
          ultima_mensagem: evento.conteudo,
          ultima_mensagem_em: now,
          metadata: connectMetadata
        })
        .select('*')
        .single();

      if (errNovaConnect) {
        console.error('[ATENDIMENTO CONNECT] erro ao criar conversa:', errNovaConnect.message);
      } else {
        conversaConnectId = novaConvConnect?.id;
        console.log(`[ATENDIMENTO CONNECT] conversa criada: id=${conversaConnectId} telefone=${telefoneLimpo}`);
      }
    } else {
      const statusAtual = conversaConnectExistente.status;
      const novoStatus = (statusAtual === 'concluida' || statusAtual === 'aguardando_eleitor') ? 'nova' : statusAtual;
      const novoUnread = (conversaConnectExistente.unread_count || 0) + 1;

      const { error: errUpdateConnect } = await supabase
        .from('atendimento_connect_conversas')
        .update({
          contato_nome: contatoNome,
          status: novoStatus,
          eleitor_id: eleitorId || conversaConnectExistente.eleitor_id || null,
          unread_count: novoUnread,
          ultima_mensagem: evento.conteudo,
          ultima_mensagem_em: now,
          metadata: connectMetadata,
          updated_at: now
        })
        .eq('id', conversaConnectExistente.id);

      if (errUpdateConnect) {
        console.error('[ATENDIMENTO CONNECT] erro ao atualizar conversa:', errUpdateConnect.message);
      } else {
        console.log(`[ATENDIMENTO CONNECT] conversa atualizada: id=${conversaConnectExistente.id} status=${novoStatus} unread=${novoUnread}`);
      }
    }

    if (conversaConnectId) {
      const { error: errMsgConnect } = await supabase
        .from('atendimento_connect_mensagens')
        .insert({
          conversa_id: conversaConnectId,
          direcao: 'entrada',
          mensagem: evento.conteudo,
          provider_message_id: evento.provider_message_id,
          raw_payload: evento
        });

      if (errMsgConnect) {
        console.error('[ATENDIMENTO CONNECT] erro ao registrar mensagem:', errMsgConnect.message);
      } else {
        console.log(`[ATENDIMENTO CONNECT] mensagem registrada: wamid=${evento.provider_message_id} conversa=${conversaConnectId}`);
      }
    }
  } catch (errConnect) {
    // Falha no Atendimento Connect não bloqueia a Comunicação Oficial
    console.error('[ATENDIMENTO CONNECT] falha na sincronização:', errConnect?.message);
  }

  console.log(`[META WEBHOOK] processamento concluído: wamid=${evento.provider_message_id}`);
  return { success: true, mensagem: msgInserida };
}

/**
 * Processa um evento de alteração de status (sent/delivered/read/failed) da Meta.
 *
 * @param {Object} supabase - Cliente Supabase do servidor
 * @param {Object} evento - Evento normalizado pelo MetaWebhookNormalizer
 * @returns {Promise<{success: boolean}>}
 */
export async function processarEventoStatus(supabase, evento) {
  const statusMap = {
    sent: 'enviada',
    delivered: 'entregue',
    read: 'lida',
    failed: 'falhou'
  };

  const STATUS_PRIORITY = {
    sent: 1, enviada: 1, enviado: 1,
    delivered: 2, entregue: 2,
    read: 3, lida: 3, lido: 3,
    failed: 4, falhou: 4, falha: 4
  };

  const statusInterno = statusMap[evento.status] || evento.status;
  const novoStatusPrioridade = STATUS_PRIORITY[evento.status] || 0;

  // Atualiza communication_messages
  const { data: msgFila } = await supabase
    .from('communication_messages')
    .select('*')
    .eq('provider_message_id', evento.provider_message_id)
    .maybeSingle();

  if (msgFila) {
    const statusAtualMsg = msgFila.meta_dados?.status;
    const statusAtualPrioridade = STATUS_PRIORITY[statusAtualMsg] || 0;

    if (evento.status === 'failed' || novoStatusPrioridade >= statusAtualPrioridade) {
      const { error: errUpdateMsg } = await supabase
        .from('communication_messages')
        .update({
          meta_dados: {
            ...(msgFila.meta_dados || {}),
            status: statusInterno,
            atualizado_em: evento.timestamp
          }
        })
        .eq('id', msgFila.id);

      if (errUpdateMsg) throw errUpdateMsg;
    }
  }

  // Atualiza communication_campaign_items com progressão estrita de status
  const { data: itemFilaObj } = await supabase
    .from('communication_campaign_items')
    .select('id, campaign_id, status, delivered_at, read_at, last_error')
    .eq('provider_message_id', evento.provider_message_id)
    .maybeSingle();

  if (itemFilaObj) {
    const prioridadeAtualItem = STATUS_PRIORITY[itemFilaObj.status] || 0;
    const updatePayload = {};

    if (evento.status === 'failed') {
      updatePayload.status = 'falha';
      updatePayload.last_error = JSON.stringify(evento.erro);
    } else if (novoStatusPrioridade >= prioridadeAtualItem) {
      updatePayload.status = novoStatusPrioridade === 3 ? 'lido' : novoStatusPrioridade === 2 ? 'entregue' : 'enviado';
    }

    if (evento.status === 'delivered' || evento.status === 'read') {
      if (!itemFilaObj.delivered_at) updatePayload.delivered_at = evento.timestamp;
    }
    if (evento.status === 'read') {
      if (!itemFilaObj.read_at) updatePayload.read_at = evento.timestamp;
    }

    if (Object.keys(updatePayload).length > 0) {
      await supabase
        .from('communication_campaign_items')
        .update(updatePayload)
        .eq('id', itemFilaObj.id);
    }

    // Recalcula totais da campanha
    const { data: todosItens } = await supabase
      .from('communication_campaign_items')
      .select('status')
      .eq('campaign_id', itemFilaObj.campaign_id);

    if (todosItens) {
      let enviadas = 0, entregues = 0, lidas = 0, falhas = 0;
      todosItens.forEach(it => {
        if (it.status === 'enviado') enviadas++;
        else if (it.status === 'entregue') entregues++;
        else if (it.status === 'lido') lidas++;
        else if (it.status === 'falha') falhas++;
      });

      await supabase
        .from('communication_campaigns')
        .update({
          total_enviadas: enviadas + entregues + lidas,
          total_entregues: entregues + lidas,
          total_lidas: lidas,
          total_falhas: falhas,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemFilaObj.campaign_id);
    }
  }

  // Atualização dos status de disparo_envios (Campanhas Mandato Connect) para Meta Oficial
  try {
    const statusDisparoMap = {
      sent: 'enviado',
      delivered: 'entregue',
      read: 'lido',
      failed: 'falhou'
    };
    const statusDisparoFinal = statusDisparoMap[evento.status] || evento.status;

    const STATUS_DISPARO_PRIORITY = {
      pendente: 0,
      processando: 0,
      enviado: 1,
      entregue: 2,
      lido: 3,
      falhou: 4
    };

    const { data: envioLinha } = await supabase
      .from('disparo_envios')
      .select('id, status, erro')
      .eq('provider_message_id', evento.provider_message_id)
      .maybeSingle();

    if (envioLinha) {
      const prioridadeAtual = STATUS_DISPARO_PRIORITY[String(envioLinha.status).toLowerCase()] || 0;
      const prioridadeNova = STATUS_DISPARO_PRIORITY[String(statusDisparoFinal).toLowerCase()] || 0;

      if (statusDisparoFinal === 'falhou' || prioridadeNova >= prioridadeAtual) {
        const envioUpdatePayload = {
          status: statusDisparoFinal
        };

        if (statusDisparoFinal === 'falhou') {
          const errDetail = evento.erro
            ? (typeof evento.erro === 'object' ? (evento.erro.message || JSON.stringify(evento.erro)) : String(evento.erro))
            : 'Falha no envio';
          envioUpdatePayload.erro = errDetail;
        }

        await supabase
          .from('disparo_envios')
          .update(envioUpdatePayload)
          .eq('id', envioLinha.id);
      }
    }
  } catch (errEnvioMeta) {
    console.warn('Aviso: Falha ao atualizar status em disparo_envios via webhook Meta:', errEnvioMeta?.message);
  }

  return { success: true };
}
