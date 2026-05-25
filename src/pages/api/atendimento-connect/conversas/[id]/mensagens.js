import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { exigirAcessoAtendimentoConnect, toPublicMensagem } from '@/lib/atendimento-connect';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  const supabase = createServerClient();
  const conversaId = Number(req.query.id);

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);
    exigirAcessoAtendimentoConnect(usuario);

    if (!Number.isFinite(conversaId)) {
      return res.status(400).json({ success: false, message: 'Id invalido' });
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('atendimento_connect_mensagens')
        .select('*, usuarios:usuario_id (id, nome, nivel)')
        .eq('conversa_id', conversaId)
        .order('created_at', { ascending: true })
        .limit(300);

      if (error) throw error;
      return res.status(200).json({ success: true, data: (data || []).map(toPublicMensagem) });
    }

    if (req.method === 'POST') {
      const mensagem = String(req.body?.mensagem || '').trim();
      const direcao = String(req.body?.direcao || 'nota');

      if (!mensagem) return res.status(400).json({ success: false, message: 'Mensagem obrigatoria' });
      if (!['saida', 'nota'].includes(direcao)) {
        return res.status(400).json({ success: false, message: 'Direcao invalida' });
      }

      const { data, error } = await supabase
        .from('atendimento_connect_mensagens')
        .insert({
          conversa_id: conversaId,
          direcao,
          mensagem,
          usuario_id: usuario.id,
          status: direcao === 'saida' ? 'pendente_envio' : 'registrada'
        })
        .select('*, usuarios:usuario_id (id, nome, nivel)')
        .single();

      if (error) throw error;

      const conversaUpdate = {
        ultima_mensagem: mensagem,
        ultima_mensagem_em: new Date().toISOString(),
        responsavel_id: usuario.id,
        updated_at: new Date().toISOString()
      };

      if (direcao === 'saida') {
        conversaUpdate.status = 'aguardando_eleitor';
      }

      await supabase
        .from('atendimento_connect_conversas')
        .update(conversaUpdate)
        .eq('id', conversaId);

      return res.status(201).json({ success: true, data: toPublicMensagem(data) });
    }

    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error('Erro em atendimento-connect/mensagens:', error);
    return res.status(status).json({ success: false, message: error?.message || 'Erro interno' });
  }
}
