import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

const COLUNAS_OPCIONAIS = [
  'eleitor_id', 'foto',
  'dataAdmissao', 'salario', 'cargaHoraria', 'tipoContrato', 'matricula',
  'observacoes', 'rg', 'dataNascimento', 'sexo', 'nomePai', 'nomeMae',
  'naturalidade', 'estadoCivil', 'profissao', 'logradouro', 'complemento',
  'uf', 'pis', 'ctps', 'banco', 'agencia', 'conta', 'tipoConta', 'pix',
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

// Busca a chave real no payload de forma case-insensitive.
// Necessário porque o PostgreSQL lowercasa nomes de colunas em mensagens de erro 42703.
function findPayloadKey(payload, col) {
  if (col in payload) return col;
  const lower = col.toLowerCase();
  return Object.keys(payload).find(k => k.toLowerCase() === lower) || '';
}

export default async function handler(req, res) {
  // Instanciar dentro do handler para que erros de configuração
  // sejam capturados pelo try/catch de cada método.
  let supabase;
  try {
    supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);
  } catch (err) {
    const status = err?.statusCode || 500;
    return res.status(status).json({ message: err.message });
  }

  // GET — listar funcionários ou gerar próxima matrícula
  if (req.method === 'GET') {
    try {
      const { search, status, limit = 100, offset = 0, nextMatricula } = req.query;

      // Retornar apenas a próxima matrícula disponível
      if (nextMatricula === '1') {
        const { data: lastFunc } = await supabase
          .from('funcionarios')
          .select('matricula')
          .not('matricula', 'is', null)
          .order('matricula', { ascending: false })
          .limit(1)
          .single();

        const lastNum = lastFunc?.matricula
          ? parseInt(String(lastFunc.matricula).replace(/\D/g, '')) || 0
          : 0;
        const next = `FUNC-${String(lastNum + 1).padStart(4, '0')}`;
        return res.status(200).json({ matricula: next });
      }

      let query = supabase
        .from('funcionarios')
        .select('*', { count: 'exact' });

      if (status) query = query.ilike('status', status);
      if (search && search.trim()) {
        const q = search.trim().replace(/[,()'"]/g, '');
        query = query.ilike('nome', `%${q}%`);
      }

      const { data, count, error } = await query
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
        .order('id', { ascending: false });

      if (error) return res.status(400).json({ message: error.message });

      return res.status(200).json({ data: data || [], total: count ?? 0 });
    } catch (error) {
      return res.status(500).json({ message: 'Erro interno', error: error.message });
    }
  }

  // POST — criar funcionário
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const norm = (v) => (v === '' || v === undefined ? null : v);

      // Gerar matrícula sequencial automática
      const { data: lastFunc } = await supabase
        .from('funcionarios')
        .select('matricula')
        .not('matricula', 'is', null)
        .order('matricula', { ascending: false })
        .limit(1)
        .single();

      const lastNum = lastFunc?.matricula
        ? parseInt(String(lastFunc.matricula).replace(/\D/g, '')) || 0
        : 0;
      const nextMatricula = `FUNC-${String(lastNum + 1).padStart(4, '0')}`;

      const payload = {
        eleitor_id: body.eleitor_id ? parseInt(body.eleitor_id) : null,
        nome: norm(body.nome),
        cpf: norm(body.cpf),
        email: norm(body.email),
        telefone: norm(body.telefone),
        cargo: norm(body.cargo),
        departamento: norm(body.departamento),
        dataAdmissao: norm(body.dataAdmissao),
        salario: body.salario ? parseFloat(body.salario) : null,
        cargaHoraria: body.cargaHoraria ? parseInt(body.cargaHoraria) : 40,
        tipoContrato: norm(body.tipoContrato) || 'CLT',
        matricula: nextMatricula,
        status: norm(body.status) || 'ATIVO',
        observacoes: norm(body.observacoes),
      };

      const inserir = (p) =>
        supabase.from('funcionarios').insert([p]).select().single();

      let payloadAtual = { ...payload };
      let result = await inserir(payloadAtual);

      for (let i = 0; i < COLUNAS_OPCIONAIS.length && result.error; i += 1) {
        if (!isMissingColumnError(result.error)) break;
        const col = getMissingColumn(result.error.message);
        if (!col) break;
        // Segurança: só remove colunas que são explicitamente opcionais.
        // Colunas obrigatórias (nome, cpf, telefone etc.) nunca devem ser stripadas.
        const isOptional = COLUNAS_OPCIONAIS.some(c => c.toLowerCase() === col.toLowerCase());
        if (!isOptional) break;
        const realKey = findPayloadKey(payloadAtual, col);
        if (!realKey) break;
        const next = { ...payloadAtual };
        delete next[realKey];
        payloadAtual = next;
        result = await inserir(payloadAtual);
      }

      const { data, error } = result;

      if (error) {
        return res.status(400).json({
          message: error.message || 'Erro ao criar funcionário',
          code: error.code,
          details: error.details,
          payload_keys: Object.keys(payloadAtual),
        });
      }

      return res.status(201).json(data);
    } catch (error) {
      console.error('[POST /api/cadastros/funcionarios]', error);
      return res.status(500).json({ message: 'Erro interno', error: error.message });
    }
  }

  // DELETE — excluir funcionário
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ message: 'ID obrigatório' });

      const { error } = await supabase
        .from('funcionarios')
        .delete()
        .eq('id', parseInt(id));

      if (error) return res.status(400).json({ message: error.message });
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: 'Erro interno', error: error.message });
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
