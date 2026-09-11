import { createServerClient } from '@/lib/supabase-server';
import { DashboardCampaignRepository } from '@/lib/repositories-dashboard-campaign';
import { obterUsuarioAutenticado } from '@/lib/api-auth';
import { obterTenantId } from '@/lib/tenant';

/**
 * API Handler para computar indicadores agregados de disparos em tempo real.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    
    // Identificar tenant autenticado
    let tenantId = null;
    try {
      const auth = await obterUsuarioAutenticado(req, supabase);
      tenantId = obterTenantId(auth?.usuario);
    } catch {
      tenantId = null;
    }

    const { provider } = req.query || {};
    const filtros = {};
    if (provider) filtros.provider = String(provider);

    const repo = new DashboardCampaignRepository(supabase);
    const metrics = await repo.obterMétricasGerais(tenantId, filtros);
    
    return res.status(200).json(metrics);
  } catch (error) {
    console.error('[DashboardCampaignAPI] Erro ao consolidar indicadores de campanha:', error);
    // Em caso de tabela não criada nas migrations ainda, fornece um fallback seguro com zeros
    return res.status(200).json({
      totalCampanhas: 0,
      campanhasAtivas: 0,
      mensagensEnviadasHoje: 0,
      totalDestinatarios: 0,
      totalEnviadas: 0,
      pendentes: 0,
      aguardandoConfirmacao: 0,
      entreguesExclusivas: 0,
      entregues: 0,
      lidas: 0,
      falhas: 0,
      canceladas: 0,
      taxaEntregaConfirmada: null,
      taxaEntrega: 0,
      taxaLeitura: null,
      historicoUltimos7Dias: [],
      porProvedor: {},
      campanhasRecentes: []
    });
  }
}
