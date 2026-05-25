import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { desconectarInstancia } from '@/lib/disparos/evolution';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  }

  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const id = Number(req.body?.id || req.query?.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: 'ID invalido' });
    }

    const { data: instance, error } = await supabase
      .from('instances')
      .select('id, name, apikey')
      .eq('id', id)
      .eq('user_id', usuario.id)
      .maybeSingle();

    if (error) throw error;
    if (!instance) {
      return res.status(404).json({ success: false, message: 'Instancia nao encontrada' });
    }

    await desconectarInstancia(instance.name, instance.apikey);

    const { error: updateError } = await supabase
      .from('instances')
      .update({
        status: 'disconnected',
        last_check: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', usuario.id);

    if (updateError) throw updateError;

    return res.status(200).json({ success: true, message: 'Instancia desconectada' });
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error('Erro ao desconectar instancia runtime:', error);
    return res.status(status).json({
      success: false,
      message: error?.message || 'Erro ao desconectar instancia',
      details: error?.details || undefined
    });
  }
}
