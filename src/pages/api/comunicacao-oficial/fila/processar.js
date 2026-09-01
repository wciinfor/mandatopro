import { createServerClient } from '@/lib/supabase-server';
import { buscarContaWhatsappPrincipal, normalizarWhatsappAccount } from '@/lib/whatsapp-business-accounts';
import { createWhatsAppProvider } from '@/services/whatsapp-provider-factory';

/**
 * Extrai, valida e formata os parâmetros das variáveis do template de forma dinâmica.
 * Suporta sequências numéricas {{1}}, {{2}}, {{3}}... em ordem crescente estrita.
 * Valida a presença de valor em todas as variáveis obrigatórias.
 * Se o template não possui variáveis numéricas (ex: hello_world), retorna array vazio ([]),
 * garantindo que nenhum parâmetro indevido seja enviado à Meta (evitando erro 132000).
 */
function extrairEValidarParametrosTemplate(variaveisMapeadas = {}) {
  const chavesNumericas = Object.keys(variaveisMapeadas || {})
    .filter(k => /^\d+$/.test(k))
    .map(Number)
    .sort((a, b) => a - b);

  const nomeContato = String(variaveisMapeadas?.nome || '').trim();

  // Caso 1: Existem variáveis numéricas explícitas ('1', '2', '3'...)
  if (chavesNumericas.length > 0) {
    const maxIndice = Math.max(...chavesNumericas);
    const parameters = [];

    for (let i = 1; i <= maxIndice; i++) {
      let rawVal = variaveisMapeadas[String(i)] ?? variaveisMapeadas[i];

      // Se a variável 1 estiver vazia, mas houver o nome do contato, utiliza o nome
      if ((rawVal === undefined || rawVal === null || String(rawVal).trim() === '') && i === 1 && nomeContato) {
        rawVal = nomeContato;
      }

      const valStr = String(rawVal !== undefined && rawVal !== null ? rawVal : '').trim();
      const valorFinal = valStr.replace(/\{nome\}/gi, nomeContato || 'Contato').trim();

      if (!valorFinal) {
        throw new Error(`Variável obrigatória {{${i}}} do template não possui valor preenchido.`);
      }

      parameters.push({
        type: 'text',
        text: valorFinal
      });
    }

    return parameters;
  }

  // Caso 2: Template sem variáveis numéricas (ex: hello_world, informativos estáticos)
  // Nunca injeta parâmetros automaticamente para templates com 0 variáveis
  return [];
}

/**
 * API Handler para processamento assíncrono em lote da fila de disparos oficiais (communication_campaign_items).
 * Consome contatos pendentes, sinaliza envio na Graph API, grava status na fila e incrementa totais da campanha.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { limite = 10, campaign_id = null } = req.body || {};

  try {
    const supabase = createServerClient();

    // 1. Busca os próximos IDs pendentes da fila de disparos (communication_campaign_items)
    // Apenas campanhas que estão "Na Fila" ou "Executando" devem ter seus itens consumidos.
    let queryPendentes = supabase
      .from('communication_campaign_items')
      .select('id, communication_campaigns!inner(status)')
      .eq('status', 'pendente')
      .in('communication_campaigns.status', ['Na Fila', 'Executando', 'processando']);

    if (campaign_id) {
      queryPendentes = queryPendentes.eq('campaign_id', campaign_id);
    }

    const { data: pendentes, error: errSelect } = await queryPendentes.limit(limite);

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
          .select('*, communication_templates(nome, idioma)')
          .eq('id', item.campaign_id)
          .single();

        if (errCamp || !campanha) {
          throw new Error(`Campanha ${item.campaign_id} não localizada.`);
        }

        // 4. Busca a conta WhatsApp oficial ativa do tenant usando o resolver centralizado
        const contaSelecionada = await buscarContaWhatsappPrincipal(supabase, { tenant_id: campanha.tenant_id });

        if (!contaSelecionada) {
          throw new Error(`Credenciais de disparo de WhatsApp ausentes para este tenant (${campanha.tenant_id}).`);
        }

        const { registrarEventoTimeline } = require('@/lib/timeline-helper');

        // Se a campanha estava aguardando na fila, registra o início do processamento
        if (campanha.status === 'Na Fila') {
          await registrarEventoTimeline(supabase, campanha.id, {
            tipo: 'Processamento iniciado',
            descricao: 'O motor de disparos oficiais iniciou o processamento em lote da fila de transmissão.'
          });
        }

        const contaNormalizada = normalizarWhatsappAccount(contaSelecionada);
        const providerAccount = {
          ...contaSelecionada,
          ...contaNormalizada,
          accessToken: contaSelecionada.access_token || contaSelecionada.ycloud_api_key,
          ycloudApiKey: contaSelecionada.ycloud_api_key
        };

        // 5. Inicializa o provider unificado via Factory (META, YCLOUD ou WABLAST conforme provedor ativo)
        const provider = createWhatsAppProvider(providerAccount);

        const templateNome = campanha.communication_templates?.nome || item.template_id || 'default';
        const templateIdioma = String(campanha.communication_templates?.idioma || '').trim();

        if (!templateIdioma) {
          throw new Error(`Template oficial "${templateNome}" não possui idioma válido cadastrado em communication_templates.`);
        }

        const destinatarioNome = item.variaveis_mapeadas?.nome || 'Eleitor';

        // 5.1 Valida e monta dinamicamente os parâmetros do template ({{1}}, {{2}}, {{3}}...)
        const parameters = extrairEValidarParametrosTemplate(item.variaveis_mapeadas);
        const components = parameters.length > 0
          ? [
              {
                type: 'body',
                parameters: parameters
              }
            ]
          : [];

        // 5.2 Localiza ou cria a conversa na Central de Atendimento
        let { data: conversa } = await supabase
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

        // 6. Executa disparo do template HSM via Provider Factory (Meta ou YCloud)
        const resProvider = await provider.sendTemplate({
          to: item.contact_id,
          recipient: item.contact_id,
          templateName: templateNome,
          idiomaCode: templateIdioma,
          components: components
        });

        const wamid = resProvider?.messageId || resProvider?.id || resProvider?.messages?.[0]?.id;
        if (!wamid) {
          throw new Error('Provedor WhatsApp não retornou um Message ID (WAMID) válido após o envio.');
        }
        const textoParametros = parameters.map((p, idx) => `{{${idx + 1}}}=${p.text}`).join(', ');
        const textoMensagem = textoParametros
          ? `[Disparo Oficial Template: ${templateNome}] ${textoParametros}`
          : `[Disparo Oficial Template: ${templateNome}] Olá ${destinatarioNome}`;

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
