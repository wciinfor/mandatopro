import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { carregarSnapshotAniversariantes } from '@/lib/aniversariantes';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);
    const limite = Number(req.query.limit || 1000);
    const incluirInativos = String(req.query.include_inativos || '').toLowerCase() === 'true';
    const deduplicar = true;

    console.log('[API ANIVERSARIANTES] Requisição recebida:', {
      limite,
      incluirInativos,
      timestamp: new Date().toISOString()
    });

    const snapshot = await carregarSnapshotAniversariantes(supabase, {
      limite,
      incluirInativos,
      deduplicar
    });

    console.log('[API ANIVERSARIANTES] Retornando resposta:', {
      totalAniversariantes: snapshot.resumo.totalAniversariantes,
      aniversariantesHoje: snapshot.resumo.aniversariantesHoje,
      proximosRetornados: snapshot.proximosAniversariantes.length
    });

    return res.status(200).json({
      success: true,
      aniversariantes: snapshot.listaCompleta,
      proximosAniversariantes: snapshot.proximosAniversariantes,
      resumo: snapshot.resumo,
      inconsistencias: snapshot.inconsistencias
    });
  } catch (error) {
    console.error('[API ANIVERSARIANTES] Erro:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar aniversariantes no Supabase',
      detalhes: error?.message || 'Erro desconhecido'
    });
  }
}
