import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterTenantId } from '@/lib/tenant';
import { resolverDetalhesFalhaMeta } from '@/lib/meta-errors';

/**
 * API REST para gerenciar a seleção e criação de reenvio exclusivo de falhas Meta 131049.
 * 
 * Endpoints:
 * - GET: Busca os destinatários com falha 131049 elegíveis para o tenant (desduplicados por contact_id, mais recente primeiro).
 * - POST: Executa a criação da Audiência Especial, da Nova Campanha Derivada e dos Novos Itens da Fila.
 */
export default async function handler(req, res) {
  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const tenantId = obterTenantId(usuario);
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Tenant não associado ao usuário autenticado.' });
    }

    // ─── GET: Listar Grupos por Campanha Original com estatísticas e itens classificados ───
    if (req.method === 'GET') {
      // 1. Busca todas as falhas do tenant com dados da campanha original
      const { data: itensFalha, error: errItens } = await supabase
        .from('communication_campaign_items')
        .select(`
          id,
          campaign_id,
          tenant_id,
          contact_id,
          status,
          provider_message_id,
          last_error,
          created_at,
          finished_at,
          variaveis_mapeadas,
          communication_campaigns ( id, nome, status, template_id, created_at )
        `)
        .eq('tenant_id', tenantId)
        .in('status', ['falha', 'falhou'])
        .order('finished_at', { ascending: false });

      if (errItens) throw errItens;

      // 2. Busca todo o histórico de tentativas prévias de reenvio efetuadas pelo tenant
      const { data: itensReenvioHistorico, error: errReenviados } = await supabase
        .from('communication_campaign_items')
        .select(`
          id,
          campaign_id,
          contact_id,
          status,
          last_error,
          created_at,
          finished_at,
          updated_at,
          variaveis_mapeadas,
          communication_campaigns ( id, nome, status )
        `)
        .eq('tenant_id', tenantId)
        .not('variaveis_mapeadas->origem_reenvio', 'is', null)
        .order('created_at', { ascending: true });

      if (errReenviados) console.warn('[ReenvioFalhasAPI] Aviso ao buscar histórico de reenvios:', errReenviados);

      // Agrupa o histórico de reenvios 131049 por contact_id
      const historicoPorContato = new Map();
      (itensReenvioHistorico || []).forEach(itemReenvio => {
        const vm = itemReenvio.variaveis_mapeadas || {};
        if (vm.origem_reenvio === 'meta_131049') {
          const cid = itemReenvio.contact_id;
          if (!historicoPorContato.has(cid)) {
            historicoPorContato.set(cid, []);
          }
          historicoPorContato.get(cid).push(itemReenvio);
        }
      });

      // 3. Mapeia em lote os dados cadastrais de todas as Campanhas Raiz necessárias
      const idsCampanhasRaiz = new Set();
      (itensFalha || []).forEach(item => {
        const erroNorm = resolverDetalhesFalhaMeta(item);
        if (erroNorm && String(erroNorm.errorCode) === '131049') {
          const campaignRaizId = item.variaveis_mapeadas?.campaign_origem_id
            ? Number(item.variaveis_mapeadas.campaign_origem_id)
            : Number(item.campaign_id);
          idsCampanhasRaiz.add(campaignRaizId);
        }
      });

      const mapaCampanhasRaiz = new Map();
      if (idsCampanhasRaiz.size > 0) {
        const { data: dadosCampanhasRaiz, error: errCampRaiz } = await supabase
          .from('communication_campaigns')
          .select('id, nome, status, template_id, created_at')
          .in('id', Array.from(idsCampanhasRaiz))
          .eq('tenant_id', tenantId);

        if (!errCampRaiz && dadosCampanhasRaiz) {
          dadosCampanhasRaiz.forEach(c => mapaCampanhasRaiz.set(Number(c.id), c));
        }
      }

      // 4. Processa e agrupa os destinatários exclusivamente por campaignRaizId
      const agora = new Date();
      const MS_HORA = 60 * 60 * 1000;
      const gruposCampanhasMap = new Map();

      (itensFalha || []).forEach(item => {
        const erroNorm = resolverDetalhesFalhaMeta(item);
        if (erroNorm && String(erroNorm.errorCode) === '131049') {
          const campaignRaizId = item.variaveis_mapeadas?.campaign_origem_id
            ? Number(item.variaveis_mapeadas.campaign_origem_id)
            : Number(item.campaign_id);

          const cid = item.contact_id;
          const reenviosAnteriores = historicoPorContato.get(cid) || [];

          // Avalia histórico do contato
          let numTentativasValidas = 0;
          let possuiSucesso = false;
          let possuiAtivo = false;
          let possuiFalhaDefinitiva = false;
          let possuiFalhaDesconhecida = false;
          let ultimaFalhaReenvio131049Date = null;
          let motivoBloqueioDetalhado = null;

          for (const reenvio of reenviosAnteriores) {
            const stItem = (reenvio.status || '').toLowerCase();
            const stCamp = (reenvio.communication_campaigns?.status || '').toLowerCase();

            if (stItem === 'cancelado' || stItem === 'cancelada' || stCamp === 'cancelada' || stCamp === 'cancelado') {
              continue;
            }

            numTentativasValidas++;

            if (['enviado', 'enviada', 'entregue', 'lido', 'lida'].includes(stItem)) {
              possuiSucesso = true;
            } else if (['pendente', 'processando', 'executando'].includes(stItem) || stCamp === 'na fila' || stCamp === 'executando') {
              possuiAtivo = true;
            } else if (['falha', 'falhou'].includes(stItem)) {
              const errR = resolverDetalhesFalhaMeta(reenvio);
              const codRStr = errR ? String(errR.errorCode) : '';

              if (codRStr === '131049') {
                const dtF = reenvio.finished_at || reenvio.updated_at || reenvio.created_at;
                ultimaFalhaReenvio131049Date = new Date(dtF);
              } else if (codRStr === '131026' || codRStr) {
                possuiFalhaDefinitiva = true;
              } else {
                possuiFalhaDesconhecida = true;
              }
            }
          }

          // Tomada de Decisão Operacional
          const dataFalhaOrigStr = item.finished_at || item.created_at;
          const dataFalhaOrig = new Date(dataFalhaOrigStr);

          let statusElegibilidade = 'Elegível para reenvio';
          let atendeJanela = false;
          let jaReenviado = false;
          let podeSelecionar = false;
          let proximaElegibilidadeDate = null;
          let proximaTentativaNumero = numTentativasValidas + 1;

          if (possuiSucesso) {
            statusElegibilidade = 'Concluído com sucesso';
            jaReenviado = true;
            motivoBloqueioDetalhado = 'Mensagem já entregue com sucesso em tentativa anterior.';
          } else if (possuiAtivo) {
            statusElegibilidade = 'Reenvio em andamento';
            jaReenviado = true;
            motivoBloqueioDetalhado = 'Existe um lote de reenvio em processamento para este contato.';
          } else if (possuiFalhaDefinitiva) {
            statusElegibilidade = 'Bloqueado definitivamente';
            jaReenviado = true;
          } else if (possuiFalhaDesconhecida) {
            statusElegibilidade = 'Requer análise';
            jaReenviado = true;
          } else if (numTentativasValidas >= 2) {
            statusElegibilidade = 'Máximo de tentativas atingido';
            jaReenviado = true;
            motivoBloqueioDetalhado = 'Limite máximo de 2 tentativas de reenvio atingido.';
          } else if (numTentativasValidas === 1 && ultimaFalhaReenvio131049Date) {
            const msPassados = agora.getTime() - ultimaFalhaReenvio131049Date.getTime();
            const horasPassadas = msPassados / MS_HORA;
            proximaElegibilidadeDate = new Date(ultimaFalhaReenvio131049Date.getTime() + (72 * MS_HORA));

            if (horasPassadas >= 72) {
              statusElegibilidade = 'Elegível para 2ª tentativa';
              atendeJanela = true;
              podeSelecionar = true;
            } else {
              statusElegibilidade = 'Aguardando 72h (2ª tentativa)';
              atendeJanela = false;
              podeSelecionar = false;
            }
          } else {
            const msPassados = agora.getTime() - dataFalhaOrig.getTime();
            const horasPassadas = msPassados / MS_HORA;
            proximaElegibilidadeDate = new Date(dataFalhaOrig.getTime() + (48 * MS_HORA));

            if (horasPassadas >= 48) {
              statusElegibilidade = 'Elegível agora';
              atendeJanela = true;
              podeSelecionar = true;
            } else {
              statusElegibilidade = 'Aguardando 48h';
              atendeJanela = false;
              podeSelecionar = false;
            }
          }

          // Dados cadastrais da campanha raiz original
          const dadosRaiz = mapaCampanhasRaiz.get(campaignRaizId) || (
            campaignRaizId === Number(item.campaign_id) ? item.communication_campaigns : null
          );
          const nomeCampanhaOriginal = dadosRaiz?.nome || `Campanha #${campaignRaizId}`;
          const dataCampanhaOriginal = dadosRaiz?.created_at || dataFalhaOrigStr;
          const templateCampanhaOriginal = dadosRaiz?.template_id || item.variaveis_mapeadas?.template_id || 'modelo_institucional01';

          const itemClassificado = {
            item_id: item.id,
            campaign_id: item.campaign_id,
            campaign_origem_id: campaignRaizId,
            nome_campanha_original: nomeCampanhaOriginal,
            tenant_id: item.tenant_id,
            contact_id: item.contact_id,
            nome: item.variaveis_mapeadas?.nome || 'Contato',
            telefone: item.contact_id,
            eleitor_id: item.variaveis_mapeadas?.eleitor_id || null,
            data_falha: dataFalhaOrigStr,
            elegivel_em: proximaElegibilidadeDate ? proximaElegibilidadeDate.toISOString() : null,
            status_elegibilidade: statusElegibilidade,
            atende_janela: atendeJanela,
            pode_selecionar: podeSelecionar,
            ja_reenviado: jaReenviado,
            num_tentativas_validas: numTentativasValidas,
            proxima_tentativa_numero: proximaTentativaNumero,
            motivo_bloqueio_detalhado: motivoBloqueioDetalhado,
            error_code: erroNorm.errorCode,
            error_message: erroNorm.errorMessage,
            classificacao: erroNorm.classificacaoAmigavel,
            variaveis_mapeadas: item.variaveis_mapeadas || {}
          };

          // Inicializa grupo da Campanha Raiz se não existir
          if (!gruposCampanhasMap.has(campaignRaizId)) {
            gruposCampanhasMap.set(campaignRaizId, {
              campaign_id: campaignRaizId,
              nome_campanha: nomeCampanhaOriginal,
              data_campanha: dataCampanhaOriginal,
              template_id: templateCampanhaOriginal,
              total_falhas_131049: 0,
              total_elegiveis_agora: 0,
              total_aguardando_janela: 0,
              total_bloqueados_concluidos: 0,
              destinatarios_map: new Map() // para desduplicar dentro da própria campanha raiz
            });
          }

          const grupo = gruposCampanhasMap.get(campaignRaizId);
          if (!grupo.destinatarios_map.has(cid)) {
            grupo.destinatarios_map.set(cid, itemClassificado);
            grupo.total_falhas_131049++;

            if (podeSelecionar) grupo.total_elegiveis_agora++;
            else if (!jaReenviado && !atendeJanela) grupo.total_aguardando_janela++;
            else grupo.total_bloqueados_concluidos++;
          }
        }
      });

      // Formata lista final de grupos
      const grupos = Array.from(gruposCampanhasMap.values()).map(g => ({
        campaign_id: g.campaign_id,
        nome_campanha: g.nome_campanha,
        data_campanha: g.data_campanha,
        template_id: g.template_id,
        total_falhas_131049: g.total_falhas_131049,
        total_elegiveis_agora: g.total_elegiveis_agora,
        total_aguardando_janela: g.total_aguardando_janela,
        total_bloqueados_concluidos: g.total_bloqueados_concluidos,
        destinatarios: Array.from(g.destinatarios_map.values())
      }));

      return res.status(200).json({
        success: true,
        total_grupos: grupos.length,
        grupos
      });
    }

    // ─── POST: Criar Audiência, Campanha Derivada e Novos Itens por Campanha Original ───
    if (req.method === 'POST') {
      const { campaign_origem_id, nome_campanha, template_nome, idioma, item_ids, contatos_removidos, header_image_url } = req.body || {};

      if (!campaign_origem_id) {
        return res.status(400).json({ success: false, message: 'O ID da campanha original é obrigatório para o reenvio.' });
      }

      if (!Array.isArray(item_ids) || item_ids.length === 0) {
        return res.status(400).json({ success: false, message: 'Selecione ao menos um destinatário para o reenvio.' });
      }

      if (!nome_campanha || !template_nome) {
        return res.status(400).json({ success: false, message: 'Nome da campanha e template são obrigatórios.' });
      }

      const setRemovidosManualmente = new Set((contatos_removidos || []).map(id => Number(id)));

      // 1. RE-VALIDAÇÃO RIGOROSA NO BACKEND COM ISOLAMENTO DE TENANT E CAMPANHA ORIGEM (RAIZ)
      const { data: itensValidados, error: errValida } = await supabase
        .from('communication_campaign_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('id', item_ids);

      if (errValida) throw errValida;

      if (!itensValidados || itensValidados.length === 0) {
        return res.status(403).json({ success: false, message: 'Nenhum item válido foi encontrado para esta campanha e tenant.' });
      }

      // 2. Busca histórico completo de reenvios do tenant
      const { data: historicoReenviosPost } = await supabase
        .from('communication_campaign_items')
        .select(`
          id,
          campaign_id,
          contact_id,
          status,
          last_error,
          created_at,
          finished_at,
          updated_at,
          variaveis_mapeadas,
          communication_campaigns ( id, status )
        `)
        .eq('tenant_id', tenantId)
        .not('variaveis_mapeadas->origem_reenvio', 'is', null)
        .order('created_at', { ascending: true });

      const historicoPostMap = new Map();
      (historicoReenviosPost || []).forEach(ir => {
        const vm = ir.variaveis_mapeadas || {};
        if (vm.origem_reenvio === 'meta_131049') {
          const cid = ir.contact_id;
          if (!historicoPostMap.has(cid)) historicoPostMap.set(cid, []);
          historicoPostMap.get(cid).push(ir);
        }
      });

      // 3. Re-calcula elegibilidade no backend e exclui contatos removidos manualmente
      const agora = new Date();
      const MS_HORA = 60 * 60 * 1000;
      const itensConfirmados = [];
      const mapaConfirmadosUnicos = new Map();

      for (const item of itensValidados) {
        // Valida se o item pertence à campanha raiz informada
        const itemCampRaizId = item.variaveis_mapeadas?.campaign_origem_id
          ? Number(item.variaveis_mapeadas.campaign_origem_id)
          : Number(item.campaign_id);

        if (itemCampRaizId !== Number(campaign_origem_id)) {
          continue;
        }

        // Se o item foi marcado para remoção manual, desconsidera totalmente
        if (setRemovidosManualmente.has(item.id)) {
          continue;
        }

        const erroNorm = resolverDetalhesFalhaMeta(item);
        if (erroNorm && String(erroNorm.errorCode) === '131049') {
          const cid = item.contact_id;
          const reenviosAnteriores = historicoPostMap.get(cid) || [];

          let numTentativasValidas = 0;
          let possuiSucesso = false;
          let possuiAtivo = false;
          let possuiFalhaDefinitiva = false;
          let possuiFalhaDesconhecida = false;
          let ultimaFalhaReenvio131049Date = null;

          for (const reenvio of reenviosAnteriores) {
            const stItem = (reenvio.status || '').toLowerCase();
            const stCamp = (reenvio.communication_campaigns?.status || '').toLowerCase();

            if (stItem === 'cancelado' || stItem === 'cancelada' || stCamp === 'cancelada' || stCamp === 'cancelado') {
              continue;
            }

            numTentativasValidas++;

            if (['enviado', 'enviada', 'entregue', 'lido', 'lida'].includes(stItem)) {
              possuiSucesso = true;
            } else if (['pendente', 'processando', 'executando'].includes(stItem) || stCamp === 'na fila' || stCamp === 'executando') {
              possuiAtivo = true;
            } else if (['falha', 'falhou'].includes(stItem)) {
              const errR = resolverDetalhesFalhaMeta(reenvio);
              const codRStr = errR ? String(errR.errorCode) : '';

              if (codRStr === '131049') {
                const dtF = reenvio.finished_at || reenvio.updated_at || reenvio.created_at;
                ultimaFalhaReenvio131049Date = new Date(dtF);
              } else if (codRStr === '131026' || codRStr) {
                possuiFalhaDefinitiva = true;
              } else {
                possuiFalhaDesconhecida = true;
              }
            }
          }

          let elegivelAgora = false;
          let proximaTentativa = numTentativasValidas + 1;

          if (!possuiSucesso && !possuiAtivo && !possuiFalhaDefinitiva && !possuiFalhaDesconhecida && numTentativasValidas < 2) {
            if (numTentativasValidas === 1 && ultimaFalhaReenvio131049Date) {
              const horasPassadas = (agora.getTime() - ultimaFalhaReenvio131049Date.getTime()) / MS_HORA;
              if (horasPassadas >= 72) elegivelAgora = true;
            } else if (numTentativasValidas === 0) {
              const dtOrig = new Date(item.finished_at || item.created_at);
              const horasPassadas = (agora.getTime() - dtOrig.getTime()) / MS_HORA;
              if (horasPassadas >= 48) elegivelAgora = true;
            }
          }

          if (elegivelAgora) {
            if (!mapaConfirmadosUnicos.has(cid)) {
              mapaConfirmadosUnicos.set(cid, { item, proximaTentativa });
              itensConfirmados.push({ item, proximaTentativa });
            }
          }
        }
      }

      if (itensConfirmados.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Nenhum dos destinatários selecionados é elegível para reenvio ou todos foram removidos manualmente.'
        });
      }

      // 4. Resolve ou cria o template em communication_templates
      let templateId = null;
      const { data: tmpl } = await supabase
        .from('communication_templates')
        .select('id')
        .eq('nome', template_nome)
        .maybeSingle();

      if (tmpl) {
        templateId = tmpl.id;
      } else {
        const { data: novoTmpl } = await supabase
          .from('communication_templates')
          .insert({
            tenant_id: tenantId,
            nome: template_nome,
            categoria: 'MARKETING',
            idioma: idioma || 'pt_BR',
            status: 'APPROVED',
            canal: 'whatsapp'
          })
          .select('id')
          .single();

        if (novoTmpl) templateId = novoTmpl.id;
      }

      // 5. PASSO A: Criar Audiência Especial vinculada à Campanha Original
      const { data: novaAudiencia, error: errAud } = await supabase
        .from('communication_audiences')
        .insert({
          tenant_id: tenantId,
          nome: `Reenvio 131049 - Campanha #${campaign_origem_id} (${nome_campanha})`,
          regras: {
            origem: 'reenvio_falhas_meta_131049',
            campaign_origem_id: campaign_origem_id,
            filtros: {
              codigo_erro: '131049',
              descricao: 'Restrição de entrega por proteção de engajamento Meta',
              politica_tentativas_max: 2
            },
            quantidade_destinatarios: itensConfirmados.length
          }
        })
        .select('id')
        .single();

      if (errAud) throw errAud;

      // 6. PASSO B: Criar Nova Campanha Derivada
      const { data: novaCampanha, error: errCamp } = await supabase
        .from('communication_campaigns')
        .insert({
          tenant_id: tenantId,
          nome: nome_campanha,
          canal: 'whatsapp',
          status: 'Na Fila',
          template_id: templateId,
          audience_id: novaAudiencia.id,
          total_destinatarios: itensConfirmados.length,
          metadata: {
            tipo_lote: 'reenvio_falhas',
            origem: 'meta_131049',
            campaign_origem_id: campaign_origem_id,
            motivo_reenvio: 'Restrição de entrega por proteção de engajamento Meta (Frequency Cap)',
            politica_tentativas_max: 2
          }
        })
        .select('*')
        .single();

      if (errCamp) throw errCamp;

      // 7. PASSO C: Criar Novos Itens da Fila com RASTREABILIDADE TOTAL DO GRUPO ORIGEM
      const novosItensPayload = itensConfirmados.map(({ item: itemOrigem, proximaTentativa }) => {
        const varOriginais = itemOrigem.variaveis_mapeadas || {};
        const dataFalhaStr = itemOrigem.finished_at || itemOrigem.created_at;
        const dataFalha = new Date(dataFalhaStr);
        const janelaHoras = proximaTentativa === 2 ? 72 : 48;
        const dataElegivel = new Date(dataFalha.getTime() + (janelaHoras * MS_HORA));

        return {
          tenant_id: tenantId,
          campaign_id: novaCampanha.id,
          contact_id: itemOrigem.contact_id,
          template_id: template_nome,
          status: 'pendente',
          variaveis_mapeadas: {
            ...varOriginais,
            ...(header_image_url ? { header_image_url } : {}),
            origem_reenvio: 'meta_131049',
            item_origem_falha_id: itemOrigem.id,
            campaign_origem_id: campaign_origem_id,
            data_falha_original: dataFalhaStr,
            data_elegibilidade: dataElegivel.toISOString(),
            tentativa_reenvio_acumuladas: proximaTentativa,
            campaign_reenvio_gerada_id: novaCampanha.id
          }
        };
      });

      const { error: errInsItens } = await supabase
        .from('communication_campaign_items')
        .insert(novosItensPayload);

      if (errInsItens) throw errInsItens;

      // 8. Registra evento na Timeline
      const { registrarEventoTimeline } = require('@/lib/timeline-helper');
      await registrarEventoTimeline(supabase, novaCampanha.id, {
        tipo: 'Reenvio de falhas 131049 inicializado',
        descricao: `Campanha derivada da Campanha #${campaign_origem_id} criada com ${itensConfirmados.length} destinatários elegíveis.`,
        metadata: { campaign_origem_id, total_destinatarios: itensConfirmados.length }
      });

      return res.status(200).json({
        success: true,
        campanha: novaCampanha,
        total_processados: itensConfirmados.length
      });
    }

    return res.status(405).json({ success: false, message: 'Método não permitido.' });
  } catch (error) {
    console.error('[ReenvioFalhasAPI] Erro ao processar:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || 'Erro interno no servidor ao processar reenvio de falhas.'
    });
  }
}



