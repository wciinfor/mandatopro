import { createServerClient } from '@/lib/supabase-server';

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
 * Conta eleitores cadastrados por dia usando queries COUNT individuais.
 * Muito mais eficiente que baixar todos os registros: são apenas `days` queries leves.
 */
async function fetchEleitoresPorDia(supabase, inicioEleitores, days) {
  const tarefas = Array.from({ length: days }, (_, i) => {
    const dia = new Date(inicioEleitores);
    dia.setDate(dia.getDate() + i);

    const diaInicio = new Date(dia);
    diaInicio.setHours(0, 0, 0, 0);

    const diaFim = new Date(dia);
    diaFim.setHours(23, 59, 59, 999);

    const label = formatDateKeyLocal(diaInicio);

    return supabase
      .from('eleitores')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', diaInicio.toISOString())
      .lte('created_at', diaFim.toISOString())
      .then(({ count, error }) => {
        if (error) throw error;
        return { label, value: count || 0 };
      });
  });

  return Promise.all(tarefas);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const days = Math.max(parseInt(req.query.days || '7', 10), 1);

    const hoje = new Date();
    const inicioEleitores = new Date();
    inicioEleitores.setHours(0, 0, 0, 0);
    inicioEleitores.setDate(inicioEleitores.getDate() - (days - 1));

    const mesAtualInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const mesAtualFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    mesAtualFim.setHours(23, 59, 59, 999);

    const [eleitoresSeries, campanhasData] = await Promise.all([
      fetchEleitoresPorDia(supabase, inicioEleitores, days),
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
