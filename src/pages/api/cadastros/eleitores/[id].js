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
    const valAcc = await validarAcessoRegistroPorId('ELEITOR', id, contextoMandato, supabase);
    if (!valAcc.autorizado) {
      return res.status(valAcc.status).json({ message: valAcc.message });
    }

    // GET - Buscar eleitor
    if (req.method === 'GET') {
      const { data: eleitor, error } = await supabase
        .from('eleitores')
        .select('*')
        .eq('id', parseInt(id))
        .single();

      if (error) {
        return res.status(404).json({ message: 'Eleitor não encontrado' });
      }

      const { data: vLids } = await supabase
        .from('eleitores_liderancas_mandatos')
        .select('mandato_id, lideranca_id, liderancas:lideranca_id(id, nome)')
        .eq('eleitor_id', parseInt(id));

      const liderancasPorMandato = {
        ESTADUAL: null,
        FEDERAL: null
      };

      (vLids || []).forEach((v) => {
        if (v.mandato_id === 1 && v.liderancas) {
          liderancasPorMandato.ESTADUAL = { id: v.liderancas.id, nome: v.liderancas.nome };
        } else if (v.mandato_id === 2 && v.liderancas) {
          liderancasPorMandato.FEDERAL = { id: v.liderancas.id, nome: v.liderancas.nome };
        }
      });

      return res.status(200).json({
        ...eleitor,
        liderancasPorMandato
      });
    }

    // PUT - Atualizar eleitor
    if (req.method === 'PUT') {
      const body = req.body || {};
      const normalizar = (value) => (value === '' ? null : value);

      const rawLiderancaId = body.lideranca_id || body.liderancaId;
      let liderancaIdFinal = rawLiderancaId && !isNaN(parseInt(rawLiderancaId)) ? parseInt(rawLiderancaId) : null;

      if (!liderancaIdFinal && body.lideranca) {
        const liderancaStr = String(body.lideranca).trim();
        if (liderancaStr && !isNaN(parseInt(liderancaStr))) {
          liderancaIdFinal = parseInt(liderancaStr);
        } else if (liderancaStr) {
          const { data: lidFound } = await supabase
            .from('liderancas')
            .select('id')
            .ilike('nome', liderancaStr)
            .limit(1)
            .maybeSingle();
          if (lidFound?.id) {
            liderancaIdFinal = lidFound.id;
          }
        }
      }

      // Validar pertencimento se fornecido
      if (body.pertencimento) {
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

        const pertencimentoSolicitado = String(body.pertencimento).toUpperCase();
        if (!['ESTADUAL', 'FEDERAL', 'AMBOS', 'NAO_CLASSIFICADO'].includes(pertencimentoSolicitado)) {
          return res.status(400).json({ message: 'Pertencimento inválido' });
        }

        const temEstadual = userMandates.includes(1);
        const temFederal = userMandates.includes(2);

        if (pertencimentoSolicitado === 'ESTADUAL' && !temEstadual) {
          return res.status(403).json({ message: 'Você não possui permissão para vincular eleitores ao mandato Estadual' });
        }
        if (pertencimentoSolicitado === 'FEDERAL' && !temFederal) {
          return res.status(403).json({ message: 'Você não possui permissão para vincular eleitores ao mandato Federal' });
        }
        if (pertencimentoSolicitado === 'AMBOS' && (!temEstadual || !temFederal)) {
          return res.status(403).json({ message: 'Você não possui permissão para vincular eleitores a ambos os mandatos' });
        }

        payload.pertencimento = pertencimentoSolicitado;
      }

      let { data: eleitor, error } = await supabase
        .from('eleitores')
        .update(payload)
        .eq('id', parseInt(id))
        .select()
        .single();

      // Compatibilidade com bancos que ainda nao possuem a coluna lideranca
      const erroColunaLideranca =
        error &&
        (String(error.message || '').toLowerCase().includes('lideranca') ||
          String(error.details || '').toLowerCase().includes('lideranca'));

      if (erroColunaLideranca) {
        const payloadSemLideranca = { ...payload };
        delete payloadSemLideranca.lideranca;
        const retry = await supabase
          .from('eleitores')
          .update(payloadSemLideranca)
          .eq('id', parseInt(id))
          .select()
          .single();
        eleitor = retry.data;
        error = retry.error;
      }

      if (error) {
        return res.status(400).json({ 
          message: 'Erro ao atualizar eleitor',
          error: error.message 
        });
      }

      // Criar/atualizar marcador de geolocalizacao
      if (eleitor?.latitude && eleitor?.longitude) {
        const enderecoBase = eleitor.logradouro || eleitor.endereco || '';
        const numero = eleitor.numero ? `, ${eleitor.numero}` : '';
        const complemento = eleitor.complemento ? ` ${eleitor.complemento}` : '';
        const endereco = `${enderecoBase}${numero}${complemento}`.trim();

        await supabase
          .from('geolocalizacao')
          .delete()
          .eq('tipo', 'ELEITOR')
          .eq('eleitor_id', eleitor.id);

        await supabase
          .from('geolocalizacao')
          .insert([{
            tipo: 'ELEITOR',
            nome: eleitor.nome,
            descricao: 'Eleitor',
            cidade: eleitor.cidade || null,
            bairro: eleitor.bairro || null,
            endereco: endereco || null,
            latitude: eleitor.latitude,
            longitude: eleitor.longitude,
            icon_color: '#14b8a6',
            icon_type: 'ELEITOR',
            eleitor_id: eleitor.id,
            status: eleitor.statusCadastro || eleitor.status || 'ATIVO',
            data_criacao: new Date().toISOString()
          }]);
      }

      // Sincronizar Lideranças por Mandato (Sprint P2.9)
      const pertenceAtual = eleitor.pertencimento || 'NAO_CLASSIFICADO';
      const lidEstadual = body.liderancaEstadualId !== undefined 
        ? (body.liderancaEstadualId ? parseInt(body.liderancaEstadualId) : null)
        : (body.liderancasPorMandato?.ESTADUAL?.id !== undefined ? (body.liderancasPorMandato.ESTADUAL ? parseInt(body.liderancasPorMandato.ESTADUAL.id) : null) : undefined);
      
      const lidFederal = body.liderancaFederalId !== undefined 
        ? (body.liderancaFederalId ? parseInt(body.liderancaFederalId) : null)
        : (body.liderancasPorMandato?.FEDERAL?.id !== undefined ? (body.liderancasPorMandato.FEDERAL ? parseInt(body.liderancasPorMandato.FEDERAL.id) : null) : undefined);

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

      // Travar eleitor NAO_CLASSIFICADO de receber liderança por mandato
      if ((lidEstadual || lidFederal) && pertenceAtual === 'NAO_CLASSIFICADO') {
        return res.status(400).json({ message: 'Classifique o pertencimento do eleitor antes de vincular lideranças por mandato' });
      }

      // Validação do Mandato Estadual
      if (lidEstadual !== undefined) {
        if (!userMandates.includes(1) && lidEstadual !== null) {
          return res.status(403).json({ message: 'Você não possui permissão para gerenciar a liderança Estadual deste eleitor' });
        }
        if (lidEstadual !== null) {
          if (pertenceAtual === 'FEDERAL') {
            return res.status(400).json({ message: 'Eleitor com pertencimento Federal não pode receber liderança Estadual' });
          }
          // Verificar se a liderança pertence ao Mandato Estadual
          const { data: lidM1 } = await supabase
            .from('liderancas_mandatos')
            .select('lideranca_id')
            .eq('lideranca_id', lidEstadual)
            .eq('mandato_id', 1)
            .maybeSingle();

          if (!lidM1) {
            return res.status(400).json({ message: 'A liderança selecionada não pertence ao mandato Estadual' });
          }

          // Inserir / Atualizar
          await supabase
            .from('eleitores_liderancas_mandatos')
            .upsert(
              { eleitor_id: eleitor.id, mandato_id: 1, lideranca_id: lidEstadual, updated_at: new Date().toISOString() },
              { onConflict: 'eleitor_id,mandato_id' }
            );
        } else {
          // Remover vinculo do Estadual
          await supabase
            .from('eleitores_liderancas_mandatos')
            .delete()
            .eq('eleitor_id', eleitor.id)
            .eq('mandato_id', 1);
        }
      }

      // Validação do Mandato Federal
      if (lidFederal !== undefined) {
        if (!userMandates.includes(2) && lidFederal !== null) {
          return res.status(403).json({ message: 'Você não possui permissão para gerenciar a liderança Federal deste eleitor' });
        }
        if (lidFederal !== null) {
          if (pertenceAtual === 'ESTADUAL') {
            return res.status(400).json({ message: 'Eleitor com pertencimento Estadual não pode receber liderança Federal' });
          }
          // Verificar se a liderança pertence ao Mandato Federal
          const { data: lidM2 } = await supabase
            .from('liderancas_mandatos')
            .select('lideranca_id')
            .eq('lideranca_id', lidFederal)
            .eq('mandato_id', 2)
            .maybeSingle();

          if (!lidM2) {
            return res.status(400).json({ message: 'A liderança selecionada não pertence ao mandato Federal' });
          }

          // Inserir / Atualizar
          await supabase
            .from('eleitores_liderancas_mandatos')
            .upsert(
              { eleitor_id: eleitor.id, mandato_id: 2, lideranca_id: lidFederal, updated_at: new Date().toISOString() },
              { onConflict: 'eleitor_id,mandato_id' }
            );
        } else {
          // Remover vinculo do Federal
          await supabase
            .from('eleitores_liderancas_mandatos')
            .delete()
            .eq('eleitor_id', eleitor.id)
            .eq('mandato_id', 2);
        }
      }

      // Se o pertencimento mudou para ESTADUAL, limpa automaticamente vínculo Federal para manter consistência
      if (body.pertencimento === 'ESTADUAL') {
        await supabase.from('eleitores_liderancas_mandatos').delete().eq('eleitor_id', eleitor.id).eq('mandato_id', 2);
      } else if (body.pertencimento === 'FEDERAL') {
        await supabase.from('eleitores_liderancas_mandatos').delete().eq('eleitor_id', eleitor.id).eq('mandato_id', 1);
      }

      return res.status(200).json(eleitor);
    }

    // DELETE - Deletar eleitor
    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('eleitores')
        .delete()
        .eq('id', parseInt(id));

      if (error) {
        return res.status(400).json({ 
          message: 'Erro ao deletar eleitor',
          error: error.message 
        });
      }

      return res.status(200).json({ message: 'Eleitor deletado com sucesso' });
    }

    return res.status(405).json({ message: 'Método não permitido' });
  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ 
      message: 'Erro interno do servidor',
      error: error.message 
    });
  }
}
