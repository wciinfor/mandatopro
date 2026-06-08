import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAcessoMandatoConnect } from '@/lib/api-auth';
import { obterStatusInstancia, normalizarEstadoEvolution } from '@/lib/disparos/evolution';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  }

  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAcessoMandatoConnect(usuario);

    const id = Number(req.query.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: 'ID invalido' });
    }

    const { data: instancia, error } = await supabase
      .from('disparo_instancias')
      .select('id, nome, api_key')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!instancia) return res.status(404).json({ success: false, message: 'Instancia nao encontrada' });

    const payload = await obterStatusInstancia(instancia.nome, instancia.api_key || undefined);
    const status = normalizarEstadoEvolution(payload);

    await supabase
      .from('disparo_instancias')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    return res.status(200).json({ success: true, status, data: payload });
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error('Erro ao consultar status da instancia:', error);
    return res.status(status).json({
      success: false,
      message: error?.message || 'Erro ao consultar status da instancia'
    });
  }
}
