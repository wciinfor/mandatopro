import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

function parseHora(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

function compareEventos(a, b) {
  const dataA = String(a?.data || '');
  const dataB = String(b?.data || '');
  if (dataA !== dataB) {
    return dataA.localeCompare(dataB);
  }

  const horaA = parseHora(a?.hora_inicio || a?.horaInicio || '');
  const horaB = parseHora(b?.hora_inicio || b?.horaInicio || '');
  return horaA.localeCompare(horaB);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Metodo nao permitido' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const { limit } = req.query;
    const userId = usuario.id;
    const nivel = usuario.nivel;
    const limite = Math.min(parseInt(limit || '10', 10), 50);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeISO = hoje.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('agenda_eventos')
      .select('*')
      .gte('data', hojeISO)
      .order('data', { ascending: true })
      .limit(200);

    if (error) {
      return res.status(400).json({ message: 'Erro ao carregar agenda', error: error.message });
    }

    const usuarioId = String(userId);
    let eventos = Array.isArray(data) ? data : [];

    if (String(nivel).toUpperCase() !== 'ADMINISTRADOR') {
      eventos = eventos.filter((evento) => {
        if (String(evento.tipo).toUpperCase() === 'LOCAL') {
          const criador = evento.criado_por_id || evento.criadoPorId || evento.usuario_id || evento.usuarioId || '';
          return String(criador) === usuarioId;
        }
        return true;
      });
    }

    eventos = eventos.sort(compareEventos).slice(0, limite);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ data: eventos });
  } catch (error) {
    return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
}
