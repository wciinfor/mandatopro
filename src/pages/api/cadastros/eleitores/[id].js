import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

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

      return res.status(200).json(eleitor);
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
