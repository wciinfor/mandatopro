import { createServerClient } from '@/lib/supabase-server';
import { normalizarTelefone, toPublicConversa } from '@/lib/atendimento-connect';

export const runtime = 'nodejs';

function getSecret(req) {
  return req.headers['x-mandato-connect-secret'] || req.query.secret || '';
}

function pickFirst(...values) {
  return values.find((value) => value !== null && value !== undefined && String(value).trim() !== '') || '';
}

function extractMessageText(data = {}, body = {}) {
  const message = data.message && typeof data.message === 'object' ? data.message : {};
  return String(pickFirst(
    data.text,
    data.body,
    data.conversation,
    data.caption,
    message.conversation,
    message.extendedTextMessage?.text,
    message.imageMessage?.caption,
    message.videoMessage?.caption,
    message.documentMessage?.caption,
    body.mensagem
  )).trim();
}

function parsePayload(body = {}) {
  const data = body.data || body.message || body;
  const contatoTelefone = normalizarTelefone(
    data.key?.remoteJid || data.remoteJid || data.from || data.phone || data.telefone || data.sender || ''
  );
  const contatoNome = String(data.pushName || data.name || data.nome || body.nome || body.pushName || '').trim();
  const mensagem = extractMessageText(data, body);
  const instanciaNome = String(body.instance || data.instance || data.instanceName || body.instanceName || '').trim();
  const providerMessageId = String(data.key?.id || data.id || data.messageId || body.messageId || '').trim();
  const fromMe = Boolean(data.key?.fromMe || data.fromMe);

  return { contatoTelefone, contatoNome, mensagem, instanciaNome, providerMessageId, fromMe, raw: body };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  }

  const expectedSecret = process.env.MANDATO_CONNECT_WEBHOOK_SECRET || '';
  if (expectedSecret && String(getSecret(req)) !== expectedSecret) {
    return res.status(401).json({ success: false, message: 'Webhook nao autorizado' });
  }

  try {
    const supabase = createServerClient();
    const parsed = parsePayload(req.body || {});

    if (parsed.fromMe) {
      return res.status(200).json({ success: true, ignored: true, reason: 'fromMe' });
    }

    if (!parsed.contatoTelefone || !parsed.mensagem) {
      return res.status(400).json({ success: false, message: 'Payload sem telefone ou mensagem' });
    }

    let instanciaId = null;
    if (parsed.instanciaNome) {
      const { data: instancia } = await supabase
        .from('disparo_instancias')
        .select('id')
        .eq('nome', parsed.instanciaNome)
        .maybeSingle();
      instanciaId = instancia?.id || null;
    }

    const baseQuery = supabase
      .from('atendimento_connect_conversas')
      .select('*')
      .eq('canal', 'whatsapp')
      .eq('contato_telefone', parsed.contatoTelefone);

    const { data: existente } = instanciaId
      ? await baseQuery.eq('instancia_id', instanciaId).maybeSingle()
      : await baseQuery.is('instancia_id', null).maybeSingle();

    const now = new Date().toISOString();
    let conversa = existente;

    if (!conversa) {
      const { data, error } = await supabase
        .from('atendimento_connect_conversas')
        .insert({
          contato_nome: parsed.contatoNome || 'Contato sem nome',
          contato_telefone: parsed.contatoTelefone,
          instancia_id: instanciaId,
          status: 'nova',
          unread_count: 1,
          ultima_mensagem: parsed.mensagem,
          ultima_mensagem_em: now,
          metadata: { origem: 'webhook', instanciaNome: parsed.instanciaNome || null }
        })
        .select('*')
        .single();
      if (error) throw error;
      conversa = data;
    } else {
      const { data, error } = await supabase
        .from('atendimento_connect_conversas')
        .update({
          contato_nome: conversa.contato_nome || parsed.contatoNome || 'Contato sem nome',
          status: conversa.status === 'concluida' ? 'nova' : conversa.status,
          unread_count: (conversa.unread_count || 0) + 1,
          ultima_mensagem: parsed.mensagem,
          ultima_mensagem_em: now,
          updated_at: now
        })
        .eq('id', conversa.id)
        .select('*')
        .single();
      if (error) throw error;
      conversa = data;
    }

    await supabase.from('atendimento_connect_mensagens').insert({
      conversa_id: conversa.id,
      direcao: 'entrada',
      mensagem: parsed.mensagem,
      provider_message_id: parsed.providerMessageId || null,
      raw_payload: parsed.raw
    });

    return res.status(200).json({ success: true, data: toPublicConversa(conversa) });
  } catch (error) {
    console.error('Erro no webhook Atendimento Connect:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Erro interno' });
  }
}
