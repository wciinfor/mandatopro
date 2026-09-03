import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { exigirAcessoAtendimentoConnect, toPublicMensagem } from '@/lib/atendimento-connect';
import {
  buscarContaWhatsappPrincipal,
  normalizarWhatsappAccount,
  resolverContaWhatsappDaConversa
} from '@/lib/whatsapp-business-accounts';
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
      const [{ data, error }, { data: conversa }] = await Promise.all([
        supabase
          .from('atendimento_connect_mensagens')
          .select('*, usuarios:usuario_id (id, nome, nivel)')
          .eq('conversa_id', conversaId)
          .order('created_at', { ascending: true })
          .limit(300),
        supabase
          .from('atendimento_connect_conversas')
          .select('*')
          .eq('id', conversaId)
          .single()
      ]);

      if (error) throw error;

      let canalResolvido = null;
      if (conversa) {
        try {
          const { resolucaoInfo } = await resolverContaWhatsappDaConversa(supabase, conversa, usuario);
          canalResolvido = resolucaoInfo;
        } catch (e) {
          console.warn('[ATENDIMENTO CONNECT GET] Falha ao resolver canal da conversa:', e?.message);
        }
      }

      return res.status(200).json({
        success: true,
        data: (data || []).map(toPublicMensagem),
        canalResolvido
      });
    }

    if (req.method === 'POST') {
      const mensagem = String(req.body?.mensagem || '').trim();
      const direcao = String(req.body?.direcao || 'nota');
      const templateParams = req.body?.templateParams || null;

      // Se for envio de template, o corpo da mensagem pode ser formatado a partir do nome do template
      const textoMensagem = templateParams
        ? (templateParams.templateNome ? `[Template HSM: ${templateParams.templateNome}]` : (mensagem || '[Template WhatsApp]'))
        : mensagem;

      if (!textoMensagem && !templateParams) {
        return res.status(400).json({ success: false, message: 'Mensagem ou templateParams obrigatorios' });
      }
      if (!['saida', 'nota'].includes(direcao)) {
        return res.status(400).json({ success: false, message: 'Direcao invalida' });
      }

      // 1. Cria a mensagem no banco com status 'pendente_envio' (se saída) ou 'registrada' (se nota)
      const { data: mensagemInserida, error: errInsertMsg } = await supabase
        .from('atendimento_connect_mensagens')
        .insert({
          conversa_id: conversaId,
          direcao,
          mensagem: textoMensagem,
          usuario_id: usuario.id,
          status: direcao === 'saida' ? 'pendente_envio' : 'registrada',
          raw_payload: templateParams ? { templateParams } : {}
        })
        .select('*, usuarios:usuario_id (id, nome, nivel)')
        .single();

      if (errInsertMsg) throw errInsertMsg;

      let mensagemFinal = mensagemInserida;

      // 2. Se for uma mensagem de saída para o contato, envia via WhatsApp Provider (META, WABLAST ou YCloud)
      if (direcao === 'saida') {
        const { data: conversa, error: errConv } = await supabase
          .from('atendimento_connect_conversas')
          .select('*')
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

        const { conta: contaRaw, resolucaoInfo } = await resolverContaWhatsappDaConversa(supabase, conversa, usuario);
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
          let sendResult = null;

          if (templateParams) {
            // Disparo via Template HSM pré-aprovado
            sendResult = await provider.sendTemplate({
              to: conversa.contato_telefone,
              recipient: conversa.contato_telefone,
              templateName: templateParams.templateNome || templateParams.name || templateParams.templateName,
              name: templateParams.templateNome || templateParams.name || templateParams.templateName,
              language: templateParams.idiomaCode || templateParams.language || 'pt_BR',
              components: templateParams.componentes || templateParams.components || []
            });
          } else {
            // Disparo de texto simples padrão
            sendResult = await provider.sendMessage({
              to: conversa.contato_telefone,
              message: textoMensagem,
              text: textoMensagem
            });
          }

          // Trata retornos de ID tanto para META (messageId) quanto YCloud (id / wamid / messageId)
          const providerMessageId = sendResult?.messageId || sendResult?.id || sendResult?.wamid || null;

          // Se o envio no provedor foi bem-sucedido, atualiza a mensagem para 'enviada'
          const { data: msgAtualizada, error: errUpdateMsg } = await supabase
            .from('atendimento_connect_mensagens')
            .update({
              status: 'enviada',
              provider_message_id: providerMessageId,
              raw_payload: {
                ...(mensagemInserida.raw_payload || {}),
                provider_response: sendResult
              }
            })
            .eq('id', mensagemInserida.id)
            .select('*, usuarios:usuario_id (id, nome, nivel)')
            .single();

          if (!errUpdateMsg && msgAtualizada) {
            mensagemFinal = msgAtualizada;
          }
        } catch (sendError) {
          console.error('[ATENDIMENTO CONNECT SEND] Erro no provedor WhatsApp:', sendError?.message || sendError);

          const errorMessage = String(sendError?.message || sendError || '');
          const errorDetails = sendError?.details || {};
          const isWindowClosed = (
            errorMessage.toLowerCase().includes('janela 24h fechada') ||
            errorMessage.toLowerCase().includes('janela 24 horas fechada') ||
            errorMessage.toLowerCase().includes('out of 24 hours') ||
            errorMessage.toLowerCase().includes('re-engagement message') ||
            errorMessage.includes('131047') ||
            String(sendError?.code || '') === '131047' ||
            String(errorDetails?.error?.code || '') === '131047' ||
            String(errorDetails?.code || '') === '131047'
          );

          // Atualiza a mensagem no banco para status='falhou', registrando o erro original
          const errorPayload = {
            status: 'falhou',
            raw_payload: {
              ...(mensagemInserida.raw_payload || {}),
              error: {
                message: errorMessage,
                code: sendError?.code || (isWindowClosed ? '131047' : 'SEND_ERROR'),
                details: errorDetails
              },
              provider: resolucaoInfo?.provider || null,
              provider_account_id: resolucaoInfo?.account_id || null,
              numero_gabinete: resolucaoInfo?.numero_gabinete || null,
              failed_at: new Date().toISOString()
            }
          };

          const { data: msgFalha } = await supabase
            .from('atendimento_connect_mensagens')
            .update(errorPayload)
            .eq('id', mensagemInserida.id)
            .select('*, usuarios:usuario_id (id, nome, nivel)')
            .single();

          const dadosRetorno = toPublicMensagem(msgFalha || { ...mensagemInserida, ...errorPayload });

          if (isWindowClosed) {
            return res.status(422).json({
              success: false,
              code: 'WINDOW_24H_CLOSED',
              message: 'A janela de 24 horas está fechada. Envie uma mensagem usando um template aprovado.',
              data: dadosRetorno
            });
          }

          return res.status(500).json({
            success: false,
            message: `Falha ao enviar mensagem via WhatsApp: ${errorMessage || 'Erro no provedor'}`,
            data: dadosRetorno
          });
        }
      }

      // 3. Atualiza os dados da conversa no Kanban
      const conversaUpdate = {
        ultima_mensagem: textoMensagem,
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

