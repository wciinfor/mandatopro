import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterContextoMandato } from '@/lib/mandato-auth';

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

function normalizarPayload(body = {}, mandatoId) {
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
    mandato_id: mandatoId
  };
}

export default async function handler(req, res) {
  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const contextoMandato = await obterContextoMandato(req, usuario, supabase);
    const { mandatoId } = contextoMandato;

    if (req.method === 'GET') {
      let query = supabase
        .from('repasses')
        .select('*')
        .order('dataPrevista', { ascending: true });

      if (mandatoId === 1) {
        query = query.or('mandato_id.eq.1,mandato_id.is.null');
      } else {
        query = query.eq('mandato_id', mandatoId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return res.status(200).json({ data: data || [] });
    }

    if (req.method === 'POST') {
      const payload = normalizarPayload(req.body || {}, mandatoId);

      if (!payload.codigo || !payload.emenda || payload.valor === null || !payload.dataPrevista) {
        return res.status(400).json({ message: 'Codigo, emenda, valor e data prevista sao obrigatorios' });
      }

      const { data, error } = await supabase
        .from('repasses')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ data });
    }

    return res.status(405).json({ message: 'Metodo nao permitido' });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Erro interno' });
  }
}
