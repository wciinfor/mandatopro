// API para envio em massa de mensagens (Email, SMS, WhatsApp)
import { createServerClient } from '@/lib/supabase-server';
import { gerarTraceId, obterUsuarioHeader, exigirAdmin } from '@/lib/financeiro-utils';

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

// Buscar destinatários do Supabase (apenas usuários do sistema)
const buscarDestinatarios = async (supabase, tipo, excluirUsuarioId) => {
  // OBS: a tabela `usuarios` não tem coluna `telefone` no schema base.
  // Para WhatsApp/SMS, tentamos obter telefone via tabela `liderancas` quando houver vínculo.
  let query = supabase
    .from('usuarios')
    .select('id, nome, email, nivel, ativo, status, lideranca_id, liderancas(telefone)')
    .eq('ativo', true)
    .eq('status', 'ATIVO');

  if (tipo === 'liderancas') {
    query = query.eq('nivel', 'LIDERANCA');
  } else if (tipo === 'operadores') {
    query = query.eq('nivel', 'OPERADOR');
  }

  if (excluirUsuarioId) {
    query = query.neq('id', Number(excluirUsuarioId));
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    nome: row.nome,
    email: row.email,
    nivel: row.nivel,
    telefone: row?.liderancas?.telefone || null
  }));
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

async function upsertConversa({ supabase, meuId, otherId, texto }) {
  const now = new Date().toISOString();

  const { data: existente, error: selectError } = await supabase
    .from('comunicacao_conversas')
    .select('id,usuario1_id,usuario2_id')
    .or(`and(usuario1_id.eq.${meuId},usuario2_id.eq.${otherId}),and(usuario1_id.eq.${otherId},usuario2_id.eq.${meuId})`)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (selectError) {
    throw new Error(selectError.message);
  }

  const conv = (existente || [])[0];

  if (conv?.id) {
    const { error: updateError } = await supabase
      .from('comunicacao_conversas')
      .update({
        ultima_mensagem: texto,
        data_ultima_mensagem: now,
        ativa: true,
        updated_at: now
      })
      .eq('id', conv.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
    return;
  }

  const { error: insertError } = await supabase
    .from('comunicacao_conversas')
    .insert([
      {
        usuario1_id: meuId,
        usuario2_id: otherId,
        ultima_mensagem: texto,
        data_ultima_mensagem: now,
        ativa: true,
        created_at: now,
        updated_at: now
      }
    ]);

  if (insertError) {
    throw new Error(insertError.message);
  }
}

async function enviarAvisoInterno({ supabase, remetenteId, destinatarioId, texto }) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('comunicacao_mensagens')
    .insert([
      {
        remetente_id: remetenteId,
        destinatario_id: destinatarioId,
        texto,
        tipo: 'TEXTO',
        data_hora: now,
        lida: false,
        created_at: now,
        updated_at: now
      }
    ])
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await upsertConversa({ supabase, meuId: remetenteId, otherId: destinatarioId, texto });
  return data?.id || null;
}

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
  const traceId = gerarTraceId();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido', traceId });
  }

  const supabase = createServerClient();

  try {
    const usuario = obterUsuarioHeader(req);
    exigirAdmin(usuario);

    const { tipo, mensagem, assunto, canais } = req.body;

    // Validações
    if (!tipo || !['todos', 'liderancas', 'operadores'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de destinatário inválido',
        traceId
      });
    }

    if (!mensagem || mensagem.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Mensagem não pode estar vazia',
        traceId
      });
    }

    if (!canais || canais.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selecione pelo menos um canal',
        traceId
      });
    }

    const canaisNormalizados = (Array.isArray(canais) ? canais : [])
      .map(c => String(c || '').trim().toLowerCase())
      .filter(Boolean);

    const canaisValidos = new Set(['interno', 'whatsapp', 'email', 'sms']);
    if (canaisNormalizados.some(c => !canaisValidos.has(c))) {
      return res.status(400).json({
        success: false,
        message: 'Canal inválido',
        traceId
      });
    }

    if (canaisNormalizados.includes('interno') && tipo !== 'liderancas') {
      return res.status(400).json({
        success: false,
        message: 'Aviso interno disponível apenas para lideranças',
        traceId
      });
    }

    // Buscar destinatários no Supabase
    const listaDestinatarios = await buscarDestinatarios(supabase, tipo, usuario?.id);

    if (listaDestinatarios.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum destinatário encontrado',
        traceId
      });
    }

    // Carregar configuração do WhatsApp do Supabase (se necessário)
    const precisaWhatsApp = canaisNormalizados.includes('whatsapp');
    const config = precisaWhatsApp ? await carregarConfiguracao(supabase) : null;

    // Enviar por cada canal
    const resultados = [];

    const remetenteId = Number(usuario.id);

    for (const destinatario of listaDestinatarios) {
      for (const canal of canaisNormalizados) {
        try {
          let resultado;

          if (canal === 'interno') {
            const messageId = await enviarAvisoInterno({
              supabase,
              remetenteId,
              destinatarioId: Number(destinatario.id),
              texto: mensagem
            });

            resultados.push({
              canal: 'interno',
              destinatario: destinatario.nome,
              contato: destinatario.email || null,
              status: 'enviado',
              messageId: messageId ? `interno_${messageId}` : `interno_${Date.now()}`
            });
          }
          else if (canal === 'whatsapp') {
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
    const tipoEnvioMap = {
      interno: 'EMAIL',
      whatsapp: 'WHATSAPP',
      email: 'EMAIL',
      sms: 'SMS'
    };

    const tipoEnvio = tipoEnvioMap[canaisNormalizados[0]] || 'EMAIL';

    try {
      const { error: insertError } = await supabase.from('comunicacao_disparos').insert({
        titulo: canaisNormalizados.includes('interno') ? 'AVISO_INTERNO' : null,
        mensagem,
        tipo_envio: tipoEnvio,
        destinatarios: listaDestinatarios.length,
        enviadas: sucessos,
        falhas: erros,
        status: 'CONCLUIDO',
        data_envio: new Date().toISOString(),
        criado_por_id: remetenteId
      });
      if (insertError) {
        console.error('Erro ao registrar disparo:', insertError);
      }
    } catch (err) {
      console.error('Erro ao registrar disparo:', err);
    }

    return res.status(200).json({
      success: sucessos > 0,
      mensagem: `${sucessos} mensagens enviadas, ${erros} erros`,
      traceId,
      resumo: {
        total: resultados.length,
        sucessos,
        erros,
        destinatarios: listaDestinatarios.length,
        canais: canaisNormalizados,
        tipo
      },
      resultados
    });

  } catch (error) {
    console.error('Erro na API de disparo em massa:', error);
    const status = error?.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error?.message || 'Erro ao processar disparo em massa',
      traceId
    });
  }
}
