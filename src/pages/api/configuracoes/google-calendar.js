import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterContextoMandato } from '@/lib/mandato-auth';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  const supabase = createServerClient();
  let usuarioObj = null;

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);
    usuarioObj = usuario;
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ error: error.message || 'Erro interno' });
  }

  let contextoMandato = null;
  try {
    contextoMandato = await obterContextoMandato(req, usuarioObj, supabase);
  } catch (error) {
    const status = error?.statusCode || 403;
    return res.status(status).json({ error: error.message || 'Erro ao resolver contexto de mandato' });
  }

  // GET: Consultar status da conexão do mandato ativo (SEM EXPÔR TOKENS)
  if (req.method === 'GET') {
    try {
      const { data: conexao, error } = await supabase
        .from('mandatos_google_calendar')
        .select('mandato_id, google_calendar_id, status, created_at, updated_at')
        .eq('mandato_id', contextoMandato.mandatoId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!conexao) {
        return res.status(200).json({
          conectado: false,
          mandatoId: contextoMandato.mandatoId,
          tipoMandato: contextoMandato.tipo,
          status: 'NAO_CONECTADO'
        });
      }

      return res.status(200).json({
        conectado: conexao.status === 'CONECTADO',
        mandatoId: contextoMandato.mandatoId,
        tipoMandato: contextoMandato.tipo,
        googleCalendarId: conexao.google_calendar_id,
        status: conexao.status,
        createdAt: conexao.created_at,
        updatedAt: conexao.updated_at
      });
    } catch (error) {
      console.error('Erro ao consultar status da conexão Google Calendar:', error);
      return res.status(500).json({ error: 'Erro ao consultar conexão do Google Calendar' });
    }
  }

  // DELETE: Desconectar a integração do mandato ativo
  if (req.method === 'DELETE') {
    try {
      const { error } = await supabase
        .from('mandatos_google_calendar')
        .delete()
        .eq('mandato_id', contextoMandato.mandatoId);

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
        message: 'Google Calendar desconectado com sucesso do mandato ativo',
        mandatoId: contextoMandato.mandatoId
      });
    } catch (error) {
      console.error('Erro ao desconectar Google Calendar:', error);
      return res.status(500).json({ error: 'Erro ao desconectar Google Calendar' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
