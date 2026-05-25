import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAcessoMandatoConnect, exigirAdministradorOuSupervisorConnect } from '@/lib/api-auth';
import { INSTANCIA_SELECT, sanitizeNomeInstancia, toPublicInstancia } from '@/lib/disparos/instancias';

export const runtime = 'nodejs';

async function carregarInstancia(supabase, id) {
  const { data, error } = await supabase
    .from('disparo_instancias')
    .select(`${INSTANCIA_SELECT}, api_key`)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAcessoMandatoConnect(usuario);

    const id = Number(req.query.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: 'ID invalido' });
    }

    if (req.method === 'GET') {
      const data = await carregarInstancia(supabase, id);
      if (!data) return res.status(404).json({ success: false, message: 'Instancia nao encontrada' });
      return res.status(200).json({ success: true, data: toPublicInstancia(data) });
    }

    if (req.method === 'PATCH') {
      exigirAdministradorOuSupervisorConnect(usuario);

      const patch = {
        atualizado_por_id: usuario.id,
        updated_at: new Date().toISOString()
      };

      if (req.body?.nome !== undefined) {
        const nome = sanitizeNomeInstancia(req.body.nome);
        if (!nome) return res.status(400).json({ success: false, message: 'Nome da instancia e obrigatorio' });
        patch.nome = nome;
      }

      if (req.body?.apiKey !== undefined) {
        const apiKey = String(req.body.apiKey || '').trim();
        if (apiKey) patch.api_key = apiKey;
      }

      const { data, error } = await supabase
        .from('disparo_instancias')
        .update(patch)
        .eq('id', id)
        .select(`${INSTANCIA_SELECT}, api_key`)
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, data: toPublicInstancia(data) });
    }

    if (req.method === 'DELETE') {
      exigirAdministradorOuSupervisorConnect(usuario);

      const { error } = await supabase
        .from('disparo_instancias')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Instancia removida' });
    }

    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error('Erro em disparos/instancias/[id]:', error);
    return res.status(status).json({
      success: false,
      message: error?.message || 'Erro ao processar instancia'
    });
  }
}
