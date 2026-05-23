import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado } from '@/lib/api-auth';
import { gerarTraceId } from '@/lib/financeiro-utils';
import { ROLES } from '@/utils/permissions';

export const runtime = 'nodejs';

function normalizarNivel(nivel) {
  return String(nivel || '').toUpperCase();
}

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return code === '42P01' || (message.includes('notificacoes') && message.includes('does not exist'));
}

async function buscarDestinatariosAdmin({ supabase, excluirId }) {
  const query = supabase
    .from('usuarios')
    .select('id,nome,nivel,ativo,status')
    .eq('ativo', true)
    .eq('status', 'ATIVO')
    .in('nivel', [ROLES.LIDERANCA, ROLES.OPERADOR])
    .neq('id', Number(excluirId));

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((u) => ({ id: u.id, nome: u.nome, nivel: u.nivel }));
}

async function buscarDestinatariosLideranca({ supabase, usuario }) {
  const meuId = Number(usuario?.id);

  const { data: eu, error: euError } = await supabase
    .from('usuarios')
    .select('id,lideranca_id,nivel,ativo,status')
    .eq('id', meuId)
    .maybeSingle();

  if (euError) {
    throw euError;
  }

  const liderancaIdNumero = Number(eu?.lideranca_id);

  if (!liderancaIdNumero || Number.isNaN(liderancaIdNumero)) {
    const err = new Error('Sua liderança não está vinculada (lideranca_id)');
    err.statusCode = 400;
    throw err;
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('id,nome,nivel,ativo,status,lideranca_id')
    .eq('ativo', true)
    .eq('status', 'ATIVO')
    .eq('nivel', ROLES.OPERADOR)
    .eq('lideranca_id', liderancaIdNumero)
    .neq('id', meuId);

  if (error) throw error;

  return (data || []).map((u) => ({ id: u.id, nome: u.nome, nivel: u.nivel }));
}

async function inserirEmLotes({ supabase, rows, chunkSize = 500 }) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from('notificacoes').insert(chunk);
    if (error) throw error;
  }
}

export default async function handler(req, res) {
  const traceId = gerarTraceId();

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Metodo nao permitido', traceId });
    }

    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    if (!usuario?.id) {
      return res.status(401).json({ message: 'Nao autenticado', traceId });
    }

    const nivel = normalizarNivel(usuario.nivel);
    const body = req.body || {};

    const titulo = String(body.titulo || '').trim();
    const mensagem = String(body.mensagem || '').trim();

    if (!mensagem) {
      return res.status(400).json({ message: 'Mensagem não pode estar vazia', traceId });
    }

    let destinatarios = [];
    let destinoDescricao = '';

    if (nivel === ROLES.ADMINISTRADOR) {
      destinatarios = await buscarDestinatariosAdmin({ supabase, excluirId: usuario.id });
      destinoDescricao = 'LIDERANCAS_E_OPERADORES';
    } else if (nivel === ROLES.LIDERANCA) {
      destinatarios = await buscarDestinatariosLideranca({ supabase, usuario });
      destinoDescricao = 'MEUS_OPERADORES';
    } else {
      return res.status(403).json({ message: 'Sem permissão para enviar notificações', traceId });
    }

    if (destinatarios.length === 0) {
      return res.status(400).json({ message: 'Nenhum destinatário encontrado', traceId, destino: destinoDescricao });
    }

    const now = new Date().toISOString();
    const remetenteNome = usuario?.nome || null;
    const remetenteNivel = nivel || null;

    const payload = destinatarios.map((d) => ({
      remetente_id: Number(usuario.id),
      remetente_nome: remetenteNome,
      remetente_nivel: remetenteNivel,
      destinatario_id: Number(d.id),
      titulo: titulo || null,
      mensagem,
      lida: false,
      created_at: now,
      updated_at: now
    }));

    try {
      await inserirEmLotes({ supabase, rows: payload });
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(500).json({
          message: 'Tabela de notificações não encontrada. Execute a migration 002_create_notificacoes.sql no Supabase.',
          traceId
        });
      }
      throw error;
    }

    return res.status(200).json({
      success: true,
      message: 'Notificações enviadas com sucesso',
      traceId,
      destino: destinoDescricao,
      destinatarios: destinatarios.length
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error?.message || 'Erro interno', traceId });
  }
}
