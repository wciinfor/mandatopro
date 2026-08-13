import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterContextoMandato, validarAcessoRegistroPorId } from '@/lib/mandato-auth';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const contextoMandato = await obterContextoMandato(req, usuario, supabase);
    const valAcc = await validarAcessoRegistroPorId('CAMPANHA', id, contextoMandato, supabase);
    if (!valAcc.autorizado) {
      return res.status(valAcc.status).json({ message: valAcc.message });
    }

    // GET - Obter detalhes de uma campanha
    if (req.method === 'GET') {
      const { data: campanha, error } = await supabase
        .from('campanhas')
        .select('*, campanhas_mandatos(mandato_id, mandatos(*)), campanhas_liderancas(*, liderancas(*)), campanhas_servicos(*, categorias_servicos(*))')
        .eq('id', id)
        .single();

      if (error) {
        return res.status(404).json({
          message: 'Campanha não encontrada',
          error: error.message
        });
      }

      if (campanha) {
        campanha.mandato_id = campanha.campanhas_mandatos?.[0]?.mandato_id || 1;
        campanha.mandato = campanha.campanhas_mandatos?.[0]?.mandatos || { id: 1, nome: 'Deputado Estadual', tipo: 'ESTADUAL' };
      }

      if (campanha && Array.isArray(campanha.campanhas_servicos)) {
        const { data: atendimentos } = await supabase
          .from('atendimentos')
          .select('id')
          .eq('campanha_id', campanha.id);

        const atendimentoIds = (atendimentos || []).map(a => a.id);
        let servicosAtendimentos = [];

        if (atendimentoIds.length > 0) {
          const { data: servicosData } = await supabase
            .from('atendimentos_servicos')
            .select('atendimento_id, categoria_servico_id')
            .in('atendimento_id', atendimentoIds);
          servicosAtendimentos = servicosData || [];
        }

        const usoPorServico = {};
        servicosAtendimentos.forEach((item) => {
          const key = item.categoria_servico_id;
          usoPorServico[key] = (usoPorServico[key] || 0) + 1;
        });

        campanha.campanhas_servicos = campanha.campanhas_servicos.map((cs) => {
          const total = cs.quantidade || 0;
          const usados = usoPorServico[cs.categoria_servico_id] || 0;
          const disponiveis = Math.max(total - usados, 0);
          return {
            ...cs,
            quantidade_usada: usados,
            quantidade_disponivel: disponiveis
          };
        });
      }

      return res.status(200).json({ data: campanha });
    }

    // PUT - Atualizar campanha
    if (req.method === 'PUT') {
      const body = req.body || {};
      const normalizar = (value) => (value === '' ? null : value);

      const novoMandatoId = body.mandato_id ? parseInt(body.mandato_id) : null;

      if (novoMandatoId) {
        if (![1, 2].includes(novoMandatoId)) {
          return res.status(400).json({ message: 'Mandato inválido' });
        }

        // Validar permissão do usuário
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

        if (!userMandates.includes(novoMandatoId)) {
          return res.status(403).json({ message: `Você não possui permissão para vincular campanhas ao mandato ${novoMandatoId === 1 ? 'Estadual' : 'Federal'}` });
        }

        // Determinar lideranças a validar
        let targetLids = [];
        if (body.liderancos && Array.isArray(body.liderancos)) {
          targetLids = body.liderancos.map(l => parseInt(l.id || l));
        } else {
          const { data: currentLids } = await supabase
            .from('campanhas_liderancas')
            .select('lideranca_id')
            .eq('campanha_id', id);
          targetLids = (currentLids || []).map(l => l.lideranca_id);
        }

        // Validar compatibilidade de cada liderança com o novo mandato
        for (const lidId of targetLids) {
          if (!isNaN(lidId)) {
            const { data: lm } = await supabase
              .from('liderancas_mandatos')
              .select('lideranca_id')
              .eq('lideranca_id', lidId)
              .eq('mandato_id', novoMandatoId)
              .maybeSingle();

            if (!lm) {
              return res.status(400).json({ message: 'Existem lideranças vinculadas à campanha que não pertencem ao novo mandato' });
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

      if (novoMandatoId) {
        await supabase
          .from('campanhas_mandatos')
          .delete()
          .eq('campanha_id', id);

        await supabase
          .from('campanhas_mandatos')
          .insert([{ campanha_id: id, mandato_id: novoMandatoId }]);
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
