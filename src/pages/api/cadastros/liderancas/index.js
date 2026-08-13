import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterContextoMandato } from '@/lib/mandato-auth';

export const runtime = 'nodejs';

const COLUNAS_OPCIONAIS = [
  'rg', 'dataNascimento', 'sexo', 'nomePai', 'nomeMae', 'naturalidade',
  'estadoCivil', 'profissao', 'foto', 'areaAtuacao', 'area_atuacao',
  'projecao_votos', 'municipio', 'bairro', 'complemento', 'logradouro', 'uf',
];

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    message.includes('column') ||
    message.includes('schema cache') ||
    message.includes('could not find')
  );
}

function getMissingColumn(message) {
  const text = String(message || '');
  let match = text.match(/Could not find the '(.+?)' column/i);
  if (match) return match[1];
  match = text.match(/column "(.+?)" does not exist/i);
  if (match) return match[1];
  return '';
}

export default async function handler(req, res) {
  const authSupabase = createServerClient();
  let usuarioObj = null;
  try {
    const { usuario } = await obterUsuarioAutenticado(req, authSupabase);
    exigirUsuario(usuario);
    usuarioObj = usuario;
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Erro interno' });
  }

  if (req.method === 'GET') {
    try {
      const supabase = createServerClient();
      const contextoMandato = await obterContextoMandato(req, usuarioObj, supabase);
      const { search, status, limit = 200, offset = 0 } = req.query;

      const { data: lmData } = await supabase
        .from('liderancas_mandatos')
        .select('lideranca_id')
        .eq('mandato_id', contextoMandato.mandatoId);
      const idsLid = (lmData || []).map(l => l.lideranca_id);

      if (!idsLid.length) {
        return res.status(200).json({ data: [], total: 0 });
      }

      let query = supabase
        .from('liderancas')
        .select('*', { count: 'exact' })
        .in('id', idsLid);

      if (status) {
        query = query.ilike('status', status);
      }
      if (search && search.trim()) {
        const q = search.trim().replace(/[,()'"]/g, '');
        query = query.ilike('nome', `%${q}%`);
      }

      const { data, count, error } = await query
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
        .order('nome', { ascending: true });

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      return res.status(200).json({ data: data || [], total: count ?? 0 });
    } catch (error) {
      console.error('[GET /api/cadastros/liderancas]', error);
      return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const supabase = createServerClient();
    const body = req.body || {};
    const norm = (v) => (v === '' || v === undefined ? null : v);

    // Obter mandatos do usuário autenticado para validação de autorização
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

    // Processar e validar os mandatos solicitados para a liderança
    const rawMandatos = Array.isArray(body.mandatos) ? body.mandatos.map(Number).filter(Boolean) : [1];
    if (rawMandatos.length === 0) {
      return res.status(400).json({ message: 'Selecione ao menos um mandato para a liderança' });
    }

    // Verificar se o usuário possui autorização para todos os mandatos solicitados
    const naoAutorizado = rawMandatos.some(mId => !userMandates.includes(mId));
    if (naoAutorizado) {
      return res.status(403).json({ message: 'Você não possui permissão para vincular a liderança ao mandato solicitado' });
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
    };

    // Tenta inserir; se retornar erro de coluna inexistente, remove a coluna
    // e tenta novamente (compatibilidade com schemas em estágios de migração).
    const inserir = (p) =>
      supabase.from('liderancas').insert([p]).select().single();

    let payloadAtual = { ...payload };
    let result = await inserir(payloadAtual);

    for (let i = 0; i < COLUNAS_OPCIONAIS.length && result.error; i += 1) {
      if (!isMissingColumnError(result.error)) break;
      const col = getMissingColumn(result.error.message);
      if (!col || !(col in payloadAtual)) break;
      const next = { ...payloadAtual };
      delete next[col];
      payloadAtual = next;
      result = await inserir(payloadAtual);
    }

    const { data: lideranca, error } = result;

    if (error) {
      return res.status(400).json({
        message: error.message || 'Erro ao criar liderança',
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    }

    // Inserir relacionamentos na tabela liderancas_mandatos
    const vinculosPayload = rawMandatos.map(mandato_id => ({
      lideranca_id: lideranca.id,
      mandato_id
    }));
    await supabase.from('liderancas_mandatos').insert(vinculosPayload);

    return res.status(201).json({
      ...lideranca,
      mandatos: rawMandatos
    });
  } catch (error) {
    console.error('[POST /api/cadastros/liderancas]', error);
    return res.status(500).json({
      message: 'Erro interno do servidor',
      error: error.message,
    });
  }
}
