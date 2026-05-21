import { createServerClient } from '@/lib/supabase-server';

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
  if (req.method === 'GET') {
    try {
      const supabase = createServerClient();
      const { search, status, limit = 200, offset = 0 } = req.query;

      let query = supabase
        .from('liderancas')
        .select('*', { count: 'exact' });

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

    return res.status(201).json(lideranca);
  } catch (error) {
    console.error('[POST /api/cadastros/liderancas]', error);
    return res.status(500).json({
      message: 'Erro interno do servidor',
      error: error.message,
    });
  }
}
