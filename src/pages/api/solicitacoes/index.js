/**
 * API: /api/solicitacoes
 * 
 * NOTA DE MIGRAÇÃO: execute no Supabase SQL Editor para adequar o constraint de status:
 *   ALTER TABLE solicitacoes DROP CONSTRAINT IF EXISTS solicitacoes_status_check;
 *   ALTER TABLE solicitacoes ADD CONSTRAINT solicitacoes_status_check
 *     CHECK (status IN ('NOVO', 'RECEBIDO', 'ATENDIDO', 'RECUSADO'));
 *   UPDATE solicitacoes SET status = 'RECEBIDO' WHERE status = 'EM_ANDAMENTO';
 *   UPDATE solicitacoes SET status = 'ATENDIDO'  WHERE status = 'ATENDIDA';
 *   UPDATE solicitacoes SET status = 'RECUSADO'  WHERE status = 'RECUSADA';
 */

import { createServerClient } from '@/lib/supabase-server';
import { gerarTraceId, obterUsuarioHeader } from '@/lib/financeiro-utils';

function nivelUsuario(usuario) {
  return String(usuario?.nivel || '').toUpperCase();
}

function podeAcessarSolicitacoes(usuario) {
  const nivel = nivelUsuario(usuario);
  return nivel === 'ADMINISTRADOR' || nivel === 'LIDERANCA';
}

function isLideranca(usuario) {
  return nivelUsuario(usuario) === 'LIDERANCA';
}

function isAdmin(usuario) {
  return nivelUsuario(usuario) === 'ADMINISTRADOR';
}

export default async function handler(req, res) {
  const traceId = gerarTraceId();
  const usuario = obterUsuarioHeader(req);

  if (!usuario) {
    return res.status(401).json({ message: 'Não autenticado', traceId });
  }

  if (!podeAcessarSolicitacoes(usuario)) {
    return res.status(403).json({ message: 'Acesso restrito para liderança e administrador', traceId });
  }

  const supabase = createServerClient();

  // ────────────────────────────────────────────────────────────
  // GET — listar solicitações com filtros + totais por status
  // ────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const {
        search,
        status,
        prioridade,
        categoria,
        limit = '50',
        offset = '0',
      } = req.query;

      const lim = Math.min(parseInt(limit, 10) || 50, 200);
      const off = Math.max(parseInt(offset, 10) || 0, 0);

      const aplicarEscopo = (query) => {
        if (isLideranca(usuario)) {
          const emailUsuario = String(usuario?.email || '').trim().toLowerCase();
          return query.eq('email', emailUsuario || '__sem_email__');
        }
        return query;
      };

      const aplicarFiltros = (query) => {
        let q = aplicarEscopo(query);

        if (search) {
          q = q.or(
            `titulo.ilike.%${search}%,solicitante.ilike.%${search}%,protocolo.ilike.%${search}%`
          );
        }
        if (status) q = q.eq('status', status);
        if (prioridade) q = q.eq('prioridade', prioridade);
        if (categoria) q = q.eq('categoria', categoria);

        return q;
      };

      // Query paginada com filtros
      let query = aplicarFiltros(supabase
        .from('solicitacoes')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(off, off + lim - 1));

      const queryTotais = aplicarEscopo(
        supabase.from('solicitacoes').select('status')
      );

      // Totais por status (apenas coluna status, sem paginação)
      const [{ data, error, count }, { data: todosStatus, error: errStats }] =
        await Promise.all([
          query,
          queryTotais,
        ]);

      if (error) throw error;
      if (errStats) throw errStats;

      const totais = { total: (todosStatus || []).length, NOVO: 0, RECEBIDO: 0, ATENDIDO: 0, RECUSADO: 0 };
      (todosStatus || []).forEach((s) => {
        if (totais[s.status] !== undefined) totais[s.status]++;
      });

      return res.status(200).json({
        data: data || [],
        total: count || 0,
        totais,
        traceId,
      });
    } catch (err) {
      return res.status(400).json({ message: err.message, traceId });
    }
  }

  // ────────────────────────────────────────────────────────────
  // POST — criar nova solicitação
  // ────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = req.body || {};

      const lideranca = isLideranca(usuario);
      const admin = isAdmin(usuario);
      const nomeUsuario = String(usuario?.nome || '').trim();
      const emailUsuario = String(usuario?.email || '').trim().toLowerCase();

      let solicitante = '';
      let tipoSolicitante = 'LIDERANCA';
      let emailSolicitante = null;
      let telefoneSolicitante = null;

      if (lideranca) {
        solicitante = nomeUsuario;
        tipoSolicitante = 'LIDERANCA';
        emailSolicitante = emailUsuario || null;
        telefoneSolicitante = body.telefone || usuario?.telefone || null;
      } else if (admin) {
        const liderancaId = Number(body.lideranca_id || 0);

        if (liderancaId > 0) {
          const { data: liderancaSelecionada, error: erroLideranca } = await supabase
            .from('liderancas')
            .select('id, nome, email, telefone, status')
            .eq('id', liderancaId)
            .maybeSingle();

          if (erroLideranca || !liderancaSelecionada) {
            return res.status(422).json({ message: 'Lideranca selecionada nao foi encontrada', traceId });
          }

          if (String(liderancaSelecionada.status || '').toUpperCase() !== 'ATIVO') {
            return res.status(422).json({ message: 'Lideranca selecionada precisa estar ativa', traceId });
          }

          solicitante = String(liderancaSelecionada.nome || '').trim();
          tipoSolicitante = 'LIDERANCA';
          emailSolicitante = String(liderancaSelecionada.email || '').trim().toLowerCase() || null;
          telefoneSolicitante = String(liderancaSelecionada.telefone || '').trim() || null;
        } else {
          solicitante = nomeUsuario;
          tipoSolicitante = 'ADMINISTRADOR';
          emailSolicitante = emailUsuario || null;
          telefoneSolicitante = body.telefone || usuario?.telefone || null;
        }
      }

      if (!body.titulo || !solicitante) {
        return res.status(422).json({ message: 'Título e Solicitante são obrigatórios', traceId });
      }

      const protocolo = `SOL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      const { data, error } = await supabase
        .from('solicitacoes')
        .insert([
          {
            protocolo,
            titulo: body.titulo,
            descricao: body.descricao || null,
            solicitante,
            tipo_solicitante: tipoSolicitante,
            categoria: body.categoria || null,
            prioridade: body.prioridade || 'MÉDIA',
            municipio: body.municipio || null,
            bairro: body.bairro || null,
            endereco: body.endereco || null,
            telefone: telefoneSolicitante,
            email: emailSolicitante,
            status: 'NOVO',
            data_abertura: new Date().toISOString().slice(0, 10),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ data, traceId });
    } catch (err) {
      return res.status(400).json({ message: err.message, traceId });
    }
  }

  return res.status(405).json({ message: 'Método não permitido', traceId });
}
