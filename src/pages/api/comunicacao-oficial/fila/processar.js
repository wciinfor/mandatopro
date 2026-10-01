import { createServerClient } from '@/lib/supabase-server';
import { buscarContaWhatsappPrincipal, normalizarWhatsappAccount } from '@/lib/whatsapp-business-accounts';
import { createWhatsAppProvider } from '@/services/whatsapp-provider-factory';
import { enviarNotificacaoSmsServico } from '@/services/sms/smsNotificationService';

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
 * Interpola dinamicamente as variáveis de texto para disparos SMS ({nome}, {cidade}, {bairro}).
 */
function interpolarMensagemSms(templateTexto, item) {
  let msg = String(templateTexto || '');
  const vars = item?.variaveis_mapeadas || {};
  const nomeContato = String(vars.nome || '').trim();
  const cidadeContato = String(vars.cidade || vars.municipio || '').trim();
  const bairroContato = String(vars.bairro || '').trim();

  if (nomeContato) {
    msg = msg.replace(/\{nome\}/gi, nomeContato);
  } else {
    msg = msg.replace(/\{nome\}/gi, 'Contato');
  }

  if (cidadeContato) {
    msg = msg.replace(/\{cidade\}/gi, cidadeContato);
  } else {
    msg = msg.replace(/\{cidade\}/gi, '');
  }

  if (bairroContato) {
    msg = msg.replace(/\{bairro\}/gi, bairroContato);
  } else {
    msg = msg.replace(/\{bairro\}/gi, '');
  }

  return msg.replace(/\s{2,}/g, ' ').trim();
}

export const config = {
  maxDuration: 60
};

