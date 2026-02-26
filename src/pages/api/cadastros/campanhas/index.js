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
        data_campanha: normalizar(body.dataCampanha || body.data_campanha),
        hora_inicio: normalizar(body.horaInicio || body.hora_inicio),
        hora_fim: normalizar(body.horaFim || body.hora_fim),
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        status: normalizar(body.status) || 'PLANEJAMENTO',
        criado_por: normalizar(body.criadoPor),
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

      // Inserir lideranças associadas se fornecidas
      if (body.liderancos && Array.isArray(body.liderancos) && body.liderancos.length > 0 && campanha[0]?.id) {
        const liderancasPayload = body.liderancos.map(lid => ({
          campanha_id: campanha[0].id,
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
      if (body.servicos && Array.isArray(body.servicos) && body.servicos.length > 0 && campanha[0]?.id) {
        const servicosPayload = body.servicos.map(serv => ({
          campanha_id: campanha[0].id,
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
        .eq('id', campanha[0].id)
        .single();

      return res.status(201).json({
        data: campanhaCompleta || campanha[0],
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
