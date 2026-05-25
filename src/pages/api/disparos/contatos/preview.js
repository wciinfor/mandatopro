import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { buscarContatosMandatoPro, contarContatosMandatoPro } from '@/lib/disparos/mandatopro-contatos';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  }

  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const filtros = {
      origem: req.query.origem || 'eleitores',
      limit: req.query.limit || 200,
      cidade: req.query.cidade,
      bairro: req.query.bairro,
      status: req.query.status,
      search: req.query.search,
      campanhaId: req.query.campanhaId
    };

    if (String(req.query.countOnly || '').toLowerCase() === 'true') {
      const resumo = await contarContatosMandatoPro(supabase, filtros);
      return res.status(200).json({
        success: true,
        data: [],
        resumo
      });
    }

    const { contatos, resumo } = await buscarContatosMandatoPro(supabase, filtros);

    return res.status(200).json({
      success: true,
      data: contatos,
      resumo
    });
  } catch (error) {
    console.error('Erro ao previsualizar contatos de disparo:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || 'Erro ao buscar contatos'
    });
  }
}
