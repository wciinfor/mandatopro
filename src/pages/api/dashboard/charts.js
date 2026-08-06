import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return code === '42703' || code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
}

function parseDateSafe(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getCampanhaDate(campanha) {
  return campanha?.data_campanha || campanha?.dataCampanha || campanha?.data || null;
}

async function fetchCampanhasMes(supabase, mesAtualInicio, mesAtualFim) {
  const mesInicioKey = formatDateKeyLocal(mesAtualInicio);
  const mesFimKey = formatDateKeyLocal(mesAtualFim);

  const principal = await supabase
    .from('campanhas')
    .select('id, data_campanha, status')
    .gte('data_campanha', mesInicioKey)
    .lte('data_campanha', mesFimKey);

  if (!principal.error) {
    return principal.data || [];
  }

  if (!isMissingColumnError(principal.error)) {
    throw principal.error;
  }

  const tentativas = ['id, dataCampanha, status', 'id, data, status', '*'];

  for (const selectClause of tentativas) {
    const fallback = await supabase
      .from('campanhas')
      .select(selectClause);

    if (fallback.error) {
      if (!isMissingColumnError(fallback.error)) {
        throw fallback.error;
      }
      continue;
    }

    return (fallback.data || []).filter((campanha) => {
      const dataKey = extractDateKey(getCampanhaDate(campanha));
      if (!dataKey) return false;
      return dataKey >= mesInicioKey && dataKey <= mesFimKey;
    });
  }

  return [];
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDateKeyLocal(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function extractDateKey(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }

  const parsed = parseDateSafe(value);
  if (!parsed) {
    return null;
  }

  return formatDateKeyLocal(parsed);
}

function buildDateSeries(startDate, length) {
  const labels = [];
  for (let i = 0; i < length; i += 1) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    labels.push(formatDateKeyLocal(d));
  }
  return labels;
}

/**
 * Busca eleitores criados no período em UMA ÚNICA CONSULTA e agrupa por dia em memória.
 * Elimina o N+1 de `days` consultas COUNT.
 */
async function fetchEleitoresSeries(supabase, inicioEleitores, fimEleitores, labels) {
  const { data, error } = await supabase
    .from('eleitores')
    .select('created_at')
    .gte('created_at', inicioEleitores.toISOString())
    .lte('created_at', fimEleitores.toISOString());

  if (error) {
    console.warn('Erro ao buscar eleitores para gráficos:', error.message);
    return labels.map((label) => ({ label, value: 0 }));
  }

  const contagem = {};
  labels.forEach((label) => {
    contagem[label] = 0;
  });

  (data || []).forEach((item) => {
    const key = extractDateKey(item.created_at);
    if (key && contagem[key] !== undefined) {
      contagem[key] += 1;
    }
  });

  return labels.map((label) => ({
    label,
    value: contagem[label] || 0
  }));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);
    const days = Math.max(parseInt(req.query.days || '7', 10), 1);

    const hoje = new Date();
    const inicioEleitores = new Date();
    inicioEleitores.setHours(0, 0, 0, 0);
    inicioEleitores.setDate(inicioEleitores.getDate() - (days - 1));

    const fimEleitores = new Date();
    fimEleitores.setHours(23, 59, 59, 999);

    const mesAtualInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const mesAtualFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    mesAtualFim.setHours(23, 59, 59, 999);

    const labelsEleitores = buildDateSeries(inicioEleitores, days);

    // Executa apenas 2 consultas SQL no banco em paralelo (1 para eleitores, 1 para campanhas)
    const [eleitoresSeries, campanhasData] = await Promise.all([
      fetchEleitoresSeries(supabase, inicioEleitores, fimEleitores, labelsEleitores),
      fetchCampanhasMes(supabase, mesAtualInicio, mesAtualFim)
    ]);

    const diasNoMes = mesAtualFim.getDate();
    const labelsCampanhas = buildDateSeries(mesAtualInicio, diasNoMes);
    const countsCampanhas = labelsCampanhas.reduce((acc, label) => {
      acc[label] = 0;
      return acc;
    }, {});

    (campanhasData || []).forEach((campanha) => {
      const key = extractDateKey(getCampanhaDate(campanha));
      if (!key) return;

      if (countsCampanhas[key] !== undefined) {
        countsCampanhas[key] += 1;
      }
    });

    const campanhasSeries = labelsCampanhas.map((label) => ({
      label,
      value: countsCampanhas[label] || 0
    }));

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

    return res.status(200).json({
      eleitoresSeries,
      campanhasSeries
    });
  } catch (error) {
    console.error('Erro ao buscar dados de graficos do dashboard:', error);
    return res.status(500).json({ error: 'Erro ao buscar dados do dashboard' });
  }
}
