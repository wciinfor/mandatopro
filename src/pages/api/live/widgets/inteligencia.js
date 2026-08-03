import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { processarRegrasInteligencia } from '@/services/regrasInteligenciaService';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    // Processar o Motor de Regras Desacoplado
    const insights = await processarRegrasInteligencia(supabase);

    return res.status(200).json({
      totalInsights: insights.length,
      insights,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro no endpoint Live Centro de Inteligência:', error);
    return res.status(500).json({
      error: 'Erro ao processar recomendações do centro de inteligência estratégica',
      details: error.message
    });
  }
}
