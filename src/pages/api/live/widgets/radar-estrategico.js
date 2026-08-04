import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { processarPredictionEngine } from '@/services/predictionEngineService';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    // Processar o PredictionEngine (Inteligência Preditiva)
    const radarData = await processarPredictionEngine(supabase);

    return res.status(200).json({
      ...radarData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro no endpoint Live Radar Estratégico:', error);
    return res.status(500).json({
      error: 'Erro ao processar inteligência preditiva do radar estratégico',
      details: error.message
    });
  }
}
