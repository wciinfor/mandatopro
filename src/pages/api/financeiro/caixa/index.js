import { createServerClient } from '@/lib/supabase-server';
import { gerarTraceId, obterUsuarioHeader, exigirAdmin, parsePaginacao } from '@/lib/financeiro-utils';

export const runtime = 'nodejs';

function sumBy(arr, field) {
  return arr.reduce((acc, item) => acc + Number(item?.[field] || 0), 0);
}

export default async function handler(req, res) {
  const traceId = gerarTraceId();

  try {
    const usuario = obterUsuarioHeader(req);
    exigirAdmin(usuario);

    const supabase = createServerClient();
    const { data_from, data_to } = req.query;
    const { limit, offset } = parsePaginacao(req.query, 20, 200);

    let receitasQuery = supabase
      .from('financeiro_lancamentos')
      .select('valor, status, data_lancamento')
      .eq('ativo', true);

    let despesasQuery = supabase
      .from('financeiro_despesas')
      .select('valor, status, data_despesa')
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
    const totalReceitas = sumBy(receitasValidas, 'valor');
    const totalDespesas = sumBy(despesasValidas, 'valor');
    const saldoLiquido = totalReceitas - totalDespesas;
    const pendenteReceitas = (receitas || []).filter((item) => item.status === 'PENDENTE');
    const pendenteDespesas = (despesas || []).filter((item) => item.status === 'PENDENTE');
    const totalPendente = sumBy(pendenteReceitas, 'valor') + sumBy(pendenteDespesas, 'valor');

    let movimentoQuery = supabase
      .from('financeiro_movimentacoes')
      .select('*')
      .order('data_movimento', { ascending: true });

    if (data_from) movimentoQuery = movimentoQuery.gte('data_movimento', data_from);
    if (data_to) movimentoQuery = movimentoQuery.lte('data_movimento', data_to);

    const { data: movimentosRaw, error: movError } = await movimentoQuery;
    if (movError) {
      return res.status(400).json({ message: movError.message, traceId });
    }

    const movimentos = (movimentosRaw || []).map((item) => ({
      ...item,
      valor: Number(item.valor || 0)
    }));

    let saldo = 0;
    const movimentosComSaldo = movimentos.map((item) => {
      if (item.direcao === 'ENTRADA') {
        saldo += item.valor;
      } else {
        saldo -= item.valor;
      }
      return { ...item, saldo_atual: saldo };
    });

    const totalMovimentos = movimentosComSaldo.length;
    const paginados = movimentosComSaldo
      .slice()
      .reverse()
      .slice(offset, offset + limit);

    return res.status(200).json({
      resumo: {
        total_receitas: totalReceitas,
        total_despesas: totalDespesas,
        saldo_liquido: saldoLiquido,
        total_pendente: totalPendente
      },
      movimentos: paginados,
      total: totalMovimentos,
      limit,
      offset,
      traceId
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Erro interno', traceId });
  }
}
