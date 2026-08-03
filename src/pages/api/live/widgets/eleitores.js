import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    // Datas de referência para hoje, semana atual e mês atual em ISO/BR
    const agora = new Date();
    
    // Início de hoje (00:00:00)
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString();

    // Início da semana (Segunda-feira 00:00:00)
    const diaDaSemana = agora.getDay();
    const diffSegunda = agora.getDate() - (diaDaSemana === 0 ? 6 : diaDaSemana - 1);
    const inicioSemana = new Date(agora.getFullYear(), agora.getMonth(), diffSegunda).toISOString();

    // Início do mês (Dia 1, 00:00:00)
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();

    // Datas de períodos anteriores para variação percentual
    // Mês anterior
    const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).toISOString();
    const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999).toISOString();

    // Executar consultas de contagem em paralelo para máxima performance
    const [
      { count: totalEleitores, error: errTotal },
      { count: cadastrosHoje, error: errHoje },
      { count: cadastrosSemana, error: errSemana },
      { count: cadastrosMes, error: errMes },
      { count: cadastrosMesAnterior, error: errMesAnterior },
      { data: ultimosCadastros, error: errUltimos }
    ] = await Promise.all([
      // Total de eleitores
      supabase.from('eleitores').select('id', { count: 'exact', head: true }),

      // Hoje
      supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', inicioHoje),

      // Semana
      supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', inicioSemana),

      // Mês
      supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', inicioMes),

      // Mês anterior (para variação percentual)
      supabase.from('eleitores').select('id', { count: 'exact', head: true })
        .gte('created_at', inicioMesAnterior)
        .lte('created_at', fimMesAnterior),

      // Timeline dos últimos 15 cadastros
      supabase.from('eleitores')
        .select(`
          id,
          nome,
          cidade,
          municipio,
          bairro,
          lideranca,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(15)
    ]);

    if (errTotal || errHoje || errSemana || errMes || errMesAnterior || errUltimos) {
      const error = errTotal || errHoje || errSemana || errMes || errMesAnterior || errUltimos;
      console.error('Erro na API Live Eleitores:', error);
      throw error;
    }

    // Cálculo da variação percentual em relação ao mês anterior
    let variacaoPercentualMes = 0;
    if (cadastrosMesAnterior && cadastrosMesAnterior > 0) {
      variacaoPercentualMes = Math.round(((cadastrosMes - cadastrosMesAnterior) / cadastrosMesAnterior) * 100);
    } else if (cadastrosMes > 0) {
      variacaoPercentualMes = 100;
    }

    // Formatar timeline dos eleitores
    const timeline = (ultimosCadastros || []).map((e) => ({
      id: e.id,
      nome: e.nome || 'Eleitor sem nome',
      municipio: e.cidade || e.municipio || e.bairro || 'Local não informado',
      lideranca: e.lideranca || null,
      dataHora: e.created_at
    }));

    return res.status(200).json({
      metricas: {
        totalEleitores: totalEleitores || 0,
        cadastrosHoje: cadastrosHoje || 0,
        cadastrosSemana: cadastrosSemana || 0,
        cadastrosMes: cadastrosMes || 0,
        variacaoPercentualMes: variacaoPercentualMes
      },
      timeline,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao buscar dados Live Eleitores:', error);
    return res.status(500).json({
      error: 'Erro interno ao carregar estatísticas do widget de eleitores em tempo real',
      details: error.message
    });
  }
}