/**
 * API Handler para processamento assíncrono em lote da fila de disparos oficiais (communication_campaign_items).
 * Suporta canais WhatsApp (Oficial / Wafly) e SMS (SMSDev).
 * Consome contatos pendentes, sinaliza envio nos provedores, grava status na fila e incrementa totais da campanha.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { limite = 25, campaign_id = null } = req.body || {};

  try {
    const supabase = createServerClient();

    let limiteEfetivo = Number(limite) || 25;
    let isCampanhaAlvoWafly = false;

    // Se campaign_id for informado, verifica se a campanha é WAFLY e força limite unitário defensivamente
    if (campaign_id) {
      const { data: campInfo } = await supabase
        .from('communication_campaigns')
        .select('canal, metadata')
        .eq('id', campaign_id)
        .maybeSingle();

      if (String(campInfo?.metadata?.provider || '').toUpperCase() === 'WAFLY') {
        limiteEfetivo = 1;
        isCampanhaAlvoWafly = true;
      }
    }

    // 1. Busca os próximos IDs pendentes da fila de disparos (communication_campaign_items)
    // Apenas campanhas que estão "Na Fila" ou "Executando" devem ter seus itens consumidos.
    // Inclui também itens que ficaram em 'processando' por mais de 3 minutos (órfãos de timeouts passados)
    const cutoffOrfaos = new Date(Date.now() - 3 * 60 * 1000).toISOString();

    let queryPendentes = supabase
      .from('communication_campaign_items')
      .select('id, status, started_at, campaign_id, communication_campaigns!inner(status, canal, metadata)')
      .or(`status.eq.pendente,and(status.eq.processando,started_at.lt.${cutoffOrfaos})`)
      .in('communication_campaigns.status', ['Na Fila', 'Executando', 'processando']);

    if (campaign_id) {
      queryPendentes = queryPendentes.eq('campaign_id', campaign_id);
    }

    const { data: pendentes, error: errSelect } = await queryPendentes.limit(limiteEfetivo);

    if (errSelect) throw errSelect;

    if (!pendentes || pendentes.length === 0) {
      return res.status(200).json({ processados: 0, mensagem: 'Nenhum disparo pendente na fila.' });
    }

    // Defesa unitária adicional: se o lote contiver itens de campanha WAFLY, garante reserva de no máximo 1 item
    let pendentesFinal = pendentes;
    const contemWafly = pendentes.some(p => String(p.communication_campaigns?.metadata?.provider || '').toUpperCase() === 'WAFLY');
    if (isCampanhaAlvoWafly || contemWafly) {
      pendentesFinal = pendentes.slice(0, 1);
    }

    const ids = pendentesFinal.map(p => p.id);

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

    // Caches em memória por requisição para evitar roundtrips redundantes
    const campanhasMap = new Map();
    const contasMap = new Map();
    const providersMap = new Map();
    const timelineRegistradaMap = new Set();
    const { registrarEventoTimeline } = require('@/lib/timeline-helper');

    // Função auxiliar para carregar contexto da campanha
    async function carregarContextoCampanha(campId) {
      if (campanhasMap.has(campId)) {
        const cachedCamp = campanhasMap.get(campId);
        const cachedIsSms = String(cachedCamp?.canal || '').toLowerCase() === 'sms' ||
                            String(cachedCamp?.metadata?.provider || '').toUpperCase() === 'SMSDEV';
        return {
          campanha: cachedCamp,
          provider: providersMap.get(campId),
          contaSelecionada: contasMap.get(campId),
          isSms: cachedIsSms
        };
      }

      const { data: campanha, error: errCamp } = await supabase
        .from('communication_campaigns')
        .select('*, communication_templates(nome, idioma)')
        .eq('id', campId)
        .single();

      if (errCamp || !campanha) {
        throw new Error(`Campanha ${campId} não localizada.`);
      }

      const isSms = String(campanha.canal || '').toLowerCase() === 'sms' ||
                    String(campanha.metadata?.provider || '').toUpperCase() === 'SMSDEV';

      let contaSelecionada = null;
      let provider = null;

      // Se NÃO for SMS, busca a conta WhatsApp e instancia o provider correspondente
      if (!isSms) {
        const providerCampanha = String(campanha.metadata?.provider || '').toUpperCase();

        // Se a campanha possui provider explicitamente fixado no metadata (ex: WAFLY), busca a conta ativa correspondente
        if (providerCampanha) {
          const { data: contas } = await supabase
            .from('whatsapp_business_accounts')
            .select('*')
            .eq('tenant_id', campanha.tenant_id)
            .eq('status', 'ATIVO');
          contaSelecionada = (contas || []).find(c => String(c.provider || '').toUpperCase() === providerCampanha);
        }

        // Se não encontrou ou não foi fixado, utiliza a conta principal ativa do tenant (padrão META/YCLOUD/WABLAST)
        if (!contaSelecionada) {
          contaSelecionada = await buscarContaWhatsappPrincipal(supabase, { tenant_id: campanha.tenant_id });
        }

        if (!contaSelecionada) {
          throw new Error(`Credenciais de disparo de WhatsApp ausentes para este tenant (${campanha.tenant_id}).`);
        }

        const contaNormalizada = normalizarWhatsappAccount(contaSelecionada);
        const providerAccount = {
          ...contaSelecionada,
          ...contaNormalizada,
          accessToken: contaSelecionada.access_token || contaSelecionada.ycloud_api_key,
          ycloudApiKey: contaSelecionada.ycloud_api_key
        };

        provider = createWhatsAppProvider(providerAccount);
      }

      campanhasMap.set(campId, campanha);
      contasMap.set(campId, contaSelecionada);
      providersMap.set(campId, provider);

      // Se a campanha estava aguardando na fila, registra o início do processamento apenas 1x
      if (campanha.status === 'Na Fila' && !timelineRegistradaMap.has(campId)) {
        timelineRegistradaMap.add(campId);
        await registrarEventoTimeline(supabase, campanha.id, {
          tipo: 'Processamento iniciado',
          descricao: isSms
            ? 'O motor de disparos SMS iniciou o processamento em lote da fila de transmissão.'
            : 'O motor de disparos oficiais iniciou o processamento em lote da fila de transmissão.'
        });
      }

      return { campanha, provider, contaSelecionada, isSms };
    }

    let sucessos = 0;
    let falhas = 0;
    const campaignStats = new Map(); // campId => { sucessos: 0, falhas: 0 }

    // Processamento concorrente: estritamente 1 para WAFLY, e 5 para provedores oficiais (META/YCLOUD) e SMS
    const isLoteWafly = isCampanhaAlvoWafly || contemWafly;
    const CONCURRENCY_LIMIT = isLoteWafly ? 1 : 5;
    const itemsParaProcessar = itensReservados || [];

    for (let i = 0; i < itemsParaProcessar.length; i += CONCURRENCY_LIMIT) {
      const chunk = itemsParaProcessar.slice(i, i + CONCURRENCY_LIMIT);

      await Promise.all(
        chunk.map(async (item) => {
          try {
            const { campanha, provider, contaSelecionada, isSms } = await carregarContextoCampanha(item.campaign_id);

            // ─── RAMO SMS (SMSDEV) ──────────────────────────────────────────────────
            if (isSms) {
              const textoBase = item.variaveis_mapeadas?.mensagem_personalizada ||
                                item.variaveis_mapeadas?.mensagem_sms ||
                                campanha.metadata?.mensagem_sms ||
                                '';

              const textoMensagem = interpolarMensagemSms(textoBase, item);

              if (!textoMensagem) {
                throw new Error('Item de campanha SMS sem conteúdo de mensagem preenchido para envio.');
              }

              const referId = `t${campanha.tenant_id}_camp_${campanha.id}_item_${item.id}`;
              const destinatarioNome = item.variaveis_mapeadas?.nome || 'Contato';

              const resSms = await enviarNotificacaoSmsServico({
                supabase,
                usuarioOuTenant: campanha.tenant_id,
                telefone: item.contact_id,
                destinatarioNome,
                mensagem: textoMensagem,
                evento: 'campanha',
                referIdCustom: referId
              });

              if (resSms.success) {
                await supabase
                  .from('communication_campaign_items')
                  .update({
                    status: 'enviado',
                    provider_message_id: resSms.providerMessageId || null,
                    attempts: (item.attempts || 0) + 1,
                    finished_at: new Date().toISOString()
                  })
                  .eq('id', item.id);

                sucessos++;
                const stats = campaignStats.get(item.campaign_id) || { sucessos: 0, falhas: 0 };
                stats.sucessos++;
                campaignStats.set(item.campaign_id, stats);
                return;
              }

              // Se a falha foi por saldo insuficiente ou bloqueio de carteira
              if (resSms.status === 'saldo_insuficiente' || resSms.status === 'falha_reserva' || resSms.status === 'bloqueado_carteira') {
                await supabase
                  .from('communication_campaign_items')
                  .update({
                    status: 'falha',
                    attempts: (item.attempts || 0) + 1,
                    last_error: resSms.erro || 'Saldo de créditos SMS insuficiente no tenant',
                    finished_at: new Date().toISOString()
                  })
                  .eq('id', item.id);

                falhas++;
                const stats = campaignStats.get(item.campaign_id) || { sucessos: 0, falhas: 0 };
                stats.falhas++;
                campaignStats.set(item.campaign_id, stats);

                await registrarEventoTimeline(supabase, item.campaign_id, {
                  tipo: 'Falhas relevantes',
                  descricao: `Disparo interrompido para ${item.contact_id}: ${resSms.erro || 'Saldo de créditos SMS insuficiente'}`,
                  metadata: { contact_id: item.contact_id, erro: resSms.erro }
                });
                return;
              }

              // Se o resultado for incerto (timeout de rede/5xx), mantém em processamento para reconciliação DLR
              if (resSms.incerto || resSms.status === 'pendente') {
                await supabase
                  .from('communication_campaign_items')
                  .update({
                    status: 'processando',
                    attempts: (item.attempts || 0) + 1,
                    last_error: resSms.erro || 'Envio com resultado incerto, aguardando confirmação DLR'
                  })
                  .eq('id', item.id);
                return;
              }

              // Falha explícita / validação / rejeição do gateway
              await supabase
                .from('communication_campaign_items')
                .update({
                  status: 'falha',
                  attempts: (item.attempts || 0) + 1,
                  last_error: resSms.erro || 'Falha no disparo de SMS',
                  finished_at: new Date().toISOString()
                })
                .eq('id', item.id);

              falhas++;
              const stats = campaignStats.get(item.campaign_id) || { sucessos: 0, falhas: 0 };
              stats.falhas++;
              campaignStats.set(item.campaign_id, stats);

              await registrarEventoTimeline(supabase, item.campaign_id, {
                tipo: 'Falhas relevantes',
                descricao: `Erro ao enviar SMS para ${item.contact_id}: ${resSms.erro || 'Falha no envio'}`,
                metadata: { contact_id: item.contact_id, error: resSms.erro }
              });
              return;
            }

            // ─── RAMO WHATSAPP (OFICIAL & WAFLY) ──────────────────────────────────
            const isCampanhaWafly = String(campanha.metadata?.provider || contaSelecionada?.provider || '').toUpperCase() === 'WAFLY';
            const temMensagemPersonalizada = Boolean(item.variaveis_mapeadas?.mensagem_personalizada && String(item.variaveis_mapeadas.mensagem_personalizada).trim().length > 0);
            const isWaflyItem = isCampanhaWafly || temMensagemPersonalizada || item.template_id === 'wafly_variacoes';

            let wamid = null;
            let textoMensagem = '';

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

            // ─── RAMO WAFLY: CONSUMO DA MENSAGEM PERSONALIZADA (SEM TEMPLATE META) ───
            if (isWaflyItem) {
              textoMensagem = String(item.variaveis_mapeadas?.mensagem_personalizada || '').trim();

              if (!textoMensagem) {
                throw new Error('Item de campanha WAFLY sem mensagem_personalizada válida preenchida para envio.');
              }

              // Dispara texto livre diretamente via Wafly
              const resProvider = await provider.sendMessage({
                to: item.contact_id,
                recipient: item.contact_id,
                message: textoMensagem,
                text: textoMensagem
              });

              wamid = resProvider?.messageId || resProvider?.id || resProvider?.messages?.[0]?.id;
              if (!wamid) {
                throw new Error('Provedor WAFLY não retornou um Message ID válido após o envio.');
              }
            } else {
              // ─── RAMO OFICIAL (META / YCLOUD / WABLAST): TEMPLATES HSM ───
              const templateNome = campanha.communication_templates?.nome || item.template_id || 'default';
              const templateIdioma = String(campanha.communication_templates?.idioma || '').trim();

              if (!templateIdioma) {
                throw new Error(`Template oficial "${templateNome}" não possui idioma válido cadastrado em communication_templates.`);
              }

              const destinatarioNome = item.variaveis_mapeadas?.nome || 'Eleitor';

              // 5.1 Valida e monta dinamicamente os parâmetros do template (HEADER e BODY)
              const components = [];
              const headerImageUrl = item.variaveis_mapeadas?.header_image_url;

              if (headerImageUrl && typeof headerImageUrl === 'string' && headerImageUrl.trim().length > 0) {
                components.push({
                  type: 'header',
                  parameters: [
                    {
                      type: 'image',
                      image: {
                        link: headerImageUrl.trim()
                      }
                    }
                  ]
                });
              }

              const parameters = extrairEValidarParametrosTemplate(item.variaveis_mapeadas);
              if (parameters.length > 0) {
                components.push({
                  type: 'body',
                  parameters: parameters
                });
              }

              // 6. Executa disparo do template HSM via Provider Factory (Meta, WaBlast ou YCloud)
              const resProvider = await provider.sendTemplate({
                to: item.contact_id,
                recipient: item.contact_id,
                templateName: templateNome,
                idiomaCode: templateIdioma,
                components: components
              });

              wamid = resProvider?.messageId || resProvider?.id || resProvider?.messages?.[0]?.id;
              if (!wamid) {
                throw new Error('Provedor WhatsApp não retornou um Message ID (WAMID) válido após o envio.');
              }

              const textoParametros = parameters.map((p, idx) => `{{${idx + 1}}}=${p.text}`).join(', ');
              textoMensagem = textoParametros
                ? `[Disparo Oficial Template: ${templateNome}] ${textoParametros}`
                : `[Disparo Oficial Template: ${templateNome}] Olá ${destinatarioNome}`;
            }

            // 6.1 Registra a mensagem de saída na Central de Atendimento
            const realProvider = isWaflyItem ? 'WAFLY' : String(contaSelecionada?.provider || 'META').toUpperCase();
            await supabase
              .from('communication_messages')
              .insert({
                tenant_id: campanha.tenant_id,
                conversation_id: conversa.id,
                provider_message_id: wamid,
                provider: realProvider,
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

            // 7. Atualização SUCESSO: Altera status para 'enviado'
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

            sucessos++;
            const stats = campaignStats.get(item.campaign_id) || { sucessos: 0, falhas: 0 };
            stats.sucessos++;
            campaignStats.set(item.campaign_id, stats);
          } catch (err) {
            console.error(`[ProcessarFilaAPI] Falha no processamento do item ${item.id}:`, err.message);

            // 8. Registro de FALHA: Atualiza status do item
            await supabase
              .from('communication_campaign_items')
              .update({
                status: 'falha',
                attempts: (item.attempts || 0) + 1,
                last_error: err.message || 'Falha de transmissão na API',
                finished_at: new Date().toISOString()
              })
              .eq('id', item.id);

            await registrarEventoTimeline(supabase, item.campaign_id, {
              tipo: 'Falhas relevantes',
              descricao: `Erro ao enviar mensagem para ${item.contact_id}: ${err.message}`,
              metadata: { contact_id: item.contact_id, error: err.message }
            });

            falhas++;
            const stats = campaignStats.get(item.campaign_id) || { sucessos: 0, falhas: 0 };
            stats.falhas++;
            campaignStats.set(item.campaign_id, stats);
          }
        })
      );
    }

    // 8.1 Atualiza totalizadores das campanhas afetadas de forma consolidada
    for (const [campId, stats] of campaignStats.entries()) {
      const { data: campAtual } = await supabase
        .from('communication_campaigns')
        .select('total_enviadas, total_falhas')
        .eq('id', campId)
        .single();

      if (campAtual) {
        await supabase
          .from('communication_campaigns')
          .update({
            total_enviadas: (campAtual.total_enviadas || 0) + (stats.sucessos || 0),
            total_falhas: (campAtual.total_falhas || 0) + (stats.falhas || 0),
            status: 'Executando',
            updated_at: new Date().toISOString()
          })
          .eq('id', campId);
      }
    }

    // 9. Atualiza status final das campanhas que finalizaram seus envios
    const { data: campanhasVerificar } = await supabase
      .from('communication_campaigns')
      .select('id, total_destinatarios, total_enviadas, total_falhas')
      .in('status', ['Na Fila', 'Executando']);

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
