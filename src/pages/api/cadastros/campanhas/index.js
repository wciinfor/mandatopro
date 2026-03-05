import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  try {
    const supabase = createServerClient();

    // GET - Listar campanhas
    if (req.method === 'GET') {
      const { status, search, limit = 100, offset = 0, dataInicio, dataFim, localidade } = req.query;

      let query = supabase
        .from('campanhas')
        .select('*, campanhas_liderancas(*, liderancas(*)), campanhas_servicos(*, categorias_servicos(*))', { count: 'exact' });

      if (status) {
        query = query.eq('status', status);
      }

      // Filtro por período
      if (dataInicio) {
        query = query.gte('data_campanha', dataInicio);
      }
      if (dataFim) {
        query = query.lte('data_campanha', dataFim);
      }

      // Filtro por localidade
      if (localidade && localidade.trim().length > 0) {
        query = query.ilike('local', `%${localidade}%`);
      }

      // Se há um termo de busca
      if (search && search.trim().length > 0) {
        query = query.or(`nome.ilike.%${search}%,descricao.ilike.%${search}%`);
      }

      const { data: campanhas, count, error } = await query
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
        .order('data_campanha', { ascending: false });

      if (error) {
        return res.status(400).json({
          message: 'Erro ao listar campanhas',
          error: error.message
        });
      }

      if (campanhas && campanhas.length > 0) {
        const campanhaIds = campanhas.map(c => c.id);

        const { data: atendimentos, error: erroAtendimentos } = await supabase
          .from('atendimentos')
          .select('id, campanha_id')
          .in('campanha_id', campanhaIds);

        const atendimentoIds = (atendimentos || []).map(a => a.id);

        let servicosAtendimentos = [];
        if (!erroAtendimentos && atendimentoIds.length > 0) {
          const { data: servicosData } = await supabase
            .from('atendimentos_servicos')
            .select('atendimento_id, categoria_servico_id')
            .in('atendimento_id', atendimentoIds);
          servicosAtendimentos = servicosData || [];
        }

        const atendimentoPorId = (atendimentos || []).reduce((acc, at) => {
          acc[at.id] = at.campanha_id;
          return acc;
        }, {});

        const usoPorCampanhaServico = {};
        servicosAtendimentos.forEach((item) => {
          const campanhaId = atendimentoPorId[item.atendimento_id];
          if (!campanhaId) return;
          const key = `${campanhaId}:${item.categoria_servico_id}`;
          usoPorCampanhaServico[key] = (usoPorCampanhaServico[key] || 0) + 1;
        });

        campanhas.forEach((campanha) => {
          if (!Array.isArray(campanha.campanhas_servicos)) return;
          campanha.campanhas_servicos = campanha.campanhas_servicos.map((cs) => {
            const total = cs.quantidade || 0;
            const usados = usoPorCampanhaServico[`${campanha.id}:${cs.categoria_servico_id}`] || 0;
            const disponiveis = Math.max(total - usados, 0);
            return {
              ...cs,
              quantidade_usada: usados,
              quantidade_disponivel: disponiveis
            };
          });
        });
      }

      return res.status(200).json({
        data: campanhas,
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    }

    // POST - Criar nova campanha
    if (req.method === 'POST') {
      const body = req.body || {};
      const normalizar = (value) => (value === '' ? null : value);

      const payload = {
        nome: normalizar(body.nome),
        descricao: normalizar(body.descricao),
        local: normalizar(body.local),
        municipio: normalizar(body.municipio),
        data_campanha: normalizar(body.dataCampanha || body.data_campanha),
        hora_inicio: normalizar(body.horaInicio || body.hora_inicio),
        hora_fim: normalizar(body.horaFim || body.hora_fim),
        status: normalizar(body.status) || 'PLANEJAMENTO',
        observacoes: normalizar(body.observacoes)
      };

      const { data: campanha, error } = await supabase
        .from('campanhas')
        .insert([payload])
        .select();

      if (error) {
        console.error('Erro ao criar campanha:', error);
        return res.status(400).json({
          message: 'Erro ao criar campanha',
          error: error.message,
          details: error.details,
          hint: error.hint
        });
      }

      const campanhaCriada = campanha?.[0];

      if (campanhaCriada?.id) {
        const agendaPayload = {
          titulo: campanhaCriada.nome || payload.nome,
          descricao: campanhaCriada.descricao || payload.descricao,
          data: campanhaCriada.data_campanha || payload.data_campanha,
          hora_inicio: campanhaCriada.hora_inicio || payload.hora_inicio,
          hora_fim: campanhaCriada.hora_fim || payload.hora_fim,
          horaInicio: campanhaCriada.hora_inicio || payload.hora_inicio,
          horaFim: campanhaCriada.hora_fim || payload.hora_fim,
          local: campanhaCriada.local || payload.local,
          municipio: campanhaCriada.municipio || payload.municipio || campanhaCriada.local || payload.local,
          endereco: null,
          tipo: 'EVENTO',
          categoria: 'Campanha',
          status: 'AGENDADO',
          participantes: 0,
          confirmados: 0,
          observacoes: campanhaCriada.observacoes || payload.observacoes,
          permitirConfirmacao: true,
          criado_por_id: null
        };

        const { error: erroAgenda } = await supabase
          .from('agenda_eventos')
          .insert([agendaPayload]);

        if (erroAgenda) {
          console.error('Erro ao criar agenda da campanha:', erroAgenda);
          await supabase
            .from('campanhas')
            .delete()
            .eq('id', campanhaCriada.id);

          return res.status(400).json({
            message: 'Erro ao criar agenda da campanha',
            error: erroAgenda.message
          });
        }
      }

      // Inserir lideranças associadas se fornecidas
      if (body.liderancos && Array.isArray(body.liderancos) && body.liderancos.length > 0 && campanhaCriada?.id) {
        const liderancasPayload = body.liderancos.map(lid => ({
          campanha_id: campanhaCriada.id,
          lideranca_id: parseInt(lid.id) || lid.id, // Garantir que é número
          papel: lid.papel || 'APOIO'
        }));

        const { error: erroLiderancas } = await supabase
          .from('campanhas_liderancas')
          .insert(liderancasPayload);

        if (erroLiderancas) {
          console.error('Erro ao associar lideranças:', erroLiderancas);
        }
      }

      // Inserir serviços associados se fornecidos
      if (body.servicos && Array.isArray(body.servicos) && body.servicos.length > 0 && campanhaCriada?.id) {
        const servicosPayload = body.servicos.map(serv => ({
          campanha_id: campanhaCriada.id,
          categoria_servico_id: serv.id,
          quantidade: serv.quantidade || 0
        }));

        const { error: erroServicos } = await supabase
          .from('campanhas_servicos')
          .insert(servicosPayload);

        if (erroServicos) {
          console.error('Erro ao associar serviços:', erroServicos);
        }
      }

      // Carregar a campanha completa com lideranças e serviços
      const { data: campanhaCompleta } = await supabase
        .from('campanhas')
        .select('*, campanhas_liderancas(*, liderancas(*)), campanhas_servicos(*, categorias_servicos(*))')
        .eq('id', campanhaCriada.id)
        .single();

      return res.status(201).json({
        data: campanhaCompleta || campanhaCriada,
        message: 'Campanha criada com sucesso'
      });
    }

    return res.status(405).json({ message: 'Método não permitido' });
  } catch (error) {
    console.error('Erro na API:', error);
    return res.status(500).json({
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
}
