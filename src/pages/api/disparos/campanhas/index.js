import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAcessoMandatoConnect, exigirAdministradorOuSupervisorConnect } from '@/lib/api-auth';

export const runtime = 'nodejs';

const CAMPANHA_SELECT = `
  id,
  titulo,
  mensagem,
  instancia_id,
  origem_contatos,
  filtros,
  status,
  total_contatos,
  total_validos,
  total_invalidos,
  total_enviados,
  total_falhas,
  intervalo_min_segundos,
  intervalo_max_segundos,
  agendada_para,
  created_at,
  updated_at,
  disparo_instancias (
    id,
    nome,
    status
  )
`;

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return String(error?.code || '').toUpperCase() === '42P01'
    || message.includes('disparo_campanhas');
}

function toPublicCampanha(row) {
  if (!row) return null;
  return {
    id: row.id,
    titulo: row.titulo,
    mensagem: row.mensagem,
    instanciaId: row.instancia_id,
    instancia: row.disparo_instancias || null,
    origemContatos: row.origem_contatos,
    filtros: row.filtros || {},
    status: row.status,
    totalContatos: row.total_contatos || 0,
    totalValidos: row.total_validos || 0,
    totalInvalidos: row.total_invalidos || 0,
    totalEnviados: row.total_enviados || 0,
    totalFalhas: row.total_falhas || 0,
    intervaloMinSegundos: row.intervalo_min_segundos || 0,
    intervaloMaxSegundos: row.intervalo_max_segundos || 0,
    agendadaPara: row.agendada_para || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function normalizarCampanha(body = {}) {
  const titulo = String(body.titulo || '').trim();
  const mensagem = String(body.mensagem || '').trim();
  const instanciaId = body.instanciaId ? Number(body.instanciaId) : null;
  const origemContatos = String(body.origemContatos || 'filtros');
  const intervaloMin = Number(body.intervaloMinSegundos || 60);
  const intervaloMax = Number(body.intervaloMaxSegundos || 120);

  if (!titulo) throw new Error('Titulo da campanha e obrigatorio');
  if (!mensagem) throw new Error('Mensagem da campanha e obrigatoria');
  if (!['filtros', 'csv', 'misto', 'manual'].includes(origemContatos)) {
    throw new Error('Origem dos contatos invalida');
  }
  if (!Number.isFinite(intervaloMin) || intervaloMin < 1) throw new Error('Intervalo minimo invalido');
  if (!Number.isFinite(intervaloMax) || intervaloMax < intervaloMin) {
    throw new Error('Intervalo maximo deve ser maior ou igual ao minimo');
  }

  return {
    titulo,
    mensagem,
    instancia_id: Number.isFinite(instanciaId) ? instanciaId : null,
    origem_contatos: origemContatos,
    filtros: body.filtros && typeof body.filtros === 'object' ? body.filtros : {},
    status: body.status || 'rascunho',
    intervalo_min_segundos: Math.round(intervaloMin),
    intervalo_max_segundos: Math.round(intervaloMax),
    agendada_para: body.agendadaPara || null
  };
}

export default async function handler(req, res) {
  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAcessoMandatoConnect(usuario);

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('disparo_campanhas')
        .select(CAMPANHA_SELECT)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        if (isMissingTableError(error)) {
          return res.status(200).json({ success: true, configurado: false, data: [] });
        }
        throw error;
      }

      return res.status(200).json({
        success: true,
        configurado: true,
        data: (data || []).map(toPublicCampanha)
      });
    }

    if (req.method === 'POST') {
      exigirAdministradorOuSupervisorConnect(usuario);

      const payload = normalizarCampanha(req.body || {});
      const { data, error } = await supabase
        .from('disparo_campanhas')
        .insert({
          ...payload,
          criado_por_id: usuario.id,
          atualizado_por_id: usuario.id
        })
        .select(CAMPANHA_SELECT)
        .single();

      if (error) throw error;

      return res.status(201).json({ success: true, data: toPublicCampanha(data), message: 'Campanha salva' });
    }

    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  } catch (error) {
    const status = error?.statusCode || (error?.message?.includes('inval') || error?.message?.includes('obrigator') ? 400 : 500);
    console.error('Erro em disparos/campanhas:', error);
    return res.status(status).json({
      success: false,
      message: error?.message || 'Erro ao processar campanha'
    });
  }
}
