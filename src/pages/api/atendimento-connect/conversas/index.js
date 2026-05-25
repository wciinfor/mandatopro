import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import {
  ATENDIMENTO_CONNECT_STATUS,
  exigirAcessoAtendimentoConnect,
  isMissingAtendimentoConnectTable,
  normalizarTelefone,
  toPublicConversa
} from '@/lib/atendimento-connect';

export const runtime = 'nodejs';

const SELECT = `
  *,
  usuarios:responsavel_id (id, nome, nivel),
  eleitores:eleitor_id (id, nome, telefone, celular, whatsapp),
  disparo_campanhas:campanha_id (id, titulo, status)
`;

function emptyCounts() {
  return ATENDIMENTO_CONNECT_STATUS.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});
}

export default async function handler(req, res) {
  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);
    exigirAcessoAtendimentoConnect(usuario);

    if (req.method === 'GET') {
      const status = String(req.query.status || '').trim();
      const search = String(req.query.search || '').trim();

      let query = supabase
        .from('atendimento_connect_conversas')
        .select(SELECT)
        .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false })
        .limit(150);

      if (status && ATENDIMENTO_CONNECT_STATUS.includes(status)) {
        query = query.eq('status', status);
      }
      if (search) {
        const telefone = normalizarTelefone(search);
        query = query.or(`contato_nome.ilike.%${search}%,contato_telefone.ilike.%${telefone || search}%`);
      }

      const { data, error } = await query;
      if (error) {
        if (isMissingAtendimentoConnectTable(error)) {
          return res.status(200).json({ success: true, configurado: false, data: [], counts: emptyCounts() });
        }
        throw error;
      }

      const { data: countRows } = await supabase
        .from('atendimento_connect_conversas')
        .select('status');

      const counts = emptyCounts();
      (countRows || []).forEach((row) => {
        if (counts[row.status] !== undefined) counts[row.status] += 1;
      });

      return res.status(200).json({
        success: true,
        configurado: true,
        data: (data || []).map(toPublicConversa),
        counts
      });
    }

    if (req.method === 'POST') {
      const contatoNome = String(req.body?.contatoNome || req.body?.nome || '').trim();
      const contatoTelefone = normalizarTelefone(req.body?.contatoTelefone || req.body?.telefone);
      const mensagem = String(req.body?.mensagem || '').trim();

      if (!contatoTelefone) {
        return res.status(400).json({ success: false, message: 'Telefone do contato e obrigatorio' });
      }

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('atendimento_connect_conversas')
        .insert({
          contato_nome: contatoNome || 'Contato sem nome',
          contato_telefone: contatoTelefone,
          status: 'nova',
          ultima_mensagem: mensagem || 'Conversa criada manualmente',
          ultima_mensagem_em: now,
          unread_count: mensagem ? 1 : 0,
          metadata: { origem: 'manual' },
          criado_por_id: usuario.id,
          atualizado_por_id: usuario.id
        })
        .select(SELECT)
        .single();

      if (error) throw error;

      if (mensagem) {
        await supabase.from('atendimento_connect_mensagens').insert({
          conversa_id: data.id,
          direcao: 'entrada',
          mensagem,
          usuario_id: usuario.id,
          raw_payload: { origem: 'manual' }
        });
      }

      return res.status(201).json({ success: true, data: toPublicConversa(data) });
    }

    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error('Erro em atendimento-connect/conversas:', error);
    return res.status(status).json({ success: false, message: error?.message || 'Erro interno' });
  }
}
