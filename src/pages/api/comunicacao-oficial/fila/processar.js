import { createServerClient } from '@/lib/supabase-server';
import { MetaGraphClient } from '@/lib/meta-graph-client';

/**
 * API Handler para processamento assíncrono em lote da fila de disparos oficiais (communication_campaign_items).
 * Consome contatos pendentes, sinaliza envio na Graph API, grava status na fila e incrementa totais da campanha.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { limite = 10 } = req.body || {};

  try {
    const supabase = createServerClient();

    // 1. Busca os próximos IDs pendentes da fila de disparos (communication_campaign_items)
    // Apenas campanhas que estão "Na Fila" ou "Executando" devem ter seus itens consumidos.
    const { data: pendentes, error: errSelect } = await supabase
      .from('communication_campaign_items')
      .select('id, communication_campaigns!inner(status)')
      .eq('status', 'pendente')
      .in('communication_campaigns.status', ['Na Fila', 'Executando', 'processando'])
      .limit(limite);

    if (errSelect) throw errSelect;

    if (!pendentes || pendentes.length === 0) {
      return res.status(200).json({ processados: 0, mensagem: 'Nenhum disparo pendente na fila.' });
    }

    const ids = pendentes.map(p => p.id);

    // 2. Reserva os itens na base física alterando o status para 'processando'
    const { data: itensReservados, error: errReserva } = await supabase
      .from('communication_campaign_items')
      .update({
        status: 'processando',
        started_at: new Date().toISOString()
      })
      .in('id', ids)
      .select('*');

    if (errReserva) throw errReserva;

    let sucessos = 0;
    let falhas = 0;

    for (const item of (itensReservados || [])) {
      try {
        // 3. Busca a campanha associada para obter metadados de template e tenant
        const { data: campanha, error: errCamp } = await supabase
          .from('communication_campaigns')
          .select('*, communication_templates(nome)')
          .eq('id', item.campaign_id)
          .single();

        if (errCamp || !campanha) {
          throw new Error(`Campanha ${item.campaign_id} não localizada.`);
        }

        // 4. Busca as credenciais da Meta correspondentes ao tenant
        const { data: conta, error: errConta } = await supabase
          .from('communication_accounts')
          .select('*')
          .eq('tenant_id', campanha.tenant_id)
          .eq('provider', 'whatsapp')
          .eq('status', 'ativo')
          .maybeSingle();

        if (errConta || !conta || !conta.access_token || !conta.phone_number_id) {
          throw new Error('Credenciais de disparo da Meta ausentes para este tenant.');
        }

        const { registrarEventoTimeline } = require('@/lib/timeline-helper');

        // Se a campanha estava aguardando na fila, registra o início do processamento
        if (campanha.status === 'Na Fila') {
          await registrarEventoTimeline(supabase, campanha.id, {
            tipo: 'Processamento iniciado',
            descricao: 'O motor de disparos oficiais iniciou o processamento em lote da fila de transmissão.'
          });
        }

        // 5. Inicializa o cliente da Graph API
        const client = new MetaGraphClient({
          accessToken: conta.access_token,
          phoneNumberId: conta.phone_number_id,
          wabaId: conta.waba_id
        });

        const templateNome = campanha.communication_templates?.nome || item.template_id || 'default';
        const destinatarioNome = item.variaveis_mapeadas?.nome || 'Eleitor';

        // 5.1 Localiza ou cria a conversa na Central de Atendimento
        let { data: conversa, error: errConv } = await supabase
          .from('communication_conversations')
          .select('id')
          .eq('contact_id', item.contact_id)
          .eq('tenant_id', campanha.tenant_id)
          .neq('status', 'finalizada')
          .limit(1)
          .maybeSingle();

        if (!conversa) {
          const { data: novaConv, error: errCriaConv } = await supabase
            .from('communication_conversations')
            .insert({
              tenant_id: campanha.tenant_id,
              contact_id: item.contact_id,
              channel: 'whatsapp',
              status: 'nova',
              unread_count: 0
            })
            .select('id')
            .single();

          if (errCriaConv) throw errCriaConv;
          conversa = novaConv;
        }

        // 6. Executa disparo do template HSM na API oficial
        const resMeta = await client.enviarTemplate(item.contact_id, {
          templateNome: templateNome,
          idiomaCode: 'pt_BR',
          componentes: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: destinatarioNome }
              ]
            }
          ]
        }, campanha.tenant_id);

        const wamid = resMeta.messages?.[0]?.id || `wamid-cron-${Date.now()}`;
        const textoMensagem = `[Disparo Oficial Template: ${templateNome}] Olá ${destinatarioNome}`;

        // 6.1 Registra a mensagem de saída na Central de Atendimento
        await supabase
          .from('communication_messages')
          .insert({
            tenant_id: campanha.tenant_id,
            conversation_id: conversa.id,
            provider_message_id: wamid,
            provider: 'whatsapp',
            channel: 'whatsapp',
            direction: 'saida',
            mensagem: textoMensagem
          });

        // 6.2 Atualiza o preview da conversa correspondente
        await supabase
          .from('communication_conversations')
          .update({
            last_message_preview: textoMensagem,
            last_message_at: new Date().toISOString()
          })
          .eq('id', conversa.id);

        // 7. Atualização SUCESSO: Altera status para 'enviada'
        const novasVariaveis = {
          ...(item.variaveis_mapeadas || {}),
          conversation_id: conversa.id
        };

        await supabase
          .from('communication_campaign_items')
          .update({
            status: 'enviado',
            provider_message_id: wamid,
            attempts: (item.attempts || 0) + 1,
            variaveis_mapeadas: novasVariaveis,
            finished_at: new Date().toISOString()
          })
          .eq('id', item.id);

        // Incrementa totalizador de sucesso na campanha
        const novoTotalSucesso = (campanha.total_enviadas || 0) + 1;
        await supabase
          .from('communication_campaigns')
          .update({
            total_enviadas: novoTotalSucesso,
            status: 'Executando',
            updated_at: new Date().toISOString()
          })
          .eq('id', campanha.id);

        sucessos++;
      } catch (err) {
        console.error(`[ProcessarFilaAPI] Falha no processamento do item ${item.id}:`, err.message);

        // 8. Registro de FALHA: Atualiza status do item e incrementa contador da campanha
        await supabase
          .from('communication_campaign_items')
          .update({
            status: 'falha',
            attempts: (item.attempts || 0) + 1,
            last_error: err.message || 'Falha de transmissão na Graph API',
            finished_at: new Date().toISOString()
          })
          .eq('id', item.id);

        // Incrementa totalizador de falhas na campanha
        const { data: campanhaObj } = await supabase
          .from('communication_campaigns')
          .select('total_falhas')
          .eq('id', item.campaign_id)
          .single();

        const novoTotalFalhas = ((campanhaObj && campanhaObj.total_falhas) || 0) + 1;
        await supabase
          .from('communication_campaigns')
          .update({
            total_falhas: novoTotalFalhas,
            status: 'Executando',
            updated_at: new Date().toISOString()
          })
          .eq('id', item.campaign_id);

        const { registrarEventoTimeline } = require('@/lib/timeline-helper');
        await registrarEventoTimeline(supabase, item.campaign_id, {
          tipo: 'Falhas relevantes',
          descricao: `Erro ao enviar mensagem para ${item.contact_id}: ${err.message}`,
          metadata: { contact_id: item.contact_id, error: err.message }
        });

        falhas++;
      }
    }

    // 9. Atualiza status final das campanhas que finalizaram seus envios
    const { data: campanhasVerificar } = await supabase
      .from('communication_campaigns')
      .select('id, total_destinatarios, total_enviadas, total_falhas')
      .in('status', ['Na Fila', 'Executando']);

    const { registrarEventoTimeline } = require('@/lib/timeline-helper');

    for (const camp of (campanhasVerificar || [])) {
      const processados = (camp.total_enviadas || 0) + (camp.total_falhas || 0);
      if (processados >= (camp.total_destinatarios || 0) && camp.total_destinatarios > 0) {
        await supabase
          .from('communication_campaigns')
          .update({ status: 'concluido' })
          .eq('id', camp.id);

        await registrarEventoTimeline(supabase, camp.id, {
          tipo: 'Processamento concluído',
          descricao: `Todos os contatos foram processados. Envio concluído com sucesso.`
        });
      }
    }

    return res.status(200).json({
      processados: itensReservados.length,
      sucessos,
      falhas
    });
  } catch (error) {
    console.error('[ProcessarFilaAPI] Erro geral:', error);
    return res.status(500).json({ error: error.message });
  }
}
