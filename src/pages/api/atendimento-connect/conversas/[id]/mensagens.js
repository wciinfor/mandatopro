import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { exigirAcessoAtendimentoConnect, toPublicMensagem } from '@/lib/atendimento-connect';
import { buscarContaWhatsappPrincipal, normalizarWhatsappAccount } from '@/lib/whatsapp-business-accounts';
import { createWhatsAppProvider } from '@/services/whatsapp-provider-factory';

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

      // 1. Cria a mensagem no banco com status 'pendente_envio' (se saída) ou 'registrada' (se nota)
      const { data: mensagemInserida, error: errInsertMsg } = await supabase
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

      if (errInsertMsg) throw errInsertMsg;

      let mensagemFinal = mensagemInserida;

      // 2. Se for uma mensagem de saída para o contato, envia via WhatsApp Provider (META ou YCloud)
      if (direcao === 'saida') {
        const { data: conversa, error: errConv } = await supabase
          .from('atendimento_connect_conversas')
          .select('contato_telefone')
          .eq('id', conversaId)
          .single();

        if (errConv || !conversa?.contato_telefone) {
          console.error('[ATENDIMENTO CONNECT SEND] Conversa ou telefone nao localizado:', errConv?.message);
          return res.status(400).json({
            success: false,
            message: 'Telefone do contato nao encontrado para envio',
            data: toPublicMensagem(mensagemInserida)
          });
        }

        const contaRaw = await buscarContaWhatsappPrincipal(supabase, usuario);
        if (!contaRaw) {
          console.error('[ATENDIMENTO CONNECT SEND] Nenhuma conta WhatsApp Business ativa configurada');
          return res.status(400).json({
            success: false,
            message: 'Nenhuma conta de WhatsApp Business ativa configurada para o mandato',
            data: toPublicMensagem(mensagemInserida)
          });
        }

        const contaNormalizada = normalizarWhatsappAccount(contaRaw);
        const providerAccount = {
          ...contaRaw,
          ...contaNormalizada,
          accessToken: contaRaw.access_token || contaRaw.ycloud_api_key,
          ycloudApiKey: contaRaw.ycloud_api_key
        };

        try {
          const provider = createWhatsAppProvider(providerAccount);
          const sendResult = await provider.sendMessage({
            to: conversa.contato_telefone,
            message: mensagem,
            text: mensagem
          });

          // Trata retornos de ID tanto para META (messageId) quanto YCloud (id / wamid / messageId)
          const providerMessageId = sendResult?.messageId || sendResult?.id || sendResult?.wamid || null;

          // Se o envio no provedor foi bem-sucedido, atualiza a mensagem para 'enviada'
          const { data: msgAtualizada, error: errUpdateMsg } = await supabase
            .from('atendimento_connect_mensagens')
            .update({
              status: 'enviada',
              provider_message_id: providerMessageId
            })
            .eq('id', mensagemInserida.id)
            .select('*, usuarios:usuario_id (id, nome, nivel)')
            .single();

          if (!errUpdateMsg && msgAtualizada) {
            mensagemFinal = msgAtualizada;
          }
        } catch (sendError) {
          // Em caso de falha de envio, mantem status='pendente_envio', loga o erro sem segredos e retorna erro 500
          console.error('[ATENDIMENTO CONNECT SEND] Erro no provedor WhatsApp:', sendError?.message || sendError);
          return res.status(500).json({
            success: false,
            message: `Falha ao enviar mensagem via WhatsApp: ${sendError?.message || 'Erro no provedor'}`,
            data: toPublicMensagem(mensagemInserida)
          });
        }
      }

      // 3. Atualiza os dados da conversa no Kanban
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

      return res.status(201).json({ success: true, data: toPublicMensagem(mensagemFinal) });
    }

    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error('Erro em atendimento-connect/mensagens:', error);
    return res.status(status).json({ success: false, message: error?.message || 'Erro interno' });
  }
}

