// API para envio em massa de mensagens (Email, SMS, WhatsApp)
import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

// Carregar configuração do WhatsApp a partir do Supabase
const carregarConfiguracao = async (supabase) => {
  try {
    const { data: rows, error } = await supabase
      .from('configuracoes_sistema')
      .select('chave, valor')
      .in('chave', ['whatsapp_phone_number_id', 'whatsapp_access_token']);

    if (error || !rows?.length) return null;

    const map = Object.fromEntries(rows.map(r => [r.chave, r.valor]));
    return {
      whatsapp: {
        phoneNumberId: map.whatsapp_phone_number_id || '',
        accessToken: map.whatsapp_access_token || ''
      }
    };
  } catch (error) {
    console.error('Erro ao carregar configuração do WhatsApp:', error);
    return null;
  }
};

// Buscar destinatários do Supabase
const buscarDestinatarios = async (supabase, tipo) => {
  let query = supabase
    .from('usuarios')
    .select('id, nome, email, telefone, nivel')
    .eq('status', 'ATIVO');

  if (tipo === 'liderancas') {
    query = query.eq('nivel', 'LIDERANCA');
  } else if (tipo === 'operadores') {
    query = query.eq('nivel', 'OPERADOR');
  }
  // tipo === 'todos' → sem filtro de nível

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// Enviar por WhatsApp
const enviarWhatsApp = async (telefone, mensagem, config) => {
  if (!config?.whatsapp?.phoneNumberId || !config?.whatsapp?.accessToken) {
    throw new Error('WhatsApp não configurado');
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${config.whatsapp.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.whatsapp.accessToken}`
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefone,
      type: 'text',
      text: { preview_url: false, body: mensagem }
    })
  });

  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${response.statusText}`);
  }

  return await response.json();
};

// Envio por Email (stub — integrar Resend/SendGrid em produção)
const enviarEmail = async (email, assunto, mensagem) => {
  console.log(`Email para ${email}:`, { assunto, mensagem });
  return { success: true, email, messageId: `email_${Date.now()}`, status: 'enviado' };
};

// Envio por SMS (stub — integrar Twilio/AWS SNS em produção)
const enviarSMS = async (telefone, mensagem) => {
  console.log(`SMS para ${telefone}:`, { mensagem });
  return { success: true, telefone, messageId: `sms_${Date.now()}`, status: 'enviado' };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido' });
  }

  const supabase = createServerClient();

  try {
    const { tipo, mensagem, assunto, canais } = req.body;

    // Validações
    if (!tipo || !['todos', 'liderancas', 'operadores'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de destinatário inválido'
      });
    }

    if (!mensagem || mensagem.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Mensagem não pode estar vazia'
      });
    }

    if (!canais || canais.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selecione pelo menos um canal'
      });
    }

    // Buscar destinatários no Supabase
    const listaDestinatarios = await buscarDestinatarios(supabase, tipo);

    if (listaDestinatarios.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum destinatário encontrado'
      });
    }

    // Carregar configuração do WhatsApp do Supabase
    const config = await carregarConfiguracao(supabase);

    // Enviar por cada canal
    const resultados = [];

    for (const destinatario of listaDestinatarios) {
      for (const canal of canais) {
        try {
          let resultado;

          if (canal === 'whatsapp') {
            if (!destinatario.telefone) {
              resultados.push({ canal: 'whatsapp', destinatario: destinatario.nome, status: 'erro', erro: 'Telefone não disponível' });
              continue;
            }
            resultado = await enviarWhatsApp(destinatario.telefone, mensagem, config);
            resultados.push({
              canal: 'whatsapp',
              destinatario: destinatario.nome,
              contato: destinatario.telefone,
              status: 'enviado',
              messageId: resultado.messages?.[0]?.id || `wpp_${Date.now()}`
            });
          }
          else if (canal === 'email') {
            if (!destinatario.email) {
              resultados.push({ canal: 'email', destinatario: destinatario.nome, status: 'erro', erro: 'Email não disponível' });
              continue;
            }
            resultado = await enviarEmail(destinatario.email, assunto || 'MandatoPro - Comunicado', mensagem);
            resultados.push({
              canal: 'email',
              destinatario: destinatario.nome,
              contato: destinatario.email,
              status: 'enviado',
              messageId: resultado.messageId
            });
          }
          else if (canal === 'sms') {
            if (!destinatario.telefone) {
              resultados.push({ canal: 'sms', destinatario: destinatario.nome, status: 'erro', erro: 'Telefone não disponível' });
              continue;
            }
            resultado = await enviarSMS(destinatario.telefone, mensagem);
            resultados.push({
              canal: 'sms',
              destinatario: destinatario.nome,
              contato: destinatario.telefone,
              status: 'enviado',
              messageId: resultado.messageId
            });
          }
        } catch (error) {
          resultados.push({ canal, destinatario: destinatario.nome, status: 'erro', erro: error.message });
        }
      }
    }

    const sucessos = resultados.filter(r => r.status === 'enviado').length;
    const erros = resultados.filter(r => r.status === 'erro').length;

    // Registrar disparo na tabela comunicacao_disparos
    await supabase.from('comunicacao_disparos').insert({
      mensagem,
      tipo_envio: canais[0]?.toUpperCase() || 'WHATSAPP',
      destinatarios: listaDestinatarios.length,
      enviadas: sucessos,
      falhas: erros,
      status: 'CONCLUIDO',
      data_envio: new Date().toISOString()
    }).catch(err => console.error('Erro ao registrar disparo:', err));

    return res.status(200).json({
      success: sucessos > 0,
      mensagem: `${sucessos} mensagens enviadas, ${erros} erros`,
      resumo: {
        total: resultados.length,
        sucessos,
        erros,
        destinatarios: listaDestinatarios.length,
        canais,
        tipo
      },
      resultados
    });

  } catch (error) {
    console.error('Erro na API de disparo em massa:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar disparo em massa',
      error: error.message
    });
  }
}
