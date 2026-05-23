import { obterUsuarioAutenticado } from '@/lib/api-auth';
import { gerarTraceId } from '@/lib/financeiro-utils';
import {
  obterSupabaseServer,
  normalizarNivel,
  obterNivelPermitidoParaDestino,
  validarUsuario
} from '@/lib/comunicacao-permissoes';

export const runtime = 'nodejs';

function mapConversationDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default async function handler(req, res) {
  const traceId = gerarTraceId();

  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Metodo nao permitido', traceId });
    }

    const supabase = await obterSupabaseServer();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    validarUsuario(usuario);

    const nivelDestino = obterNivelPermitidoParaDestino(usuario?.nivel);
    if (!nivelDestino) {
      return res.status(403).json({ message: 'Sem permissão para usar o chat', traceId });
    }

    const meuId = Number(usuario.id);

    const { data: contatos, error: contatosError } = await supabase
      .from('usuarios')
      .select('id,nome,nivel,ativo,status')
      .eq('nivel', nivelDestino)
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (contatosError) {
      return res.status(400).json({ message: contatosError.message, traceId });
    }

    const contatoIds = (contatos || []).map(c => c.id).filter(Boolean);
    const contatoIdSet = new Set(contatoIds);

    const { data: conversasRaw, error: conversasError } = await supabase
      .from('comunicacao_conversas')
      .select('id,usuario1_id,usuario2_id,ultima_mensagem,data_ultima_mensagem,ativa')
      .eq('ativa', true)
      .or(`usuario1_id.eq.${meuId},usuario2_id.eq.${meuId}`)
      .order('data_ultima_mensagem', { ascending: false });

    if (conversasError) {
      return res.status(400).json({ message: conversasError.message, traceId });
    }

    const convPorContato = new Map();
    for (const conv of conversasRaw || []) {
      const otherId = conv.usuario1_id === meuId ? conv.usuario2_id : conv.usuario1_id;
      if (!contatoIdSet.has(otherId)) continue;
      if (!convPorContato.has(otherId)) {
        convPorContato.set(otherId, conv);
      }
    }

    const naoLidasPorContato = new Map();
    await Promise.all(
      Array.from(convPorContato.keys()).map(async (otherId) => {
        const { count, error } = await supabase
          .from('comunicacao_mensagens')
          .select('id', { count: 'exact', head: true })
          .eq('destinatario_id', meuId)
          .eq('remetente_id', otherId)
          .eq('lida', false);

        if (error) {
          naoLidasPorContato.set(otherId, 0);
          return;
        }
        naoLidasPorContato.set(otherId, count || 0);
      })
    );

    const payload = (contatos || [])
      .filter(c => c.id !== meuId)
      .map(c => {
        const conv = convPorContato.get(c.id);
        return {
          usuario: {
            id: c.id,
            nome: c.nome,
            nivel: normalizarNivel(c.nivel)
          },
          ultimaMensagem: conv?.ultima_mensagem || null,
          dataUltimaMensagem: mapConversationDate(conv?.data_ultima_mensagem),
          naoLidas: naoLidasPorContato.get(c.id) || 0
        };
      })
      .sort((a, b) => {
        if (!a.dataUltimaMensagem && !b.dataUltimaMensagem) {
          return a.usuario.nome.localeCompare(b.usuario.nome);
        }
        if (!a.dataUltimaMensagem) return 1;
        if (!b.dataUltimaMensagem) return -1;
        return new Date(b.dataUltimaMensagem) - new Date(a.dataUltimaMensagem);
      });

    return res.status(200).json({ data: payload, traceId });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error?.message || 'Erro interno', traceId });
  }
}
