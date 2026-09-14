import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterTenantId } from '@/lib/tenant';

/**
 * Normaliza e valida a lista de variações de mensagem para campanhas WAFLY.
 * Suporta array de strings ou array de objetos { texto | mensagem | text }.
 * Remove mensagens vazias, aplica trim e valida limites (mínimo 1, máximo 5).
 */
function sanitizarVariacoesMensagem(rawVariacoes) {
  if (rawVariacoes === undefined || rawVariacoes === null) {
    return [];
  }

  if (!Array.isArray(rawVariacoes)) {
    const err = new Error('O campo variacoes_mensagem deve ser uma lista (array).');
    err.statusCode = 400;
    throw err;
  }

  if (rawVariacoes.length > 5) {
    const err = new Error('O limite máximo é de 5 variações de mensagem por campanha.');
    err.statusCode = 400;
    throw err;
  }

  const validadas = [];
  for (let i = 0; i < rawVariacoes.length; i++) {
    const item = rawVariacoes[i];
    let texto = '';

    if (typeof item === 'string') {
      texto = item.trim();
    } else if (item && typeof item === 'object' && !Array.isArray(item)) {
      if (typeof item.texto === 'string') texto = item.texto.trim();
      else if (typeof item.mensagem === 'string') texto = item.mensagem.trim();
      else if (typeof item.text === 'string') texto = item.text.trim();
      else {
        const err = new Error(`A variação de mensagem na posição ${i + 1} possui formato inválido. Deve ser um texto.`);
        err.statusCode = 400;
        throw err;
      }
    } else {
      const err = new Error(`A variação de mensagem na posição ${i + 1} possui formato inválido. Deve ser um texto.`);
      err.statusCode = 400;
      throw err;
    }

    if (texto.length > 0) {
      validadas.push({
        id: validadas.length + 1,
        texto
      });
    }
  }

  if (rawVariacoes.length > 0 && validadas.length === 0) {
    const err = new Error('Nenhuma variação de mensagem válida foi informada (todas as mensagens enviadas estavam vazias).');
    err.statusCode = 400;
    throw err;
  }

  if (validadas.length > 5) {
    const err = new Error('O limite máximo é de 5 variações de mensagem por campanha.');
    err.statusCode = 400;
    throw err;
  }

  return validadas;
}

/**
 * Personaliza o texto da mensagem com as tags {nome} e {cidade}, sem inventar dados inexistentes.
 */
function personalizarMensagem(textoBase, contato, variaveisConfig = {}) {
  let msg = String(textoBase || '');
  const nomeContato = String(contato?.nome || variaveisConfig?.nome || '').trim();
  const cidadeContato = String(contato?.cidade || contato?.municipio || variaveisConfig?.cidade || '').trim();

  if (nomeContato) {
    msg = msg.replace(/\{nome\}/gi, nomeContato);
  } else {
    msg = msg.replace(/\{nome\}/gi, 'Contato');
  }

  if (cidadeContato) {
    msg = msg.replace(/\{cidade\}/gi, cidadeContato);
  } else {
    // Se não há cidade informada, remove a tag e normaliza espaços
    msg = msg.replace(/\{cidade\}/gi, '').replace(/\s{2,}/g, ' ');
  }

  return msg.trim();
}

