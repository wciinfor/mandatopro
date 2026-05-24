import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

function toClientInstance(row) {
  return {
    id: row.id,
    name: row.name,
    apikey: row.apikey,
    status: row.status || 'disconnected',
    totalSent: row.total_sent || 0,
    successCount: row.success_count || 0,
    errorCount: row.error_count || 0,
    lastCheck: row.last_check || null,
    _supabaseId: row.id
  };
}

function normalizeInstance(body = {}) {
  const name = String(body.name || '').trim();
  const apikey = String(body.apikey || '').trim();

  if (!name) {
    const error = new Error('Nome da instancia e obrigatorio');
    error.statusCode = 400;
    throw error;
  }

  if (!apikey) {
    const error = new Error('Token/API key da instancia e obrigatorio');
    error.statusCode = 400;
    throw error;
  }

  return {
    name,
    apikey,
    status: body.status || 'disconnected',
    total_sent: Number(body.totalSent || body.total_sent || 0),
    success_count: Number(body.successCount || body.success_count || 0),
    error_count: Number(body.errorCount || body.error_count || 0),
    last_check: body.lastCheck || body.last_check || null,
    updated_at: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('instances')
        .select('*')
        .eq('user_id', usuario.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: (data || []).map(toClientInstance)
      });
    }

    if (req.method === 'POST') {
      const payload = {
        user_id: usuario.id,
        ...normalizeInstance(req.body || {})
      };

      const { data, error } = await supabase
        .from('instances')
        .upsert(payload, { onConflict: 'user_id,name' })
        .select('*')
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: toClientInstance(data)
      });
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query?.id || req.body?.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ success: false, message: 'ID invalido' });
      }

      const { error } = await supabase
        .from('instances')
        .delete()
        .eq('id', id)
        .eq('user_id', usuario.id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error('Erro em instancias-runtime:', error);
    return res.status(status).json({
      success: false,
      message: error?.message || 'Erro ao persistir instancia'
    });
  }
}
