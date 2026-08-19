import { createServerClient } from '@/lib/supabase-server';
import { buscarContaWhatsappPorWabaOuNumero } from '@/lib/whatsapp-business-accounts';
import { normalizarTelefone } from '@/lib/atendimento-connect';

/**
 * API Handler para processamento de eventos do webhook com RLS e persistência atômica.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const evento = req.body;

  if (!evento || !evento.tipo) {
    return res.status(400).json({ error: 'Evento inválido' });
  }

  try {
    const supabase = createServerClient();

    // 1. PROCESSAMENTO DE MENSAGENS DE ENTRADA
    if (evento.tipo === 'mensagem') {
      // Idempotência: Verifica se o provider_message_id já existe em communication_messages ou atendimento_connect_mensagens
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
        console.log(`[WebhookProcessar] Mensagem ${evento.provider_message_id} já processada (idempotência ativa).`);
        return res.status(200).json({ success: true, duplicated: true });
      }

      // 1.1 Resolução do Tenant ID real através da conta WhatsApp Meta
      let tenantId = null;
      try {
        const contaMeta = await buscarContaWhatsappPorWabaOuNumero(supabase, {
          wabaId: evento.waba_id,
          phoneNumberId: evento.phone_number_id
        });
        tenantId = contaMeta?.tenant_id || null;
      } catch (errConta) {
        console.warn('[WebhookProcessar] Falha ao resolver conta Meta por WABA/Número:', errConta?.message);
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

      // 1.2 Localização do Eleitor pelo Telefone Normalizado
      const telefoneLimpo = normalizarTelefone(evento.contact_id || '');
      let eleitorId = null;
      let contatoNome = evento.contato_nome || evento.contact_id || 'Contato sem nome';

      if (telefoneLimpo) {
        // Busca eleitor por telefone, celular ou whatsapp (considerando DDD ou número com/sem 55)
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
        }
      }

      // 1.3 Persistência em communication_conversations & communication_messages (Comunicação Oficial)
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
        const novoUnread = (conversaComm.unread_count || 0) + 1;
        const { error: errUpdateComm } = await supabase
          .from('communication_conversations')
          .update({
            last_message_preview: evento.conteudo,
            last_message_at: evento.timestamp,
            unread_count: novoUnread
          })
          .eq('id', conversaComm.id);

        if (errUpdateComm) throw errUpdateComm;
      }

      const { data: msgInseridaComm, error: errMsgComm } = await supabase
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

      // 1.4 Sincronização em atendimento_connect_conversas & atendimento_connect_mensagens (Atendimento Connect)
      try {
        const now = evento.timestamp || new Date().toISOString();

        // Localiza conversa existente para o telefone + canal whatsapp
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
            console.error('[WebhookProcessar] Erro ao inserir atendimento_connect_conversas:', errNovaConnect);
          } else {
            conversaConnectId = novaConvConnect?.id;
          }
        } else {
          // Se conversa já existe, reabre se estiver concluída e atualiza contadores/eleitor
          const statusAtual = conversaConnectExistente.status;
          const novoStatus = statusAtual === 'concluida' ? 'nova' : statusAtual;
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
            console.error('[WebhookProcessar] Erro ao atualizar atendimento_connect_conversas:', errUpdateConnect);
          }
        }

        // Insere a mensagem inbound em atendimento_connect_mensagens
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
            console.error('[WebhookProcessar] Erro ao inserir atendimento_connect_mensagens:', errMsgConnect);
          }
        }
      } catch (errConnect) {
        console.error('[WebhookProcessar] Falha na sincronização do Atendimento Connect:', errConnect);
      }

      return res.status(200).json({ success: true, mensagem: msgInseridaComm });
    }

    // 2. PROCESSAMENTO DE ALTERAÇÃO DE STATUS
    if (evento.tipo === 'status') {
      const statusMap = {
        sent: 'enviada',
        delivered: 'entregue',
        read: 'lida',
        failed: 'falhou'
      };

      const statusInterno = statusMap[evento.status] || evento.status;

      // Mapeamento de prioridades para progressão estrita de status
      const STATUS_PRIORITY = {
        sent: 1,
        enviada: 1,
        enviado: 1,
        delivered: 2,
        entregue: 2,
        read: 3,
        lida: 3,
        lido: 3,
        failed: 4,
        falhou: 4,
        falha: 4
      };

      const novoStatusPrioridade = STATUS_PRIORITY[evento.status] || 0;

      // Localiza a mensagem na fila
      const { data: msgFila, error: errFila } = await supabase
        .from('communication_messages')
        .select('*')
        .eq('provider_message_id', evento.provider_message_id)
        .maybeSingle();

      if (msgFila) {
        const statusAtualMsg = msgFila.meta_dados?.status;
        const statusAtualPrioridade = STATUS_PRIORITY[statusAtualMsg] || 0;

        // Permite atualização se for failed ou se a prioridade for maior/igual
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

      // Também tenta atualizar a fila de disparos de campanhas se houver correspondência
      const { data: itemFilaObj, error: errGetItem } = await supabase
        .from('communication_campaign_items')
        .select('id, campaign_id, status, delivered_at, read_at, last_error')
        .eq('provider_message_id', evento.provider_message_id)
        .maybeSingle();

      if (itemFilaObj) {
        const statusAtualItem = itemFilaObj.status;
        const prioridadeAtualItem = STATUS_PRIORITY[statusAtualItem] || 0;

        const updatePayload = {};

        // Atualiza status se for failed ou se não houver regressão
        if (evento.status === 'failed') {
          updatePayload.status = 'falha';
          updatePayload.last_error = JSON.stringify(evento.erro);
        } else if (novoStatusPrioridade >= prioridadeAtualItem) {
          updatePayload.status = novoStatusPrioridade === 3 ? 'lido' : novoStatusPrioridade === 2 ? 'entregue' : 'enviado';
        }

        // Preserva e atualiza timestamps sem apagar os existentes
        if (evento.status === 'delivered' || evento.status === 'read') {
          if (!itemFilaObj.delivered_at) {
            updatePayload.delivered_at = evento.timestamp;
          }
        }
        if (evento.status === 'read') {
          if (!itemFilaObj.read_at) {
            updatePayload.read_at = evento.timestamp;
          }
        }

        if (Object.keys(updatePayload).length > 0) {
          await supabase
            .from('communication_campaign_items')
            .update(updatePayload)
            .eq('id', itemFilaObj.id);
        }

        // Recalcula totais em tempo real da campanha no Supabase
        const { data: todosItens } = await supabase
          .from('communication_campaign_items')
          .select('status')
          .eq('campaign_id', itemFilaObj.campaign_id);

        if (todosItens) {
          let enviadas = 0;
          let entregues = 0;
          let lidas = 0;
          let falhas = 0;

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

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Tipo de evento não processado' });
  } catch (error) {
    console.error('[ProcessarEventoAPI] Erro ao consolidar evento:', error);
    return res.status(500).json({ error: error.message });
  }
}