/**
 * API Handler para criar e persistir a Comunicação Oficial na tabela communication_campaigns.
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const supabase = createServerClient();
      const { usuario } = await obterUsuarioAutenticado(req, supabase);
      exigirUsuario(usuario);

      const tenantId = obterTenantId(usuario);
      if (!tenantId) {
        return res.status(403).json({ error: 'Tenant não associado ao usuário autenticado.' });
      }

      const { data: campanhas, error } = await supabase
        .from('communication_campaigns')
        .select('*, communication_templates(nome), communication_audiences(nome)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Mapeia campanhas com seus contadores
      const formatadas = await Promise.all((campanhas || []).map(async (c) => {
        const { data: itens } = await supabase
          .from('communication_campaign_items')
          .select('status')
          .eq('campaign_id', c.id);

        let enviadas = 0;
        let entregues = 0;
        let lidas = 0;
        let falhas = 0;

        (itens || []).forEach(i => {
          if (i.status === 'enviado') enviadas++;
          if (i.status === 'entregue') { entregues++; enviadas++; }
          if (i.status === 'lida') { lidas++; entregues++; enviadas++; }
          if (i.status === 'falha') falhas++;
        });

        return {
          id: c.id,
          nome: c.nome,
          canal: c.canal || 'whatsapp',
          template: c.communication_templates?.nome || (c.metadata?.provider === 'WAFLY' ? 'Variações WAFLY' : 'Informativo'),
          publico: c.communication_audiences?.nome || 'Destinatários',
          status: c.status,
          agendamento: c.agendado_para,
          total_destinatarios: c.total_destinatarios || (itens || []).length || 0,
          enviadas,
          entregues,
          lidas,
          falhas,
          created_at: c.created_at,
          metadata: c.metadata || {}
        };
      }));

      return res.status(200).json(formatadas);
    } catch (err) {
      console.error('[SalvarComunicacaoAPI GET] Erro ao listar campanhas:', err);
      return res.status(500).json({ error: err.message || 'Erro ao listar comunicações oficiais' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const body = req.body || {};

    const tenantId = obterTenantId(usuario);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant não associado ao usuário autenticado.' });
    }

    // 0. PRE-VALIDAÇÃO RIGOROSA: Garante que existam destinatários válidos ANTES de persistir qualquer registro no banco
    const destinatariosBrutos = Array.isArray(body.destinatarios) ? body.destinatarios : [];
    const destinatariosValidos = destinatariosBrutos.filter(d => {
      if (!d) return false;
      const tel = String(d.telefone_limpo || d.telefone_original || '').replace(/\D/g, '');
      return tel.length >= 8;
    });

    if (destinatariosValidos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'É necessário incluir ao menos um destinatário válido para criar o disparo.'
      });
    }

    const totalDestinatariosReal = destinatariosValidos.length;

    // 0.1 RESOLUÇÃO E VALIDAÇÃO SEGURA DO PROVIDER
    const { data: contasTenant } = await supabase
      .from('whatsapp_business_accounts')
      .select('id, provider, principal, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'ATIVO');

    const providerDesejado = body.provider ? String(body.provider).toUpperCase().trim() : null;

    // Valida se o provider requisitado realmente existe e está ativo para o tenant (segurança contra input cego)
    let contaResolvida = null;
    if (providerDesejado) {
      contaResolvida = (contasTenant || []).find(c => String(c.provider || '').toUpperCase() === providerDesejado);
    }

    // Se não informou provider explicitamente ou o informado não é válido para o tenant, adota a conta principal ativa
    if (!contaResolvida) {
      contaResolvida = (contasTenant || []).find(c => c.principal) || (contasTenant || [])[0] || null;
    }

    const providerResolvido = String(contaResolvida?.provider || 'META').toUpperCase();
    const isWafly = providerResolvido === 'WAFLY';

    // 0.2 PROCESSAMENTO E VALIDAÇÃO DAS VARIAÇÕES DE MENSAGEM
    const rawVariacoes = body.variacoes_mensagem ?? body.variacoesMensagem ?? body.variacoes;
    const variacoesValidadas = sanitizarVariacoesMensagem(rawVariacoes);

    if (isWafly) {
      // Se for WAFLY com mensagem livre (sem template informado), exige de 1 a 5 variações
      if (!body.template && variacoesValidadas.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Para campanhas WAFLY com mensagem livre, é obrigatório informar de 1 a 5 variações de mensagem.'
        });
      }
    }

    // 1. Busca ou cria um template_id correspondente ao template_nome da Meta
    let templateId = null;
    if (body.template) {
      const { data: tmpl, error: errTmpl } = await supabase
        .from('communication_templates')
        .select('id')
        .eq('nome', body.template)
        .maybeSingle();

      if (tmpl) {
        templateId = tmpl.id;
      } else {
        // Cria um registro de template temporário oficial no Supabase para satisfazer FK
        const { data: novoTmpl, error: errCriaTmpl } = await supabase
          .from('communication_templates')
          .insert({
            tenant_id: tenantId,
            nome: body.template,
            categoria: 'MARKETING',
            idioma: body.idioma || 'pt_BR',
            status: 'APPROVED',
            canal: 'whatsapp'
          })
          .select('id')
          .single();

        if (!errCriaTmpl && novoTmpl) {
          templateId = novoTmpl.id;
        }
      }
    }

    // 2. Reutiliza audiência existente ou cria uma nova se não informada
    let audienceId = body.audience_id ? Number(body.audience_id) : null;

    if (audienceId) {
      // Valida explicitamente se a audiência pertence ao tenant autenticado
      const { data: audExistente, error: errValidaAud } = await supabase
        .from('communication_audiences')
        .select('id, tenant_id')
        .eq('id', audienceId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (errValidaAud || !audExistente) {
        return res.status(403).json({
          success: false,
          message: 'Público / Audiência informada não existe ou não pertence a este tenant.'
        });
      }
    } else {
      // Cria uma audiência correspondente na tabela communication_audiences para o disparo
      const { data: novaAud, error: errAud } = await supabase
        .from('communication_audiences')
        .insert({
          tenant_id: tenantId,
          nome: body.publico || 'Público da Comunicação',
          regras: {
            origem: body.origemDestinatarios,
            crm_campaign_id: body.campaign_id || null,
            filtros: body.filtros || {},
            quantidade_destinatarios: totalDestinatariosReal
          }
        })
        .select('id')
        .single();

      if (!errAud && novaAud) {
        audienceId = novaAud.id;
      }
    }

    // 3. Monta metadata estruturado (fixando provider e regras WAFLY somente quando aplicável)
    let metadataFinal = {};
    if (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) {
      metadataFinal = { ...body.metadata };
    }

    if (isWafly) {
      metadataFinal = {
        ...metadataFinal,
        provider: 'WAFLY',
        regras_envio: {
          intervalo_min: 20,
          intervalo_max: 40
        },
        variacoes_mensagem: variacoesValidadas
      };
    }

    // 3.1 Persiste a comunicação na tabela principal de campanhas de disparos (communication_campaigns)
    const { data: campanhaCriada, error: errCamp } = await supabase
      .from('communication_campaigns')
      .insert({
        tenant_id: tenantId,
        nome: body.nome,
        canal: body.canal || 'whatsapp',
        status: body.agendamento ? 'agendado' : 'Na Fila',
        template_id: templateId,
        audience_id: audienceId,
        total_destinatarios: totalDestinatariosReal,
        agendado_para: body.agendamento || null,
        metadata: metadataFinal
      })
      .select('*')
      .single();

    if (errCamp) throw errCamp;

    // 4. Insere em lote na fila de disparos (communication_campaign_items) com distribuição determinística
    const variaveisConfig = (body.variaveis && typeof body.variaveis === 'object' && !Array.isArray(body.variaveis))
      ? body.variaveis
      : {};
    const temVariacoesWafly = isWafly && variacoesValidadas.length > 0;
    const K = variacoesValidadas.length;

    const itemsPayload = destinatariosValidos.map((d, index) => {
      // 4.1 Preserva integralmente todas as variáveis existentes
      const variaveisMapeadas = {
        nome: d.nome || 'Contato',
        eleitor_id: body.origemDestinatarios === 'campanha_politica' ? (d.id || null) : null,
        header_image_url: body.header_image_url || null,
        ...(d.cidade ? { cidade: d.cidade } : {}),
        ...(d.bairro ? { bairro: d.bairro } : {}),
        ...variaveisConfig
      };

      // 4.2 Para WAFLY com variações: aplica distribuição determinística (index % K) e personalização segura
      if (temVariacoesWafly) {
        const variacaoIndex = index % K;
        const variacao = variacoesValidadas[variacaoIndex];
        const mensagemPersonalizada = personalizarMensagem(variacao.texto, d, variaveisConfig);

        variaveisMapeadas.variacao_id = variacao.id;
        variaveisMapeadas.mensagem_personalizada = mensagemPersonalizada;
      }

      return {
        tenant_id: tenantId,
        campaign_id: campanhaCriada.id,
        contact_id: String(d.telefone_limpo || d.telefone_original).replace(/\D/g, ''),
        template_id: body.template || (temVariacoesWafly ? 'wafly_variacoes' : 'default'),
        status: 'pendente',
        variaveis_mapeadas: variaveisMapeadas
      };
    });

    const { error: errItems } = await supabase
      .from('communication_campaign_items')
      .insert(itemsPayload);

    if (errItems) {
      console.error('[SalvarComunicacaoAPI] Erro ao popular communication_campaign_items:', errItems);
      // Remove a campanha parcial caso falhe a inserção dos itens
      await supabase.from('communication_campaigns').delete().eq('id', campanhaCriada.id);
      throw errItems;
    }

    // 5. Registra o evento de criação da comunicação na Timeline
    const { registrarEventoTimeline } = require('@/lib/timeline-helper');
    await registrarEventoTimeline(supabase, campanhaCriada.id, {
      tipo: 'Comunicação criada',
      descricao: `A comunicação oficial de disparos "${campanhaCriada.nome}" foi inicializada na base de dados com ${body.total_destinatarios || 0} destinatários.`,
      metadata: {
        total_destinatarios: body.total_destinatarios,
        provider: providerResolvido,
        variacoes_count: temVariacoesWafly ? K : 0
      }
    });

    if (body.agendamento) {
      await registrarEventoTimeline(supabase, campanhaCriada.id, {
        tipo: 'Comunicação agendada',
        descricao: `Disparos agendados para execução futura em ${new Date(body.agendamento).toLocaleString('pt-BR')}.`,
        metadata: { agendado_para: body.agendamento }
      });
    }

    return res.status(200).json(campanhaCriada);
  } catch (error) {
    console.error('[SalvarComunicacaoAPI] Erro ao persistir comunicação oficial:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: error.message || 'Erro ao persistir comunicação oficial na base de dados'
    });
  }
}

