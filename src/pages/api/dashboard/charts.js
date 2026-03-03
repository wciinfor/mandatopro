import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

function formatDateKey(date) {
  return date.toISOString().split('T')[0];
}

function buildDateSeries(startDate, length) {
  const labels = [];
  for (let i = 0; i < length; i += 1) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    labels.push(formatDateKey(d));
  }
  return labels;
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

    const [eleitoresResp, campanhasResp] = await Promise.all([
      supabase
        .from('eleitores')
        .select('created_at')
        .gte('created_at', inicioEleitores.toISOString()),
      supabase
        .from('campanhas')
        .select('id, data_campanha, status')
        .in('status', ['PLANEJAMENTO', 'EXECUCAO'])
        .gte('data_campanha', mesAtualInicio.toISOString())
        .lte('data_campanha', mesAtualFim.toISOString())
    ]);

    if (eleitoresResp.error) throw eleitoresResp.error;
    if (campanhasResp.error) throw campanhasResp.error;

    const labelsEleitores = buildDateSeries(inicioEleitores, days);
    const countsEleitores = labelsEleitores.reduce((acc, label) => {
      acc[label] = 0;
      return acc;
    }, {});

    (eleitoresResp.data || []).forEach((item) => {
      if (!item?.created_at) return;
      const key = formatDateKey(new Date(item.created_at));
      if (countsEleitores[key] !== undefined) {
        countsEleitores[key] += 1;
      }
    });

    const eleitoresSeries = labelsEleitores.map((label) => ({
      label,
      value: countsEleitores[label] || 0
    }));

    const diasNoMes = mesAtualFim.getDate();
    const labelsCampanhas = buildDateSeries(mesAtualInicio, diasNoMes);
    const countsCampanhas = labelsCampanhas.reduce((acc, label) => {
      acc[label] = 0;
      return acc;
    }, {});

    (campanhasResp.data || []).forEach((campanha) => {
      if (!campanha?.data_campanha) return;
      const key = formatDateKey(new Date(campanha.data_campanha));
      if (countsCampanhas[key] !== undefined) {
        countsCampanhas[key] += 1;
      }
    });

    const campanhasSeries = labelsCampanhas.map((label) => ({
      label,
      value: countsCampanhas[label] || 0
    }));

    return res.status(200).json({
      eleitoresSeries,
      campanhasSeries
    });
  } catch (error) {
    console.error('Erro ao buscar dados de graficos do dashboard:', error);
    return res.status(500).json({ error: 'Erro ao buscar dados do dashboard' });
  }
}
