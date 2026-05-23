import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

function parseNumber(value, fallback = null) {
  if (value === '' || value === null || value === undefined) {
    return fallback;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizarPayload(body = {}) {
  return {
    numero: body.numero,
    tipo: body.tipo,
    autor: body.autor,
    orgao: body.orgao,
    responsavel: body.responsavel || null,
    finalidade: body.finalidade,
    valorEmpenhado: parseNumber(body.valorEmpenhado),
    valorExecutado: parseNumber(body.valorExecutado, 0),
    dataEmpenho: body.dataEmpenho || null,
    dataVencimento: body.dataVencimento || null,
    status: body.status || 'PENDENTE',
    observacoes: body.observacoes || null,
    updated_at: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  const { id } = req.query;
  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    if (!id) {
      return res.status(400).json({ message: 'ID obrigatorio' });
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('emendas')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return res.status(200).json({ data });
    }

    if (req.method === 'PUT') {
      const payload = normalizarPayload(req.body || {});

      if (!payload.numero || !payload.tipo || !payload.autor || !payload.orgao || !payload.finalidade || payload.valorEmpenhado === null) {
        return res.status(400).json({ message: 'Numero, tipo, autor, orgao, finalidade e valor empenhado sao obrigatorios' });
      }

      const { data, error } = await supabase
        .from('emendas')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ data });
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('emendas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ message: 'Metodo nao permitido' });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Erro interno' });
  }
}
