import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterContextoMandato } from '@/lib/mandato-auth';

export default async function handler(req, res) {
  const { q } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Mínimo 2 caracteres para busca' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    // Resolver mandato ativo e obter IDs de lideranças autorizadas (via liderancas_mandatos)
    const contextoMandato = await obterContextoMandato(req, usuario, supabase);
    const { data: lmData } = await supabase
      .from('liderancas_mandatos')
      .select('lideranca_id')
      .eq('mandato_id', contextoMandato.mandatoId);

    const liderancaIds = (lmData || []).map(r => r.lideranca_id);

    if (!liderancaIds.length) {
      return res.status(200).json([]);
    }

    // Buscar lideranças por nome dentro do mandato ativo
    const { data, error } = await supabase
      .from('liderancas')
      .select('id, nome, cpf, telefone, influencia, area_atuacao')
      .in('id', liderancaIds)
      .ilike('nome', `%${q}%`)
      .eq('status', 'ATIVO')
      .limit(20);

    if (error) throw error;

    return res.status(200).json(data || []);
  } catch (error) {
    console.error('Erro ao buscar lideranças:', error);
    return res.status(400).json({ error: error.message });
  }
}

