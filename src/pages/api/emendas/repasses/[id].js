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

function parseInteger(value, fallback = 1) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizarPayload(body = {}) {
  return {
    codigo: body.codigo,
    emenda: body.emenda,
    parcela: parseInteger(body.parcela),
    totalParcelas: parseInteger(body.totalParcelas),
    valor: parseNumber(body.valor),
    dataPrevista: body.dataPrevista || null,
    dataEfetivada: body.dataEfetivada || null,
    orgao: body.orgao || null,
    responsavel: body.responsavel || null,
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
        .from('repasses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return res.status(200).json({ data });
    }

    if (req.method === 'PUT') {
      const payload = normalizarPayload(req.body || {});

      if (!payload.codigo || !payload.emenda || payload.valor === null || !payload.dataPrevista) {
        return res.status(400).json({ message: 'Codigo, emenda, valor e data prevista sao obrigatorios' });
      }

      const { data, error } = await supabase
        .from('repasses')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ data });
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('repasses')
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
