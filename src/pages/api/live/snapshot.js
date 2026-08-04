import { LiveSnapshotService } from '@/services/live/LiveSnapshotService';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/**
 * API Central /api/live/snapshot
 * Retorna um único Snapshot Consolidado para toda a aplicação MandatoPRO Live.
 * Elimina requisições duplicadas e centraliza a busca no banco de dados.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    // Gerar o Snapshot Único de Dados Consolidado
    const snapshot = await LiveSnapshotService.getSnapshot(req);

    return res.status(200).json(snapshot);
  } catch (error) {
    console.error('Erro na API Live Snapshot:', error);
    return res.status(500).json({
      error: 'Erro ao gerar o snapshot consolidado de dados do MandatoPRO Live',
      details: error.message
    });
  }
}
