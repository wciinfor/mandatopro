import { gerarTraceId, obterUsuarioHeader } from '@/lib/financeiro-utils';
import { obterSupabaseServer, validarParDeChat, validarUsuario } from '@/lib/comunicacao-permissoes';

export const runtime = 'nodejs';

function mapMensagem(row) {
  if (!row) return null;
  return {
    id: row.id,
    remetenteId: row.remetente_id,
    destinatarioId: row.destinatario_id,
    texto: row.texto,
    dataHora: row.data_hora ? new Date(row.data_hora).toISOString() : null,
    lida: !!row.lida,
    tipo: row.tipo || 'TEXTO'
  };
}

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

export default async function handler(req, res) {
  const traceId = gerarTraceId();

  try {
    const usuario = obterUsuarioHeader(req);
    validarUsuario(usuario);

    const supabase = await obterSupabaseServer();
    const meuId = Number(usuario.id);

    if (req.method === 'GET') {
      const destinatarioId = req.query?.destinatarioId;
      await validarParDeChat({ supabase, usuarioOrigem: usuario, destinatarioId });
      const otherId = Number(destinatarioId);

      const { data, error } = await supabase
        .from('comunicacao_mensagens')
        .select('id,remetente_id,destinatario_id,texto,tipo,data_hora,lida')
        .or(`and(remetente_id.eq.${meuId},destinatario_id.eq.${otherId}),and(remetente_id.eq.${otherId},destinatario_id.eq.${meuId})`)
        .order('data_hora', { ascending: true })
        .limit(200);

      if (error) {
        return res.status(400).json({ message: error.message, traceId });
      }

      return res.status(200).json({ data: (data || []).map(mapMensagem), traceId });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const destinatarioId = body.destinatarioId;
      const texto = String(body.texto || '').trim();

      if (!texto) {
        return res.status(400).json({ message: 'Mensagem vazia', traceId });
      }

      await validarParDeChat({ supabase, usuarioOrigem: usuario, destinatarioId });
      const otherId = Number(destinatarioId);
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('comunicacao_mensagens')
        .insert([
          {
            remetente_id: meuId,
            destinatario_id: otherId,
            texto,
            tipo: 'TEXTO',
            data_hora: now,
            lida: false,
            created_at: now,
            updated_at: now
          }
        ])
        .select('id,remetente_id,destinatario_id,texto,tipo,data_hora,lida')
        .single();

      if (error) {
        return res.status(400).json({ message: error.message, traceId });
      }

      await upsertConversa({ supabase, meuId, otherId, texto });

      return res.status(201).json({ data: mapMensagem(data), traceId });
    }

    return res.status(405).json({ message: 'Metodo nao permitido', traceId });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error?.message || 'Erro interno', traceId });
  }
}
