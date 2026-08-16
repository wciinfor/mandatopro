import { createServerClient } from '@/lib/supabase-server';
import { createWhatsAppProvider } from '@/services/whatsapp-provider-factory';
import { normalizarWhatsappAccount } from '@/lib/whatsapp-business-accounts';

/**
 * API Handler para enviar e persistir mensagens nas tabelas oficiais multicanal utilizando a Factory de Providers (Meta / YCloud).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query; // conversation_id
  const { mensagem, templateParams } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID da conversa é obrigatório' });
  }

  try {
    const supabase = createServerClient();
    
    // 1. Busca a conversa correspondente para capturar o tenant_id e o contact_id
    const { data: conversa, error: errConv } = await supabase
      .from('communication_conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (errConv || !conversa) {
      throw new Error('Conversa não localizada para o envio.');
    }

    // 2. Busca as credenciais oficiais vinculadas ao tenant da conversa na whatsapp_business_accounts
    const { data: contaWaba, error: errWaba } = await supabase
      .from('whatsapp_business_accounts')
      .select('*, whatsapp_business_numbers(*)')
      .eq('tenant_id', conversa.tenant_id)
      .eq('status', 'ATIVO')
      .order('id', { ascending: true });

    let contaSelecionada = (contaWaba || []).find(c => String(c.provider).toUpperCase() === 'YCLOUD') 
      || (contaWaba || []).find(c => String(c.provider).toUpperCase() === 'META')
      || contaWaba?.[0]
      || null;

    // Fallback para a tabela legada communication_accounts se whatsapp_business_accounts não retornar
    if (!contaSelecionada) {
      const { data: contaLegacy } = await supabase
        .from('communication_accounts')
        .select('*')
        .eq('tenant_id', conversa.tenant_id)
        .eq('provider', 'whatsapp')
        .eq('status', 'ativo')
        .maybeSingle();

      if (contaLegacy) {
        contaSelecionada = {
          provider: 'META',
          access_token: contaLegacy.access_token,
          phone_number_id: contaLegacy.phone_number_id,
          waba_id: contaLegacy.waba_id
        };
      }
    }

    if (!contaSelecionada) {
      throw new Error('Configuração de credenciais de WhatsApp não localizada ou inativa para este Tenant.');
    }

    const contaNormalizada = normalizarWhatsappAccount(contaSelecionada);
    const providerAccount = {
      ...contaSelecionada,
      ...contaNormalizada,
      accessToken: contaSelecionada.access_token || contaSelecionada.ycloud_api_key,
      ycloudApiKey: contaSelecionada.ycloud_api_key
    };

    // 3. Inicializa o provider unificado via Factory
    const provider = createWhatsAppProvider(providerAccount);

    let wamid = `wpp-msg-${Date.now()}`;
    let providerResponse = {};
    const textoMensagem = templateParams ? `[Template HSM: ${templateParams.templateNome}]` : (mensagem || '');

    // 4. Executa o disparo oficial
    if (templateParams) {
      // Dispara Template HSM
      const resSend = await provider.sendTemplate({
        to: conversa.contact_id,
        recipient: conversa.contact_id,
        templateName: templateParams.templateNome,
        name: templateParams.templateNome,
        language: templateParams.idiomaCode || 'pt_BR',
        components: templateParams.componentes || []
      });

      wamid = resSend?.id || resSend?.messages?.[0]?.id || resSend?.wamid || wamid;
      providerResponse = resSend;
    } else if (mensagem) {
      // Dispara Texto Simples
      const resSend = await provider.sendMessage({
        to: conversa.contact_id,
        recipient: conversa.contact_id,
        message: mensagem.trim(),
        text: mensagem.trim()
      });

      wamid = resSend?.id || resSend?.messages?.[0]?.id || resSend?.wamid || wamid;
      providerResponse = resSend;
    } else {
      return res.status(400).json({ error: 'Conteúdo da mensagem ou templateParams são necessários' });
    }

    // 5. Persiste a mensagem em communication_messages (direção 'saida' e status 'sent')
    const { data: msgInserida, error: errInsert } = await supabase
      .from('communication_messages')
      .insert({
        tenant_id: conversa.tenant_id,
        conversation_id: id,
        provider_message_id: wamid,
        provider: contaSelecionada.provider || conversa.provider || 'whatsapp',
        channel: conversa.channel || 'whatsapp',
        direction: 'saida',
        mensagem: textoMensagem.trim(),
        meta_dados: {
          status: 'enviada',
          provider_response: providerResponse,
          sent_at: new Date().toISOString()
        }
      })
      .select('*')
      .single();

    if (errInsert) throw errInsert;

    // 6. Atualiza automaticamente o preview da conversa em communication_conversations
    const { error: errUpdate } = await supabase
      .from('communication_conversations')
      .update({
        last_message_preview: textoMensagem.trim(),
        last_message_at: new Date().toISOString()
      })
      .eq('id', id);

    if (errUpdate) throw errUpdate;

    return res.status(200).json(msgInserida);
  } catch (error) {
    console.error('[EnviarMensagemAPI] Erro no fluxo de envio e persistência oficial:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Erro ao processar envio de mensagem.'
    });
  }
}
