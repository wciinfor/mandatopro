import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario, exigirAdministrador } from '@/lib/api-auth';
import { criarInstancia } from '@/lib/disparos/evolution';
import { INSTANCIA_SELECT, sanitizeNomeInstancia, toPublicInstancia } from '@/lib/disparos/instancias';

export const runtime = 'nodejs';

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return String(error?.code || '').toUpperCase() === '42P01'
    || message.includes('disparo_instancias');
}

export default async function handler(req, res) {
  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('disparo_instancias')
        .select(`${INSTANCIA_SELECT}, api_key`)
        .order('created_at', { ascending: false });

      if (error) {
        if (isMissingTableError(error)) {
          return res.status(200).json({
            success: true,
            configurado: false,
            data: [],
            message: 'Tabela disparo_instancias ainda nao criada'
          });
        }
        throw error;
      }

      return res.status(200).json({
        success: true,
        configurado: true,
        data: (data || []).map(toPublicInstancia)
      });
    }

    if (req.method === 'POST') {
      exigirAdministrador(usuario);

      const nome = sanitizeNomeInstancia(req.body?.nome);
      const apiKey = String(req.body?.apiKey || '').trim();

      if (!nome) {
        return res.status(400).json({ success: false, message: 'Nome da instancia e obrigatorio' });
      }

      if (!apiKey) {
        return res.status(400).json({ success: false, message: 'API key da instancia e obrigatoria' });
      }

      const evolutionResponse = await criarInstancia(nome, apiKey);

      const { data, error } = await supabase
        .from('disparo_instancias')
        .insert({
          nome,
          api_key: apiKey,
          provider: 'evolution',
          status: 'aguardando_qr',
          metadata: {
            evolution: evolutionResponse || null,
            origem: 'mandatopro'
          },
          criado_por_id: usuario.id,
          atualizado_por_id: usuario.id
        })
        .select(`${INSTANCIA_SELECT}, api_key`)
        .single();

      if (error) throw error;

      return res.status(201).json({ success: true, data: toPublicInstancia(data) });
    }

    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error('Erro em disparos/instancias:', error);
    return res.status(status).json({
      success: false,
      message: error?.message || 'Erro ao processar instancia',
      details: error?.details || undefined
    });
  }
}
