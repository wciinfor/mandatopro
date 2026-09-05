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
  communication_campaigns:campanha_id (id, titulo:nome, status)
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
      const statusFiltro = String(req.query.status || '').trim();
      const search = String(req.query.search || '').trim();
      const telefone = search ? normalizarTelefone(search) : '';

      const LIMITE_POR_COLUNA = 300;
      const statusAlvo = (statusFiltro && ATENDIMENTO_CONNECT_STATUS.includes(statusFiltro))
        ? [statusFiltro]
        : ATENDIMENTO_CONNECT_STATUS;

      const counts = emptyCounts();
      let todasConversas = [];

      const perStatusPromises = statusAlvo.map(async (st) => {
        let query = supabase
          .from('atendimento_connect_conversas')
          .select(SELECT, { count: 'exact' })
          .eq('status', st)
          .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
          .order('updated_at', { ascending: false })
          .limit(LIMITE_POR_COLUNA);

        if (search) {
          query = query.or(`contato_nome.ilike.%${search}%,contato_telefone.ilike.%${telefone || search}%`);
        }

        const { data, count, error } = await query;
        if (error) {
          if (isMissingAtendimentoConnectTable(error)) {
            return { status: st, data: [], count: 0, missingTable: true };
          }
          throw error;
        }

        return { status: st, data: data || [], count: count || 0, missingTable: false };
      });

      const perStatusResults = await Promise.all(perStatusPromises);

      const isMissing = perStatusResults.some(r => r.missingTable);
      if (isMissing) {
        return res.status(200).json({ success: true, configurado: false, data: [], counts: emptyCounts() });
      }

      perStatusResults.forEach((resItem) => {
        counts[resItem.status] = resItem.count;
        todasConversas.push(...resItem.data);
      });

      // Ordena a lista unificada pela última mensagem mais recente
      todasConversas.sort((a, b) => {
        const timeA = new Date(a.ultima_mensagem_em || a.updated_at || 0).getTime();
        const timeB = new Date(b.ultima_mensagem_em || b.updated_at || 0).getTime();
        return timeB - timeA;
      });

      return res.status(200).json({
        success: true,
        configurado: true,
        data: todasConversas.map(toPublicConversa),
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
