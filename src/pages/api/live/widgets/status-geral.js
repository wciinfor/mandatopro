import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { calcularMissionStatus } from '@/services/missionStatusEngine';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    // Processar o MissionStatusEngine
    const statusData = await calcularMissionStatus(supabase);

    return res.status(200).json({
      ...statusData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro no endpoint Live Status Geral do Mandato:', error);
    return res.status(500).json({
      error: 'Erro ao calcular status geral executivo do mandato',
      details: error.message
    });
  }
}
