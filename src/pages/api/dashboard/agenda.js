import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Metodo nao permitido' });
  }

  try {
    const { userId, nivel, limit } = req.query;
    if (!userId || !nivel) {
      return res.status(400).json({ message: 'Parametros obrigatorios ausentes' });
    }

    const supabase = createServerClient();
    const limite = Math.min(parseInt(limit || '10', 10), 50);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeISO = hoje.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('agenda_eventos')
      .select('id, titulo, data, hora_inicio, hora_fim, horaInicio, horaFim, local, tipo, categoria, confirmados, participantes, criado_por_id')
      .gte('data', hojeISO)
      .order('data', { ascending: true })
      .order('hora_inicio', { ascending: true })
      .limit(limite);

    if (error) {
      return res.status(400).json({ message: 'Erro ao carregar agenda', error: error.message });
    }

    const usuarioId = String(userId);
    let eventos = Array.isArray(data) ? data : [];

    if (String(nivel).toUpperCase() !== 'ADMINISTRADOR') {
      eventos = eventos.filter((evento) => {
        if (String(evento.tipo).toUpperCase() === 'LOCAL') {
          return String(evento.criado_por_id || '') === usuarioId;
        }
        return true;
      });
    }

    return res.status(200).json({ data: eventos });
  } catch (error) {
    return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
}
