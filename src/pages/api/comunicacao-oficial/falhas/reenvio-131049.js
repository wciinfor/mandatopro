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

    // ─── GET: Selecionar destinatários com erro 131049 e aplicar política inteligente de elegibilidade ───
    if (req.method === 'GET') {
      // 1. Busca todas as falhas do tenant
      const { data: itensFalha, error: errItens } = await supabase
        .from('communication_campaign_items')
        .select(`
          id,
          campaign_id,
          tenant_id,
          contact_id,
          status,
          provider_message_id,
          error_code,
          error_message,
          last_error,
          created_at,
          finished_at,
          variaveis_mapeadas,
          communication_campaigns ( id, nome, status )
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
          error_code,
          error_message,
          last_error,
          created_at,
          finished_at,
          updated_at,
          variaveis_mapeadas,
          communication_campaigns ( id, nome, status )
        `)
        .eq('tenant_id', tenantId)
        .not('variaveis_mapeadas->origem_reenvio', 'is', null)
        .order('created_at', { ascending: true }); // do mais antigo para o mais recente

      if (errReenviados) console.warn('[ReenvioFalhasAPI] Aviso ao buscar histórico de reenvios:', errReenviados);

      // Agrupa todo o histórico de reenvios 131049 por contact_id
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

      // 3. Filtra e classifica os destinatários com falha original 131049
      const agora = new Date();
      const MS_HORA = 60 * 60 * 1000;

      const elegiveisBrutos = [];
      (itensFalha || []).forEach(item => {
        const erroNorm = resolverDetalhesFalhaMeta(item);
        if (erroNorm && String(erroNorm.errorCode) === '131049') {
          const cid = item.contact_id;
          const reenviosAnteriores = historicoPorContato.get(cid) || [];

          // Avalia o histórico de reenvios para este contato
          let numTentativasValidas = 0;
          let possuiSucesso = false;
          let possuiAtivo = false;
          let possuiFalhaDefinitiva = false;
          let possuiFalhaDesconhecida = false;
          let ultimaFalhaReenvio131049Date = null;
          let motivoBloqueioDetalhado = null;
          let erroDefinitivoCodigo = null;

          for (const reenvio of reenviosAnteriores) {
            const stItem = (reenvio.status || '').toLowerCase();
            const stCamp = (reenvio.communication_campaigns?.status || '').toLowerCase();

            // Se a campanha ou item foi cancelado sem envio, ignora esta tentativa no cômputo de bloqueio
            if (stItem === 'cancelado' || stItem === 'cancelada' || stCamp === 'cancelada' || stCamp === 'cancelado') {
              continue;
            }

            numTentativasValidas++;

            // Reenvio com Sucesso
            if (['enviado', 'enviada', 'entregue', 'lido', 'lida'].includes(stItem)) {
              possuiSucesso = true;
            }
            // Reenvio Ativo / Em Andamento
            else if (['pendente', 'processando', 'executando'].includes(stItem) || stCamp === 'na fila' || stCamp === 'executando') {
              possuiAtivo = true;
            }
            // Reenvio que Falhou
            else if (['falha', 'falhou'].includes(stItem)) {
              const errReenvio = resolverDetalhesFalhaMeta(reenvio);
              const codReenvioStr = errReenvio ? String(errReenvio.errorCode) : '';

              if (codReenvioStr === '131049') {
                const dtF = reenvio.finished_at || reenvio.updated_at || reenvio.created_at;
                ultimaFalhaReenvio131049Date = new Date(dtF);
              } else if (codReenvioStr === '131026') {
                possuiFalhaDefinitiva = true;
                erroDefinitivoCodigo = '131026';
                motivoBloqueioDetalhado = 'Falha permanente de entrega Meta (Erro 131026 - Número inviável/sem WhatsApp)';
              } else if (codReenvioStr) {
                // Outro erro Meta classificado como definitivo
                possuiFalhaDefinitiva = true;
                erroDefinitivoCodigo = codReenvioStr;
                motivoBloqueioDetalhado = `Falha definitiva Meta (Erro ${codReenvioStr})`;
              } else {
                // Erro não classificado / desconhecido
                possuiFalhaDesconhecida = true;
                motivoBloqueioDetalhado = 'Requer análise (Falha não classificada no reenvio anterior)';
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
            // Reenvio 1 falhou com 131049 -> Exige janela escalonada de 72h contadas da falha do reenvio
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
            // Primeira tentativa de reenvio (falha original) -> Exige janela padrão de 48h
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

          elegiveisBrutos.push({
            item_id: item.id,
            campaign_id: item.campaign_id,
            nome_campanha_original: item.communication_campaigns?.nome || `Campanha #${item.campaign_id}`,
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
          });
        }
      });

      // 4. Desduplica por contact_id mantendo a falha mais recente
      const mapaDesduplicado = new Map();
      elegiveisBrutos.forEach(item => {
        if (!mapaDesduplicado.has(item.contact_id)) {
          mapaDesduplicado.set(item.contact_id, item);
        }
      });

      const destinatariosTodos = Array.from(mapaDesduplicado.values());

      return res.status(200).json({
        success: true,
        total_destinatarios: destinatariosTodos.length,
        destinatarios: destinatariosTodos
      });
    }

    // ─── POST: Criar Audiência, Campanha e Itens para Reenvio 131049 ───────────────
    if (req.method === 'POST') {
      const { nome_campanha, template_nome, idioma, item_ids, header_image_url } = req.body || {};

      if (!Array.isArray(item_ids) || item_ids.length === 0) {
        return res.status(400).json({ success: false, message: 'Selecione ao menos um destinatário para o reenvio.' });
      }

      if (!nome_campanha || !template_nome) {
        return res.status(400).json({ success: false, message: 'Nome da campanha e template são obrigatórios.' });
      }

      // 1. RE-VALIDAÇÃO RIGOROSA NO BACKEND COM ISOLAMENTO DE TENANT
      const { data: itensValidados, error: errValida } = await supabase
        .from('communication_campaign_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('id', item_ids);

      if (errValida) throw errValida;

      if (!itensValidados || itensValidados.length === 0) {
        return res.status(403).json({ success: false, message: 'Nenhum item válido foi encontrado para este tenant.' });
      }

      // 2. Busca histórico completo de reenvios para aplicar a mesma política estrita no POST
      const { data: historicoReenviosPost } = await supabase
        .from('communication_campaign_items')
        .select(`
          id,
          campaign_id,
          contact_id,
          status,
          error_code,
          error_message,
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

      // 3. Re-calcula a elegibilidade estrita no backend
      const agora = new Date();
      const MS_HORA = 60 * 60 * 1000;
      const itensConfirmados = [];
      const mapaConfirmadosUnicos = new Map();

      for (const item of itensValidados) {
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

          // Verificação de Elegibilidade
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
          message: 'Nenhum dos destinatários selecionados é elegível para reenvio (verifique a janela de tempo 48h/72h, status ativo ou limite de 2 tentativas).'
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

      // 5. PASSO A: Criar a Audiência Especial em communication_audiences
      const { data: novaAudiencia, error: errAud } = await supabase
        .from('communication_audiences')
        .insert({
          tenant_id: tenantId,
          nome: `Reenvio 131049 - ${nome_campanha}`,
          regras: {
            origem: 'reenvio_falhas_meta_131049',
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

      // 6. PASSO B: Criar a Nova Campanha Derivada em communication_campaigns
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
            motivo_reenvio: 'Restrição de entrega por proteção de engajamento Meta (Frequency Cap)',
            politica_tentativas_max: 2
          }
        })
        .select('*')
        .single();

      if (errCamp) throw errCamp;

      // 7. PASSO C: Criar os Novos Itens da Fila em communication_campaign_items com RASTREABILIDADE COMPLETA
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
            campaign_origem_id: itemOrigem.campaign_id,
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
        descricao: `Campanha de reenvio criada com ${itensConfirmados.length} destinatários elegíveis recuperados de falhas Meta 131049.`,
        metadata: { total_destinatarios: itensConfirmados.length }
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


