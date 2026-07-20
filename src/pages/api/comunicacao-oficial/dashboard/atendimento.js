import { createServerClient } from '@/lib/supabase-server';
import { DashboardAttendanceRepository } from '@/lib/repositories-dashboard-attendance';

/**
 * API Handler para computar indicadores de atendimento em tempo real.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const repo = new DashboardAttendanceRepository(supabase);
    const metrics = await repo.obterMétricasAtendimento();
    
    return res.status(200).json(metrics);
  } catch (error) {
    console.error('[DashboardAttendanceAPI] Erro ao consolidar indicadores de atendimento:', error);
    // Fallback seguro caso as tabelas estejam vazias/não provisionadas
    return res.status(200).json({
      conversasAbertas: 0,
      conversasAguardando: 0,
      tempoMedioResposta: '0m 00s'
    });
  }
}
