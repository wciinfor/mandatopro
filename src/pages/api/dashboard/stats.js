import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();

    const [eleitores, liderancas, campanhas, atendimentos] = await Promise.all([
      supabase.from('eleitores').select('id', { count: 'exact', head: true }),
      supabase.from('liderancas').select('id', { count: 'exact', head: true }),
      supabase
        .from('campanhas')
        .select('id', { count: 'exact', head: true })
        .in('status', ['PLANEJAMENTO', 'EXECUCAO']),
      supabase.from('atendimentos').select('id', { count: 'exact', head: true })
    ]);

    if (eleitores.error) throw eleitores.error;
    if (liderancas.error) throw liderancas.error;
    if (campanhas.error) throw campanhas.error;
    if (atendimentos.error) throw atendimentos.error;

    return res.status(200).json({
      totalEleitores: eleitores.count || 0,
      totalLiderancas: liderancas.count || 0,
      campanhasAtivas: campanhas.count || 0,
      totalAtendimentos: atendimentos.count || 0
    });
  } catch (error) {
    console.error('Erro ao buscar estatisticas do dashboard:', error);
    return res.status(500).json({ error: 'Erro ao buscar estatisticas do dashboard' });
  }
}
