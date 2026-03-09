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

export default async function handler(req, res) {
  const traceId = gerarTraceId();
  const usuario = obterUsuarioHeader(req);

  if (!usuario) {
    return res.status(401).json({ message: 'Não autenticado', traceId });
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

      // Query paginada com filtros
      let query = supabase
        .from('solicitacoes')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(off, off + lim - 1);

      if (search) {
        query = query.or(
          `titulo.ilike.%${search}%,solicitante.ilike.%${search}%,protocolo.ilike.%${search}%`
        );
      }
      if (status) query = query.eq('status', status);
      if (prioridade) query = query.eq('prioridade', prioridade);
      if (categoria) query = query.eq('categoria', categoria);

      // Totais por status (apenas coluna status, sem paginação)
      const [{ data, error, count }, { data: todosStatus, error: errStats }] =
        await Promise.all([
          query,
          supabase.from('solicitacoes').select('status'),
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

      if (!body.titulo || !body.solicitante) {
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
            solicitante: body.solicitante,
            tipo_solicitante: body.tipo_solicitante || 'LIDERANCA',
            categoria: body.categoria || null,
            prioridade: body.prioridade || 'MÉDIA',
            municipio: body.municipio || null,
            bairro: body.bairro || null,
            endereco: body.endereco || null,
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
