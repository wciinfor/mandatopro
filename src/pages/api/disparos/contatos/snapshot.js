import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import { deduplicarContatos, resumoContatos, toDbContato } from '@/lib/disparos/contatos';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  }

  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAdministrador(usuario);

    const campanhaId = Number(req.body?.campanhaId);
    const contatosInput = Array.isArray(req.body?.contatos) ? req.body.contatos : [];

    if (!Number.isFinite(campanhaId)) {
      return res.status(400).json({ success: false, message: 'Campanha invalida' });
    }

    if (contatosInput.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum contato informado' });
    }

    const contatos = deduplicarContatos(contatosInput);
    const resumo = resumoContatos(contatos);

    await supabase
      .from('disparo_contatos')
      .delete()
      .eq('campanha_id', campanhaId);

    const rows = contatos
      .filter((contato) => !contato.duplicado || !contato.telefoneNormalizado)
      .map((contato) => toDbContato(campanhaId, contato));
    const { error } = await supabase
      .from('disparo_contatos')
      .insert(rows);

    if (error) throw error;

    await supabase
      .from('disparo_campanhas')
      .update({
        total_contatos: resumo.total,
        total_validos: resumo.validos,
        total_invalidos: resumo.invalidos,
        atualizado_por_id: usuario.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', campanhaId);

    return res.status(200).json({ success: true, resumo, message: 'Contatos vinculados a campanha' });
  } catch (error) {
    console.error('Erro ao salvar snapshot de contatos:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || 'Erro ao salvar contatos'
    });
  }
}
