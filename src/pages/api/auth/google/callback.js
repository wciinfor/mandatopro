import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterContextoMandato } from '@/lib/mandato-auth';
import { trocarCodigoPorTokens, obterClienteCalendarAutenticado } from '@/lib/google-calendar';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const contextoMandato = await obterContextoMandato(req, usuario, supabase);

    const code = req.query?.code || req.body?.code;
    const state = req.query?.state || req.body?.state;
    const errorParam = req.query?.error || req.body?.error;

    if (errorParam) {
      return res.status(400).json({ error: `Conexão cancelada ou negada pelo Google: ${errorParam}` });
    }

    if (!code) {
      return res.status(400).json({ error: 'Código de autorização (code) ausente' });
    }

    // Validar state se presente para garantir coerência de mandato
    if (state) {
      try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
        if (decodedState.mandatoId && parseInt(decodedState.mandatoId) !== contextoMandato.mandatoId) {
          return res.status(403).json({
            error: 'Incoerência no mandato: O fluxo de autorização foi iniciado em um mandato diferente do seu mandato ativo atual.'
          });
        }
      } catch (e) {
        console.warn('Alerta: Não foi possível decodificar o estado OAuth2, continuando com o mandato ativo validado.');
      }
    }

    // 1. Trocar o código pelos tokens OAuth2
    const tokens = await trocarCodigoPorTokens(code);

    if (!tokens.access_token) {
      return res.status(400).json({ error: 'Falha ao obter token de acesso do Google' });
    }

    // 2. Instanciar cliente da API do Calendar para obter/validar a agenda principal
    const calendarClient = await obterClienteCalendarAutenticado(tokens);
    const { data: primaryCalendar } = await calendarClient.calendars.get({ calendarId: 'primary' });

    const googleCalendarId = primaryCalendar.id || primaryCalendar.summary || 'primary';
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;

    // 3. Obter registro existente para não sobrescrever um refresh_token válido com null
    const { data: conexaoExistente } = await supabase
      .from('mandatos_google_calendar')
      .select('refresh_token')
      .eq('mandato_id', contextoMandato.mandatoId)
      .maybeSingle();

    const refreshTokenFinal = tokens.refresh_token || conexaoExistente?.refresh_token || null;

    // 4. Salvar/Atualizar a conexão no Supabase sem expor tokens
    const { error: upsertError } = await supabase
      .from('mandatos_google_calendar')
      .upsert({
        mandato_id: contextoMandato.mandatoId,
        google_calendar_id: googleCalendarId,
        access_token: tokens.access_token,
        refresh_token: refreshTokenFinal,
        token_expires_at: expiresAt,
        status: 'CONECTADO',
        updated_at: new Date().toISOString()
      }, { onConflict: 'mandato_id' });

    if (upsertError) {
      console.error('Erro ao persistir conexão do Google Calendar:', upsertError.message);
      return res.status(500).json({ error: 'Erro ao salvar conexão com Google Calendar' });
    }

    // Resposta sanitizada (NENHUM TOKEN retornado no JSON)
    return res.status(200).json({
      success: true,
      mandatoId: contextoMandato.mandatoId,
      googleCalendarId: googleCalendarId,
      status: 'CONECTADO'
    });
  } catch (error) {
    console.error('Erro no callback do Google Calendar:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Erro interno ao processar autorização do Google Calendar'
    });
  }
}
