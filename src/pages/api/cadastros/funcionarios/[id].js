import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const COLUNAS_OPCIONAIS = [
  'dataAdmissao', 'salario', 'cargaHoraria', 'tipoContrato',
  'observacoes', 'foto', 'rg', 'dataNascimento', 'sexo', 'nomePai', 'nomeMae',
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
  const { id } = req.query;

  if (!id) return res.status(400).json({ message: 'ID obrigatório' });

  // GET — buscar funcionário por id
  if (req.method === 'GET') {
    try {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('funcionarios')
        .select('*')
        .eq('id', parseInt(id))
        .single();

      if (error) return res.status(404).json({ message: 'Funcionário não encontrado' });
      return res.status(200).json({ data });
    } catch (error) {
      return res.status(500).json({ message: 'Erro interno', error: error.message });
    }
  }

  // PUT — atualizar funcionário
  if (req.method === 'PUT') {
    try {
      const supabase = createServerClient();
      const body = req.body || {};
      const norm = (v) => (v === '' || v === undefined ? null : v);

      const payload = {
        cargo: norm(body.cargo),
        departamento: norm(body.departamento),
        dataAdmissao: norm(body.dataAdmissao),
        salario: body.salario ? parseFloat(body.salario) : null,
        cargaHoraria: body.cargaHoraria ? parseInt(body.cargaHoraria) : 40,
        tipoContrato: norm(body.tipoContrato) || 'CLT',
        status: norm(body.status) || 'ATIVO',
        observacoes: norm(body.observacoes),
        foto: norm(body.foto),
      };

      const atualizar = (p) =>
        supabase.from('funcionarios').update(p).eq('id', parseInt(id)).select().single();

      let payloadAtual = { ...payload };
      let result = await atualizar(payloadAtual);

      for (let i = 0; i < COLUNAS_OPCIONAIS.length && result.error; i += 1) {
        if (!isMissingColumnError(result.error)) break;
        const col = getMissingColumn(result.error.message);
        if (!col) break;
        // Segurança: só remove colunas que são explicitamente opcionais.
        const isOptional = COLUNAS_OPCIONAIS.some(c => c.toLowerCase() === col.toLowerCase());
        if (!isOptional) break;
        const realKey = findPayloadKey(payloadAtual, col);
        if (!realKey) break;
        const next = { ...payloadAtual };
        delete next[realKey];
        payloadAtual = next;
        result = await atualizar(payloadAtual);
      }

      const { data, error } = result;
      if (error) return res.status(400).json({ message: error.message, code: error.code });
      return res.status(200).json(data || { success: true });
    } catch (error) {
      console.error('[PUT /api/cadastros/funcionarios/[id]]', error);
      return res.status(500).json({ message: 'Erro interno', error: error.message });
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
