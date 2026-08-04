import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { getDashboardStatsCore } from '@/services/DashboardStatsService';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const stats = await getDashboardStatsCore(supabase);

    // Cache de 2 minutos no edge da Vercel
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

    return res.status(200).json(stats);
  } catch (error) {
    console.error('Erro ao buscar estatisticas do dashboard:', error);
    return res.status(500).json({ error: 'Erro ao buscar estatisticas do dashboard' });
  }
}
