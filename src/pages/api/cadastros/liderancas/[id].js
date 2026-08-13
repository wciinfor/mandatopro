import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterContextoMandato, validarAcessoRegistroPorId } from '@/lib/mandato-auth';

export const runtime = 'nodejs';

function parseId(rawId) {
  const id = Number.parseInt(String(rawId || ''), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return code === '42703' || code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
}

function getMissingColumn(message) {
  const text = String(message || '');
  let match = text.match(/Could not find the '(.+?)' column/i);
  if (match) return match[1];
  match = text.match(/column "(.+?)" does not exist/i);
  if (match) return match[1];
  return '';
}

const COLUNAS_OPCIONAIS_PUT = [
  'rg', 'dataNascimento', 'sexo', 'nomePai', 'nomeMae', 'naturalidade',
  'estadoCivil', 'profissao', 'foto', 'areaAtuacao', 'area_atuacao',
  'projecao_votos', 'municipio', 'bairro',
];

export default async function handler(req, res) {
  const id = parseId(req.query?.id);
  if (!id) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  const supabase = createServerClient();
  let usuarioObj = null;
  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);
    usuarioObj = usuario;
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Erro interno' });
  }

  const contextoMandato = await obterContextoMandato(req, usuarioObj, supabase);
  const valAcc = await validarAcessoRegistroPorId('LIDERANCA', id, contextoMandato, supabase);
  if (!valAcc.autorizado) {
    return res.status(valAcc.status).json({ message: valAcc.message });
  }

  // GET — buscar liderança por ID
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('liderancas')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return res.status(404).json({ message: 'Liderança não encontrada', error: error?.message });
      }

      // Buscar mandatos vinculados
      const { data: vinculos } = await supabase
        .from('liderancas_mandatos')
        .select('mandato_id')
        .eq('lideranca_id', id);

      const mandatos = (vinculos || []).map(v => v.mandato_id);

      return res.status(200).json({
        ...data,
        mandatos
      });
    } catch (error) {
      return res.status(500).json({ message: 'Erro interno', error: error.message });
    }
  }

  // PUT — atualizar liderança
  if (req.method === 'PUT') {
    try {
      const body = req.body || {};
      const norm = (v) => (v === '' || v === undefined ? null : v);

      // Se informou mandatos, realizar a validação de autorização no backend
      let novosMandatos = null;
      if (Object.prototype.hasOwnProperty.call(body, 'mandatos')) {
        novosMandatos = Array.isArray(body.mandatos) ? body.mandatos.map(Number).filter(Boolean) : [];
        if (novosMandatos.length === 0) {
          return res.status(400).json({ message: 'Selecione ao menos um mandato para a liderança' });
        }

        // Obter mandatos autorizados do usuário
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

        const naoAutorizado = novosMandatos.some(mId => !userMandates.includes(mId));
        if (naoAutorizado) {
          return res.status(403).json({ message: 'Você não possui permissão para vincular a liderança ao mandato solicitado' });
        }
      }

      const payload = {
        nome: norm(body.nome),
        cpf: norm(body.cpf),
        email: norm(body.email),
        telefone: norm(body.telefone || body.celular),
        endereco: norm(body.endereco || body.logradouro),
        estado: norm(body.estado || body.uf),
        municipio: norm(body.municipio),
        bairro: norm(body.bairro),
        influencia: norm(body.influencia) || 'MÉDIA',
        area_atuacao: norm(body.areaAtuacao || body.area_atuacao),
        areaAtuacao: norm(body.areaAtuacao || body.area_atuacao),
        status: norm(body.status) || 'ATIVO',
        observacoes: norm(body.observacoes),
        rg: norm(body.rg),
        dataNascimento: norm(body.dataNascimento),
        sexo: norm(body.sexo),
        nomePai: norm(body.nomePai),
        nomeMae: norm(body.nomeMae),
        naturalidade: norm(body.naturalidade),
        estadoCivil: norm(body.estadoCivil),
        profissao: norm(body.profissao),
        foto: norm(body.foto),
        projecao_votos: body.projecaoVotos ?? body.projecao_votos ?? 0,
        updated_at: new Date().toISOString(),
      };

      const atualizar = (p) =>
        supabase.from('liderancas').update(p).eq('id', id).select().single();

      let payloadAtual = { ...payload };
      let result = await atualizar(payloadAtual);

      for (let i = 0; i < COLUNAS_OPCIONAIS_PUT.length && result.error; i += 1) {
        if (!isMissingColumnError(result.error)) break;
        const col = getMissingColumn(result.error.message);
        if (!col || !(col in payloadAtual)) break;
        const next = { ...payloadAtual };
        delete next[col];
        payloadAtual = next;
        result = await atualizar(payloadAtual);
      }

      const { data, error } = result;

      if (error) {
        return res.status(400).json({ message: error.message, error: error.message, code: error.code });
      }

      // Sincronizar vínculos em liderancas_mandatos se informados no body
      let mandatosFinais = [];
      if (novosMandatos !== null) {
        await supabase.from('liderancas_mandatos').delete().eq('lideranca_id', id);
        const vinculosPayload = novosMandatos.map(mandato_id => ({
          lideranca_id: id,
          mandato_id
        }));
        await supabase.from('liderancas_mandatos').insert(vinculosPayload);
        mandatosFinais = novosMandatos;
      } else {
        const { data: vinculosExistentes } = await supabase
          .from('liderancas_mandatos')
          .select('mandato_id')
          .eq('lideranca_id', id);
        mandatosFinais = (vinculosExistentes || []).map(v => v.mandato_id);
      }

      return res.status(200).json({
        ...data,
        mandatos: mandatosFinais
      });
    } catch (error) {
      return res.status(500).json({ message: 'Erro interno', error: error.message });
    }
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  // DELETE — excluir liderança
  try {
    const { data: liderancaAtual, error: erroBusca } = await supabase
      .from('liderancas')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (erroBusca) {
      return res.status(400).json({ message: 'Erro ao buscar liderança', error: erroBusca.message });
    }

    if (!liderancaAtual) {
      return res.status(404).json({ message: 'Liderança não encontrada' });
    }

    const { error: erroDesvincularEleitores } = await supabase
      .from('eleitores')
      .update({
        lideranca_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('lideranca_id', id);

    if (erroDesvincularEleitores && !isMissingColumnError(erroDesvincularEleitores)) {
      return res.status(400).json({
        message: 'Erro ao desvincular eleitores da liderança',
        error: erroDesvincularEleitores.message
      });
    }

    const { error: erroGeolocalizacao } = await supabase
      .from('geolocalizacao')
      .delete()
      .eq('lideranca_id', id);

    if (erroGeolocalizacao && !isMissingColumnError(erroGeolocalizacao)) {
      return res.status(400).json({
        message: 'Erro ao remover geolocalização da liderança',
        error: erroGeolocalizacao.message
      });
    }

    const { error: erroDelete } = await supabase
      .from('liderancas')
      .delete()
      .eq('id', id);

    if (erroDelete) {
      return res.status(400).json({
        message: 'Erro ao excluir liderança',
        error: erroDelete.message
      });
    }

    return res.status(200).json({
      message: 'Liderança excluída com sucesso',
      data: { id }
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Erro interno do servidor',
      error: error?.message || 'Erro desconhecido'
    });
  }
}
