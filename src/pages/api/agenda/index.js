import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterContextoMandato, validarAcessoRegistroPorId } from '@/lib/mandato-auth';

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

  if (req.method === 'GET') {
    try {
      // 1. Eventos próprios da tabela agenda_eventos
      let query = supabase.from('agenda_eventos').select('*');

      // Estadual inclui legados (NULL), Federal filtra estritamente mandato_id = 2
      if (contextoMandato.mandatoId === 1) {
        query = query.or(`mandato_id.eq.${contextoMandato.mandatoId},mandato_id.is.null`);
      } else {
        query = query.eq('mandato_id', contextoMandato.mandatoId);
      }

      const { data: eventosInternos, error } = await query.order('data', { ascending: true });

      if (error) throw error;

      // Tag de origem aos eventos internos do MandatoPRO
      const listaInternos = (eventosInternos || []).map((e) => ({
        ...e,
        origem: 'MANDATOPRO',
      }));

      let eventosGoogleNormalizados = [];

      // 2. Tentar carregar eventos do Google Calendar se o mandato ativo possuir integração CONECTADO
      try {
        const { data: gcalConexao } = await supabase
          .from('mandatos_google_calendar')
          .select('mandato_id, google_calendar_id, access_token, refresh_token, token_expires_at, status')
          .eq('mandato_id', contextoMandato.mandatoId)
          .eq('status', 'CONECTADO')
          .maybeSingle();

        if (gcalConexao && gcalConexao.access_token) {
          const { obterClienteCalendarAutenticado } = await import('@/lib/google-calendar');

          // Callback para salvar novo access_token se houver auto-refresh
          const onTokenRefreshed = async (novosTokens) => {
            const updates = {
              access_token: novosTokens.access_token,
              token_expires_at: novosTokens.expiry_date ? new Date(novosTokens.expiry_date).toISOString() : null,
              updated_at: new Date().toISOString(),
            };
            if (novosTokens.refresh_token) {
              updates.refresh_token = novosTokens.refresh_token;
            }
            await supabase
              .from('mandatos_google_calendar')
              .update(updates)
              .eq('mandato_id', contextoMandato.mandatoId);
          };

          const calendarClient = await obterClienteCalendarAutenticado(gcalConexao, onTokenRefreshed);

          // Buscar eventos do Google (ex: janela de 6 meses atrás até 1 ano à frente para fluidez)
          const timeMin = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
          const timeMax = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

          const gres = await calendarClient.events.list({
            calendarId: gcalConexao.google_calendar_id || 'primary',
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 250,
          });

          const itemsGoogle = gres.data?.items || [];

          eventosGoogleNormalizados = itemsGoogle.map((gEv) => {
            const isAllDay = Boolean(gEv.start?.date && !gEv.start?.dateTime);
            const rawDataInicio = gEv.start?.dateTime || gEv.start?.date || '';
            const rawDataFim = gEv.end?.dateTime || gEv.end?.date || '';

            // Formatação de data (YYYY-MM-DD) e horas (HH:mm)
            const dataStr = rawDataInicio.slice(0, 10);
            const horaInicioStr = !isAllDay && rawDataInicio.includes('T') ? rawDataInicio.split('T')[1].slice(0, 5) : null;
            const horaFimStr = !isAllDay && rawDataFim.includes('T') ? rawDataFim.split('T')[1].slice(0, 5) : null;

            return {
              id: `gcal_${gEv.id}`,
              googleEventId: gEv.id,
              titulo: gEv.summary || '(Sem título)',
              descricao: gEv.description || '',
              data: dataStr,
              hora_inicio: horaInicioStr,
              hora_fim: horaFimStr,
              horaInicio: horaInicioStr,
              horaFim: horaFimStr,
              local: gEv.location || '',
              municipio: gEv.location || '',
              tipo: isAllDay ? 'DIA_INTEIRO' : 'COMPROMISSO_GOOGLE',
              categoria: 'GOOGLE_CALENDAR',
              status: gEv.status === 'confirmed' ? 'CONFIRMADO' : (gEv.status === 'cancelled' ? 'CANCELADO' : 'AGENDADO'),
              observacoes: gEv.htmlLink ? `Link Google: ${gEv.htmlLink}` : '',
              origem: 'GOOGLE',
              isAllDay,
            };
          });
        }
      } catch (gcalErr) {
        // Falha no Google Calendar NÃO derruba a agenda própria do MandatoPRO
        console.warn(`[GCal Isolation Warn] Falha ao consultar Google Calendar para o mandato ${contextoMandato.mandatoId}:`, gcalErr?.message || gcalErr);
      }

      // 3. Mesclar agendas e ordenar por data e hora_inicio
      const agendaMesclada = [...listaInternos, ...eventosGoogleNormalizados].sort((a, b) => {
        const dataA = String(a.data || '');
        const dataB = String(b.data || '');
        if (dataA !== dataB) return dataA.localeCompare(dataB);
        const horaA = String(a.hora_inicio || a.horaInicio || '00:00');
        const horaB = String(b.hora_inicio || b.horaInicio || '00:00');
        return horaA.localeCompare(horaB);
      });

      return res.status(200).json({ data: agendaMesclada });
    } catch (error) {
      console.error('Erro ao listar agenda:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      // Garante que o mandato_id gravado seja estritamente o mandato ativo resolvido
      const payload = {
        ...body,
        mandato_id: contextoMandato.mandatoId,
      };

      const { data, error } = await supabase
        .from('agenda_eventos')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ data });
    } catch (error) {
      console.error('Erro ao criar evento:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, ...body } = req.body || {};
      if (!id) return res.status(400).json({ error: 'ID obrigatório' });

      // Validar autorização de acesso ao evento por mandato
      const valAcc = await validarAcessoRegistroPorId('AGENDA', id, contextoMandato, supabase);
      if (!valAcc.autorizado) {
        return res.status(valAcc.status).json({ error: valAcc.message });
      }

      // Impede sobrescrever o mandato_id do evento
      const payload = { ...body };
      delete payload.mandato_id;

      const { data, error } = await supabase
        .from('agenda_eventos')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ data });
    } catch (error) {
      console.error('Erro ao atualizar evento:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID obrigatório' });

      // Validar autorização de acesso ao evento por mandato
      const valAcc = await validarAcessoRegistroPorId('AGENDA', id, contextoMandato, supabase);
      if (!valAcc.autorizado) {
        return res.status(valAcc.status).json({ error: valAcc.message });
      }

      const { error } = await supabase
        .from('agenda_eventos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
