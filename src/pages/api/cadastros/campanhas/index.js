import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    // GET - Listar campanhas
    if (req.method === 'GET') {
      const { status, search, limit = 100, offset = 0, dataInicio, dataFim, localidade } = req.query;

      let query = supabase
        .from('campanhas')
        .select('*, campanhas_mandatos(mandato_id, mandatos(*)), campanhas_liderancas(*, liderancas(*)), campanhas_servicos(*, categorias_servicos(*))', { count: 'exact' });

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
        campanhas.forEach((c) => {
          c.mandato_id = c.campanhas_mandatos?.[0]?.mandato_id || 1;
          c.mandato = c.campanhas_mandatos?.[0]?.mandatos || { id: 1, nome: 'Deputado Estadual', tipo: 'ESTADUAL' };
        });

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

      const mandatoIdSolicitado = parseInt(body.mandato_id || body.mandatoId || 1);
      if (![1, 2].includes(mandatoIdSolicitado)) {
        return res.status(400).json({ message: 'Mandato inválido' });
      }

      // Validar autorização do usuário
      let userMandates = usuario.mandatos || [];
      if (usuario.nivel === 'ADMINISTRADOR') {
        userMandates = [1, 2];
      } else if (!userMandates.length) {
        const { data: vinculosUser } = await supabase
          .from('usuarios_mandatos')
          .select('mandato_id')
          .eq('usuario_id', usuario.id);
        userMandates = (vinculosUser || []).map(v => v.mandato_id);
      }

      if (!userMandates.includes(mandatoIdSolicitado)) {
        return res.status(403).json({ message: `Você não possui permissão para cadastrar campanhas no mandato ${mandatoIdSolicitado === 1 ? 'Estadual' : 'Federal'}` });
      }

      // Validar lideranças selecionadas se houver
      const liderancosRecebidos = body.liderancos || body.liderancas || [];
      if (Array.isArray(liderancosRecebidos) && liderancosRecebidos.length > 0) {
        for (const lid of liderancosRecebidos) {
          const lidId = parseInt(lid.id || lid);
          if (!isNaN(lidId)) {
            const { data: lm } = await supabase
              .from('liderancas_mandatos')
              .select('lideranca_id')
              .eq('lideranca_id', lidId)
              .eq('mandato_id', mandatoIdSolicitado)
              .maybeSingle();

            if (!lm) {
              return res.status(400).json({ message: 'Existem lideranças selecionadas que não pertencem ao mandato da campanha' });
            }
          }
        }
      }

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
        // Criar vínculo com campanhas_mandatos
        await supabase
          .from('campanhas_mandatos')
          .insert([{ campanha_id: campanhaCriada.id, mandato_id: mandatoIdSolicitado }]);

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
      if (Array.isArray(liderancosRecebidos) && liderancosRecebidos.length > 0 && campanhaCriada?.id) {
        const liderancasPayload = liderancosRecebidos.map(lid => ({
          campanha_id: campanhaCriada.id,
          lideranca_id: parseInt(lid.id || lid),
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

      // Carregar a campanha completa com lideranças, serviços e mandato
      const { data: campanhaCompleta } = await supabase
        .from('campanhas')
        .select('*, campanhas_mandatos(mandato_id, mandatos(*)), campanhas_liderancas(*, liderancas(*)), campanhas_servicos(*, categorias_servicos(*))')
        .eq('id', campanhaCriada.id)
        .single();

      if (campanhaCompleta) {
        campanhaCompleta.mandato_id = mandatoIdSolicitado;
      }

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
