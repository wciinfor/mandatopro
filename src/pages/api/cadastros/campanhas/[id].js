import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    const supabase = createServerClient();

    // GET - Obter detalhes de uma campanha
    if (req.method === 'GET') {
      const { data: campanha, error } = await supabase
        .from('campanhas')
        .select('*, campanhas_liderancas(*, liderancas(*)), campanhas_servicos(*, categorias_servicos(*))')
        .eq('id', id)
        .single();

      if (error) {
        return res.status(404).json({
          message: 'Campanha não encontrada',
          error: error.message
        });
      }

      return res.status(200).json({ data: campanha });
    }

    // PUT - Atualizar campanha
    if (req.method === 'PUT') {
      const body = req.body || {};
      const normalizar = (value) => (value === '' ? null : value);

      const payload = {
        nome: normalizar(body.nome),
        descricao: normalizar(body.descricao),
        local: normalizar(body.local),
        data_campanha: normalizar(body.dataCampanha || body.data_campanha),
        hora_inicio: normalizar(body.horaInicio || body.hora_inicio),
        hora_fim: normalizar(body.horaFim || body.hora_fim),
        status: normalizar(body.status),
        observacoes: normalizar(body.observacoes)
      };

      const { data: campanha, error } = await supabase
        .from('campanhas')
        .update(payload)
        .eq('id', id)
        .select();

      if (error) {
        console.error('Erro ao atualizar campanha:', error);
        return res.status(400).json({
          message: 'Erro ao atualizar campanha',
          error: error.message,
          details: error.details,
          hint: error.hint
        });
      }

      // Atualizar lideranças se fornecidas
      if (body.liderancos && Array.isArray(body.liderancos)) {
        // Deletar lideranças antigas
        const { error: erroDelete } = await supabase
          .from('campanhas_liderancas')
          .delete()
          .eq('campanha_id', id);

        if (erroDelete) {
          console.error('Erro ao deletar lideranças:', erroDelete);
        }

        // Inserir novas lideranças
        if (body.liderancos.length > 0) {
          const liderancasPayload = body.liderancos.map(lid => ({
            campanha_id: id,
            lideranca_id: parseInt(lid.id) || lid.id,
            papel: lid.papel || 'APOIO'
          }));

          const { error: erroLiderancas } = await supabase
            .from('campanhas_liderancas')
            .insert(liderancasPayload);

          if (erroLiderancas) {
            console.error('Erro ao associar lideranças:', erroLiderancas);
            throw new Error(`Erro ao atualizar lideranças: ${erroLiderancas.message}`);
          }
        }
      }

      // Atualizar serviços se fornecidos
      if (body.servicos && Array.isArray(body.servicos)) {
        // Deletar serviços antigos
        const { error: erroDeleteServicos } = await supabase
          .from('campanhas_servicos')
          .delete()
          .eq('campanha_id', id);

        if (erroDeleteServicos) {
          console.error('Erro ao deletar serviços:', erroDeleteServicos);
        }

        // Inserir novos serviços
        if (body.servicos.length > 0) {
          const servicosPayload = body.servicos.map(serv => ({
            campanha_id: id,
            categoria_servico_id: serv.id,
            quantidade: serv.quantidade || 0
          }));

          const { error: erroServicos } = await supabase
            .from('campanhas_servicos')
            .insert(servicosPayload);

          if (erroServicos) {
            console.error('Erro ao associar serviços:', erroServicos);
            throw new Error(`Erro ao atualizar serviços: ${erroServicos.message}`);
          }
        }
      }

      // Carregar a campanha completa com lideranças e serviços
      const { data: campanhaCompleta, error: erroCarregar } = await supabase
        .from('campanhas')
        .select('*, campanhas_liderancas(*, liderancas(*)), campanhas_servicos(*, categorias_servicos(*))')
        .eq('id', id)
        .single();

      if (erroCarregar) {
        console.error('Erro ao carregar campanha completa:', erroCarregar);
      }

      return res.status(200).json({
        data: campanhaCompleta || campanha[0],
        message: 'Campanha atualizada com sucesso'
      });
    }

    // DELETE - Deletar campanha
    if (req.method === 'DELETE') {
      // Deletar lideranças associadas
      await supabase
        .from('campanhas_liderancas')
        .delete()
        .eq('campanha_id', id);

      // Deletar serviços associados
      await supabase
        .from('campanhas_servicos')
        .delete()
        .eq('campanha_id', id);

      // Deletar campanha
      const { error } = await supabase
        .from('campanhas')
        .delete()
        .eq('id', id);

      if (error) {
        return res.status(400).json({
          message: 'Erro ao deletar campanha',
          error: error.message
        });
      }

      return res.status(200).json({
        message: 'Campanha deletada com sucesso'
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
