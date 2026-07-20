import { createServerClient } from '@/lib/supabase-server';
import { DashboardCampaignRepository } from '@/lib/repositories-dashboard-campaign';

/**
 * API Handler para computar indicadores agregados de disparos em tempo real.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const repo = new DashboardCampaignRepository(supabase);
    const metrics = await repo.obterMétricasGerais();
    
    return res.status(200).json(metrics);
  } catch (error) {
    console.error('[DashboardCampaignAPI] Erro ao consolidar indicadores de campanha:', error);
    // Em caso de tabela não criada nas migrations ainda, fornece um fallback seguro com zeros
    return res.status(200).json({
      campanhasAtivas: 0,
      mensagensEnviadasHoje: 0,
      entregues: 0,
      lidas: 0,
      falhas: 0,
      taxaEntrega: 0,
      taxaLeitura: 0
    });
  }
}
