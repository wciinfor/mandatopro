import { limparCacheAniversariantes } from '@/lib/aniversariantes';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { limparCacheGeolocaliza } from '@/pages/api/geolocalizacao/eleitores-mapa-calor';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  // Apenas POST permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAdministrador(usuario);

    console.log('[API CACHE] Limpando todos os caches...');

    // Limpa cache de aniversariantes
    limparCacheAniversariantes();

    // Limpa cache de geolocalização
    try {
      limparCacheGeolocaliza();
    } catch (e) {
      console.warn('[API CACHE] Aviso ao limpar geolocalização:', e.message);
    }

    return res.status(200).json({
      success: true,
      message: 'All caches cleared successfully',
      timestamp: new Date().toISOString(),
      caches: ['aniversariantes', 'geolocaliza']
    });
  } catch (error) {
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    }

    console.error('[API CACHE] Erro ao limpar cache:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao limpar cache',
      detalhes: error?.message || 'Erro desconhecido'
    });
  }
}
