import { createServerClient } from '@/lib/supabase-server';
import { gerarTraceId, obterUsuarioHeader, exigirAdmin } from '@/lib/financeiro-utils';

export const runtime = 'nodejs';

function toDateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  const traceId = gerarTraceId();

  try {
    const usuario = obterUsuarioHeader(req);
    exigirAdmin(usuario);

    const supabase = createServerClient();
    const { tipo, data_from, data_to } = req.query;

    let receitasQuery = supabase
      .from('financeiro_lancamentos')
      .select('categoria, valor, data_lancamento, status')
      .eq('ativo', true);

    let despesasQuery = supabase
      .from('financeiro_despesas')
      .select('categoria, valor, data_despesa, status')
      .eq('ativo', true);

    if (data_from) {
      receitasQuery = receitasQuery.gte('data_lancamento', data_from);
      despesasQuery = despesasQuery.gte('data_despesa', data_from);
    }
    if (data_to) {
      receitasQuery = receitasQuery.lte('data_lancamento', data_to);
      despesasQuery = despesasQuery.lte('data_despesa', data_to);
    }

    const [{ data: receitas, error: receitasError }, { data: despesas, error: despesasError }] = await Promise.all([
      receitasQuery,
      despesasQuery
    ]);

    if (receitasError || despesasError) {
      return res.status(400).json({
        message: receitasError?.message || despesasError?.message || 'Erro ao consultar dados',
        traceId
      });
    }

    const receitasValidas = (receitas || []).filter((item) => item.status !== 'CANCELADO');
    const despesasValidas = (despesas || []).filter((item) => item.status !== 'CANCELADO');

    const tipoRelatorio = String(tipo || 'totais_periodo').toLowerCase();

    if (tipoRelatorio === 'por_categoria') {
      const map = new Map();

      receitasValidas.forEach((item) => {
        const key = item.categoria || 'Sem categoria';
        const current = map.get(key) || { categoria: key, entradas: 0, saidas: 0 };
        current.entradas += Number(item.valor || 0);
        map.set(key, current);
      });

      despesasValidas.forEach((item) => {
        const key = item.categoria || 'Sem categoria';
        const current = map.get(key) || { categoria: key, entradas: 0, saidas: 0 };
        current.saidas += Number(item.valor || 0);
        map.set(key, current);
      });

      const data = Array.from(map.values()).map((item) => ({
        ...item,
        saldo: item.entradas - item.saidas
      }));

      return res.status(200).json({ data, traceId });
    }

    if (tipoRelatorio === 'fluxo_caixa') {
      const map = new Map();

      receitasValidas.forEach((item) => {
        const key = toDateKey(item.data_lancamento);
        const current = map.get(key) || { data: key, entradas: 0, saidas: 0 };
        current.entradas += Number(item.valor || 0);
        map.set(key, current);
      });

      despesasValidas.forEach((item) => {
        const key = toDateKey(item.data_despesa);
        const current = map.get(key) || { data: key, entradas: 0, saidas: 0 };
        current.saidas += Number(item.valor || 0);
        map.set(key, current);
      });

      const data = Array.from(map.values())
        .map((item) => ({
          ...item,
          saldo: item.entradas - item.saidas
        }))
        .sort((a, b) => (a.data > b.data ? 1 : -1));

      return res.status(200).json({ data, traceId });
    }

    const totalReceitas = receitasValidas.reduce((acc, item) => acc + Number(item.valor || 0), 0);
    const totalDespesas = despesasValidas.reduce((acc, item) => acc + Number(item.valor || 0), 0);

    return res.status(200).json({
      data: {
        total_receitas: totalReceitas,
        total_despesas: totalDespesas,
        saldo_liquido: totalReceitas - totalDespesas
      },
      traceId
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Erro interno', traceId });
  }
}
