/**
 * Serviço de Relatórios da Central de Atendimento Connect
 * MandatoPRO
 *
 * Agrega e consolida dados operacionais, estatísticas de campanhas, produtividade
 * de operadores, volumetria de disparos e métricas de primeira resposta.
 *
 * Garante rigorosamente o isolamento multi-tenant pelo tenant autenticado no servidor.
 */

export class AtendimentoRelatoriosService {
  /**
   * Helper para buscar todos os registros de uma tabela paginando caso exceda 1000 itens
   */
  static async buscarTodos(queryBuilder, batchSize = 1000) {
    let all = [];
    let from = 0;
    while (true) {
      const { data, error } = await queryBuilder.range(from, from + batchSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    return all;
  }

  /**
   * Obtém relatório consolidado de atendimento e campanhas com base nos filtros fornecidos.
   *
   * @param {Object} params
   * @param {Object} params.supabase - Cliente Supabase autenticado
   * @param {number|string} params.tenantId - ID do tenant do usuário autenticado
   * @param {Object} params.filtros - Critérios de filtro opcionais
   * @returns {Promise<Object>} Payload analítico consolidado
   */
  static async obterRelatorioConsolidado({ supabase, tenantId, filtros = {} }) {
    if (!tenantId) {
      const err = new Error('Tenant ID obrigatório para consulta de relatórios');
      err.statusCode = 403;
      throw err;
    }

    const {
      dataInicio,
      dataFim,
      campanhaId,
      status,
      operadorId,
      metodoAtribuicao,
      provider
    } = filtros;

    // 1. Buscar todas as campanhas do tenant para relacionamentos e filtros
    const { data: campanhasTenant, error: errCampanhas } = await supabase
      .from('communication_campaigns')
      .select('id, nome, canal, status, created_at')
      .eq('tenant_id', tenantId);

    if (errCampanhas) {
      throw new Error(`Erro ao consultar campanhas do tenant: ${errCampanhas.message}`);
    }

    const listaCampanhas = campanhasTenant || [];
    const idsCampanhasTenant = listaCampanhas.map(c => Number(c.id));
    const mapaCampanhas = new Map(listaCampanhas.map(c => [Number(c.id), c]));

    // 2. Buscar usuários/operadores do tenant
    const { data: usuariosTenant, error: errUsuarios } = await supabase
      .from('usuarios')
      .select('id, nome, nivel')
      .eq('tenant_id', tenantId);

    if (errUsuarios) {
      throw new Error(`Erro ao consultar usuários do tenant: ${errUsuarios.message}`);
    }

    const mapaOperadores = new Map((usuariosTenant || []).map(u => [Number(u.id), u]));

    // 3. Montar consulta de conversas (atendimento_connect_conversas)
    let queryConversas = supabase
      .from('atendimento_connect_conversas')
      .select(`
        id,
        eleitor_id,
        contato_nome,
        contato_telefone,
        campanha_id,
        canal,
        status,
        prioridade,
        responsavel_id,
        ultima_mensagem_em,
        metadata,
        created_at,
        usuarios:responsavel_id(id, nome),
        eleitores:eleitor_id(id, nome, telefone, celular)
      `)
      .order('created_at', { ascending: false });

    // Filtros em atendimento_connect_conversas
    if (status && status !== 'todos') {
      queryConversas = queryConversas.eq('status', status);
    }

    if (operadorId && operadorId !== 'todos') {
      if (operadorId === 'sem_responsavel') {
        queryConversas = queryConversas.is('responsavel_id', null);
      } else {
        queryConversas = queryConversas.eq('responsavel_id', Number(operadorId));
      }
    }

    if (campanhaId && campanhaId !== 'todos') {
      if (campanhaId === 'sem_campanha') {
        queryConversas = queryConversas.is('campanha_id', null);
      } else {
        queryConversas = queryConversas.eq('campanha_id', Number(campanhaId));
      }
    }

    if (metodoAtribuicao && metodoAtribuicao !== 'todos') {
      if (metodoAtribuicao === 'sem_campanha') {
        queryConversas = queryConversas.is('campanha_id', null);
      } else {
        queryConversas = queryConversas.eq('metadata->>metodo_atribuicao', metodoAtribuicao);
      }
    }

    if (dataInicio) {
      queryConversas = queryConversas.gte('created_at', `${dataInicio}T00:00:00.000Z`);
    }

    if (dataFim) {
      queryConversas = queryConversas.lte('created_at', `${dataFim}T23:59:59.999Z`);
    }

    const conversasBrutas = await this.buscarTodos(queryConversas);

    // 4. Filtrar defensivamente em memória por tenant_id e por provider quando informado
    const conversas = conversasBrutas.filter(c => {
      if (c.campanha_id && !idsCampanhasTenant.includes(Number(c.campanha_id))) {
        return false;
      }
      if (c.responsavel_id && !mapaOperadores.has(Number(c.responsavel_id))) {
        return false;
      }

      if (provider && provider !== 'todos') {
        const provMeta = String(c.metadata?.provider || (c.metadata?.origem === 'ycloud' ? 'YCLOUD' : '')).toUpperCase();
        if (provMeta !== String(provider).toUpperCase()) {
          return false;
        }
      }

      return true;
    });

    const idsConversas = conversas.map(c => c.id);

    // 5. RESUMO DE ATENDIMENTO
    let novas = 0;
    let emAtendimento = 0;
    let aguardandoEleitor = 0;
    let resolverDepois = 0;
    let concluidas = 0;
    let semResponsavel = 0;
    let comCampanha = 0;
    let semCampanha = 0;

    const mapaDias = new Map();

    conversas.forEach(c => {
      const st = String(c.status || '').toLowerCase();
      if (st === 'nova') novas++;
      else if (st === 'em_atendimento') emAtendimento++;
      else if (st === 'aguardando_eleitor') aguardandoEleitor++;
      else if (st === 'resolver_depois') resolverDepois++;
      else if (st === 'concluida') concluidas++;

      if (!c.responsavel_id) semResponsavel++;
      if (c.campanha_id) comCampanha++; else semCampanha++;

      if (c.created_at) {
        const diaStr = c.created_at.slice(0, 10);
        mapaDias.set(diaStr, (mapaDias.get(diaStr) || 0) + 1);
      }
    });

    const conversasPorPeriodo = Array.from(mapaDias.entries())
      .map(([data, quantidade]) => ({ data, quantidade }))
      .sort((a, b) => a.data.localeCompare(b.data));

    const resumoAtendimento = {
      totalConversas: conversas.length,
      novas,
      emAtendimento,
      aguardandoEleitor,
      resolverDepois,
      concluidas,
      semResponsavel,
      comCampanha,
      semCampanha
    };

    // 6. DISPAROS (communication_campaign_items do tenant)
    let queryItens = supabase
      .from('communication_campaign_items')
      .select('id, campaign_id, status, last_error, provider_message_id, started_at, finished_at, communication_campaigns(id, canal, nome)')
      .eq('tenant_id', tenantId);

    if (campanhaId && campanhaId !== 'todos' && campanhaId !== 'sem_campanha') {
      queryItens = queryItens.eq('campaign_id', Number(campanhaId));
    }

    if (dataInicio) {
      queryItens = queryItens.gte('created_at', `${dataInicio}T00:00:00.000Z`);
    }

    if (dataFim) {
      queryItens = queryItens.lte('created_at', `${dataFim}T23:59:59.999Z`);
    }

    const itensDisparo = await this.buscarTodos(queryItens);

    // Mapeamento prévio do provedor por campanha para resolver com segurança itens com erro/falha antes do envio
    const providerPorCampanha = new Map();

    // 1º Passo: inferir das mensagens/itens enviados que possuem provider_message_id
    itensDisparo.forEach(it => {
      if (!it.campaign_id || providerPorCampanha.has(Number(it.campaign_id))) return;
      const pmid = it.provider_message_id ? String(it.provider_message_id).trim() : '';
      if (pmid.startsWith('wamid.')) providerPorCampanha.set(Number(it.campaign_id), 'META');
      else if (pmid.startsWith('6a') && pmid.length === 24) providerPorCampanha.set(Number(it.campaign_id), 'YCLOUD');
      else if (pmid.startsWith('cmt') || pmid.length === 25) providerPorCampanha.set(Number(it.campaign_id), 'WABLAST');
    });

    // 2º Passo: para campanhas sem nenhum envio completado, inferir por mensagens de erro ou nome
    itensDisparo.forEach(it => {
      if (!it.campaign_id || providerPorCampanha.has(Number(it.campaign_id))) return;
      const nome = String(it.communication_campaigns?.nome || '').toLowerCase();
      const err = String(it.last_error || '').toLowerCase();
      if (nome.includes('ycloud') || err.includes('ycloud')) providerPorCampanha.set(Number(it.campaign_id), 'YCLOUD');
      else if (nome.includes('wablast') || err.includes('wablast')) providerPorCampanha.set(Number(it.campaign_id), 'WABLAST');
      else if (nome.includes('meta') || err.includes('meta') || err.includes('#13200')) providerPorCampanha.set(Number(it.campaign_id), 'META');
    });

    let disparosEnviados = 0;
    let disparosEntregues = 0;
    let disparosLidos = 0;
    let disparosFalhas = 0;

    const itensPorCampanhaMap = new Map();
    const itensPorProviderMap = new Map();

    itensDisparo.forEach(it => {
      const st = String(it.status || '').toLowerCase();
      const isEnviado = ['enviado', 'sent', 'entregue', 'delivered', 'lido', 'read'].includes(st);
      const isEntregue = ['entregue', 'delivered', 'lido', 'read'].includes(st);
      const isLido = ['lido', 'read'].includes(st);
      const isFalha = ['falha', 'failed', 'erro'].includes(st);

      if (isEnviado) disparosEnviados++;
      if (isEntregue) disparosEntregues++;
      if (isLido) disparosLidos++;
      if (isFalha) disparosFalhas++;

      if (it.campaign_id) {
        const cId = Number(it.campaign_id);
        if (!itensPorCampanhaMap.has(cId)) {
          itensPorCampanhaMap.set(cId, {
            totalItens: 0,
            enviados: 0,
            entregues: 0,
            lidos: 0,
            falhas: 0
          });
        }
        const ref = itensPorCampanhaMap.get(cId);
        ref.totalItens++;
        if (isEnviado) ref.enviados++;
        if (isEntregue) ref.entregues++;
        if (isLido) ref.lidos++;
        if (isFalha) ref.falhas++;
      }

      // Resolução segura e normalizada do provider
      let prov = null;
      const pmid = it.provider_message_id ? String(it.provider_message_id).trim() : '';
      if (pmid.startsWith('wamid.')) prov = 'META';
      else if (pmid.startsWith('6a') && pmid.length === 24) prov = 'YCLOUD';
      else if (pmid.startsWith('cmt') || pmid.length === 25) prov = 'WABLAST';

      if (!prov && it.campaign_id && providerPorCampanha.has(Number(it.campaign_id))) {
        prov = providerPorCampanha.get(Number(it.campaign_id));
      }

      if (!prov) {
        prov = 'WHATSAPP';
      }

      itensPorProviderMap.set(prov, (itensPorProviderMap.get(prov) || 0) + 1);
    });

    const disparosResumo = {
      totalItens: itensDisparo.length,
      enviados: disparosEnviados,
      entregues: disparosEntregues,
      lidos: disparosLidos,
      falhas: disparosFalhas,
      distribuicaoPorProvider: Object.fromEntries(itensPorProviderMap),
      distribuicaoPorCampanha: Array.from(itensPorCampanhaMap.entries()).map(([cId, dados]) => ({
        campaignId: cId,
        nome: mapaCampanhas.get(cId)?.nome || `Campanha ${cId}`,
        ...dados
      }))
    };

    // 7. CAMPANHAS (Conversas e Itens relacionados)
    const campanhasMetricasMap = new Map();

    listaCampanhas.forEach(c => {
      campanhasMetricasMap.set(Number(c.id), {
        campaignId: Number(c.id),
        nome: c.nome,
        totalConversas: 0,
        temporalRecente: 0,
        diretoQuote: 0,
        totalItensEnviados: 0,
        totalItensEntregues: 0,
        totalItensLidos: 0,
        totalFalhas: 0
      });
    });

    conversas.forEach(c => {
      if (!c.campanha_id) return;
      const cId = Number(c.campanha_id);
      if (!campanhasMetricasMap.has(cId)) return;
      const cm = campanhasMetricasMap.get(cId);
      cm.totalConversas++;
      const metodo = c.metadata?.metodo_atribuicao;
      if (metodo === 'temporal_recente') cm.temporalRecente++;
      else if (metodo === 'direto_quote') cm.diretoQuote++;
    });

    itensPorCampanhaMap.forEach((dados, cId) => {
      if (campanhasMetricasMap.has(cId)) {
        const cm = campanhasMetricasMap.get(cId);
        cm.totalItensEnviados = dados.enviados;
        cm.totalItensEntregues = dados.entregues;
        cm.totalItensLidos = dados.lidos;
        cm.totalFalhas = dados.falhas;
      }
    });

    const campanhasRelatorio = Array.from(campanhasMetricasMap.values())
      .filter(c => {
        if (campanhaId && campanhaId !== 'todos') {
          return c.campaignId === Number(campanhaId);
        }
        return c.totalConversas > 0 || c.totalItensEnviados > 0;
      })
      .sort((a, b) => b.totalConversas - a.totalConversas);

    // 8. MENSAGENS E OPERADORES
    let mensagensFiltradas = [];
    if (idsConversas.length > 0) {
      const CHUNK_SIZE = 500;
      for (let i = 0; i < idsConversas.length; i += CHUNK_SIZE) {
        const sliceIds = idsConversas.slice(i, i + CHUNK_SIZE);
        const queryMsgs = supabase
          .from('atendimento_connect_mensagens')
          .select('id, conversa_id, direcao, usuario_id, status, created_at')
          .in('conversa_id', sliceIds)
          .order('created_at', { ascending: true });
        const lote = await this.buscarTodos(queryMsgs);
        mensagensFiltradas = mensagensFiltradas.concat(lote);
      }
    }

    const operadoresMetricasMap = new Map();

    usuariosTenant.forEach(u => {
      operadoresMetricasMap.set(Number(u.id), {
        operadorId: Number(u.id),
        nome: u.nome,
        conversasAtribuidas: 0,
        conversasConcluidas: 0,
        conversasPendentes: 0,
        mensagensSaida: 0,
        notasInternas: 0
      });
    });

    conversas.forEach(c => {
      if (!c.responsavel_id) return;
      const opId = Number(c.responsavel_id);
      if (!operadoresMetricasMap.has(opId)) return;
      const op = operadoresMetricasMap.get(opId);
      op.conversasAtribuidas++;
      if (String(c.status).toLowerCase() === 'concluida') {
        op.conversasConcluidas++;
      } else {
        op.conversasPendentes++;
      }
    });

    mensagensFiltradas.forEach(m => {
      if (!m.usuario_id) return;
      const opId = Number(m.usuario_id);
      if (!operadoresMetricasMap.has(opId)) return;
      const op = operadoresMetricasMap.get(opId);
      if (m.direcao === 'saida') op.mensagensSaida++;
      else if (m.direcao === 'nota') op.notasInternas++;
    });

    const operadoresRelatorio = Array.from(operadoresMetricasMap.values())
      .filter(op => {
        if (operadorId && operadorId !== 'todos') {
          return op.operadorId === Number(operadorId);
        }
        return op.conversasAtribuidas > 0 || op.mensagensSaida > 0 || op.notasInternas > 0;
      })
      .sort((a, b) => b.conversasAtribuidas - a.conversasAtribuidas);

    // 9. MÉTRICA DE PRIMEIRA RESPOSTA (Global e por Operador)
    const msgsPorConversa = new Map();
    mensagensFiltradas.forEach(m => {
      if (!msgsPorConversa.has(m.conversa_id)) {
        msgsPorConversa.set(m.conversa_id, []);
      }
      msgsPorConversa.get(m.conversa_id).push(m);
    });

    const mapaConversasResponsavel = new Map(conversas.map(c => [c.id, c.responsavel_id ? Number(c.responsavel_id) : null]));
    const temposRespostaMinutos = [];
    const temposRespostaPorOperador = new Map();

    msgsPorConversa.forEach((listaMsgs, conversaId) => {
      const primeiraEntrada = listaMsgs.find(m => m.direcao === 'entrada');
      if (!primeiraEntrada) return;

      const primeiraSaidaApos = listaMsgs.find(m =>
        m.direcao === 'saida' &&
        new Date(m.created_at) > new Date(primeiraEntrada.created_at)
      );

      if (!primeiraSaidaApos) return;

      const diffMs = new Date(primeiraSaidaApos.created_at).getTime() - new Date(primeiraEntrada.created_at).getTime();
      const diffMinutos = Math.max(0, Math.round(diffMs / 60000));
      temposRespostaMinutos.push(diffMinutos);

      const opId = primeiraSaidaApos.usuario_id
        ? Number(primeiraSaidaApos.usuario_id)
        : mapaConversasResponsavel.get(conversaId);

      if (opId) {
        if (!temposRespostaPorOperador.has(opId)) {
          temposRespostaPorOperador.set(opId, []);
        }
        temposRespostaPorOperador.get(opId).push(diffMinutos);
      }
    });

    // Injetar tempo médio individual nos operadores
    operadoresRelatorio.forEach(op => {
      const temposOp = temposRespostaPorOperador.get(op.operadorId);
      if (temposOp && temposOp.length > 0) {
        const somaOp = temposOp.reduce((acc, v) => acc + v, 0);
        op.tempoMedioMinutos = Math.round(somaOp / temposOp.length);
        op.respostasConsideradas = temposOp.length;
      } else {
        op.tempoMedioMinutos = null;
        op.respostasConsideradas = 0;
      }
    });

    // Injetar provider nas campanhas do relatório
    campanhasRelatorio.forEach(camp => {
      camp.provider = providerPorCampanha.get(camp.campaignId) || 'META';
    });

    // Injetar provider na lista detalhada de disparos por campanha
    disparosResumo.distribuicaoPorCampanha.forEach(d => {
      d.provider = providerPorCampanha.get(d.campaignId) || 'META';
    });

    // 10. DETALHAMENTO DE ATENDIMENTOS (conversas formatadas para visualização e exportação)
    const atendimentoDetalhes = conversas.map(c => {
      const nomeContato = c.contato_nome || c.eleitores?.nome || 'Contato sem nome';
      const telefone = c.contato_telefone || c.eleitores?.celular || c.eleitores?.telefone || '-';
      const responsavelNome = c.usuarios?.nome || (c.responsavel_id ? mapaOperadores.get(Number(c.responsavel_id))?.nome : null) || 'Não atribuído';
      const campanhaNome = c.campanha_id ? (mapaCampanhas.get(Number(c.campanha_id))?.nome || `Campanha #${c.campanha_id}`) : 'Sem campanha vinculada';
      const metodoAtribuicaoFormatado = c.metadata?.metodo_atribuicao || (c.campanha_id ? 'vinculada' : 'sem_campanha');

      let provOrigem = c.metadata?.provider;
      if (!provOrigem) {
        if (c.metadata?.origem === 'ycloud') provOrigem = 'YCLOUD';
        else if (c.campanha_id && providerPorCampanha.has(Number(c.campanha_id))) provOrigem = providerPorCampanha.get(Number(c.campanha_id));
        else provOrigem = c.canal === 'whatsapp' ? 'META' : (c.canal || 'META');
      }

      return {
        id: c.id,
        contatoNome: nomeContato,
        telefone,
        status: c.status || 'nova',
        responsavelNome,
        responsavelId: c.responsavel_id ? Number(c.responsavel_id) : null,
        campanhaId: c.campanha_id ? Number(c.campanha_id) : null,
        campanhaNome,
        metodoAtribuicao: metodoAtribuicaoFormatado,
        provider: String(provOrigem).toUpperCase(),
        canal: c.canal || 'whatsapp',
        dataCriacao: c.created_at,
        ultimaInteracao: c.ultima_mensagem_em || c.created_at
      };
    });

    let metricaPrimeiraResposta = {
      conversasConsideradas: 0,
      tempoMedioMinutos: null,
      tempoMinimoMinutos: null,
      tempoMaximoMinutos: null
    };

    if (temposRespostaMinutos.length > 0) {
      const soma = temposRespostaMinutos.reduce((acc, v) => acc + v, 0);
      metricaPrimeiraResposta = {
        conversasConsideradas: temposRespostaMinutos.length,
        tempoMedioMinutos: Math.round(soma / temposRespostaMinutos.length),
        tempoMinimoMinutos: Math.min(...temposRespostaMinutos),
        tempoMaximoMinutos: Math.max(...temposRespostaMinutos)
      };
    }

    return {
      filtrosAplicados: {
        dataInicio: dataInicio || null,
        dataFim: dataFim || null,
        campanhaId: campanhaId || null,
        status: status || null,
        operadorId: operadorId || null,
        metodoAtribuicao: metodoAtribuicao || null,
        provider: provider || null
      },
      resumoAtendimento,
      conversasPorPeriodo,
      campanhas: campanhasRelatorio,
      operadores: operadoresRelatorio,
      disparos: disparosResumo,
      primeiraResposta: metricaPrimeiraResposta,
      atendimentoDetalhes
    };
  }
}
