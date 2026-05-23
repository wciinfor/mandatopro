import { obterUsuarioAutenticado } from '@/lib/api-auth';
import { gerarTraceId } from '@/lib/financeiro-utils';
import { obterSupabaseServer, normalizarNivel, obterNivelPermitidoParaDestino, validarUsuario } from '@/lib/comunicacao-permissoes';

export const runtime = 'nodejs';

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

    const { data, error } = await supabase
      .from('usuarios')
      .select('id,nome,nivel,ativo,status')
      .eq('nivel', nivelDestino)
      .eq('ativo', true)
      .neq('id', Number(usuario.id))
      .order('nome', { ascending: true });

    if (error) {
      return res.status(400).json({ message: error.message, traceId });
    }

    const contatos = (data || []).map(u => ({
      id: u.id,
      nome: u.nome,
      nivel: normalizarNivel(u.nivel)
    }));

    return res.status(200).json({ data: contatos, traceId });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error?.message || 'Erro interno', traceId });
  }
}
