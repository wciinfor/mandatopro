import { createServerClient } from '@/lib/supabase-server';
import {
  gerarTraceId,
  obterUsuarioHeader,
  exigirAdmin,
  normalizarValor,
  registrarAuditoria,
  buildAuditoriaPayload
} from '@/lib/financeiro-utils';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  const traceId = gerarTraceId();
  const { id } = req.query;

  try {
    const usuario = obterUsuarioHeader(req);
    exigirAdmin(usuario);

    const supabase = createServerClient();
    const despesaId = parseInt(id, 10);

    if (Number.isNaN(despesaId)) {
      return res.status(400).json({ message: 'Id invalido', traceId });
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('financeiro_despesas')
        .select('*')
        .eq('id', despesaId)
        .single();

      if (error || !data) {
        return res.status(404).json({ message: 'Despesa nao encontrada', traceId });
      }

      return res.status(200).json({ data, traceId });
    }

    if (req.method === 'PUT') {
      const { data: anterior } = await supabase
        .from('financeiro_despesas')
        .select('*')
        .eq('id', despesaId)
        .single();

      const body = req.body || {};
      const payload = {
        codigo: normalizarValor(body.codigo),
        data_despesa: body.data_despesa,
        tipo: body.tipo ? String(body.tipo).toUpperCase() : undefined,
        categoria: normalizarValor(body.categoria),
        fornecedor_nome: normalizarValor(body.fornecedor_nome),
        parceiro_id: body.parceiro_id ? parseInt(body.parceiro_id, 10) : null,
        valor: body.valor !== undefined ? Number(body.valor) : undefined,
        forma_pagamento: normalizarValor(body.forma_pagamento),
        vencimento: normalizarValor(body.vencimento),
        nota_fiscal: normalizarValor(body.nota_fiscal),
        descricao: normalizarValor(body.descricao),
        status: body.status ? String(body.status).toUpperCase() : undefined,
        atualizado_por: usuario?.id || null,
        updated_at: new Date().toISOString()
      };

      Object.keys(payload).forEach((key) => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      const { data, error } = await supabase
        .from('financeiro_despesas')
        .update(payload)
        .eq('id', despesaId)
        .select()
        .single();

      if (error) {
        return res.status(400).json({ message: error.message, traceId });
      }

      await registrarAuditoria(supabase, buildAuditoriaPayload({
        usuario,
        acao: 'EDICAO',
        modulo: 'FINANCEIRO',
        descricao: 'Despesa atualizada',
        dadosAnteriores: anterior || null,
        dadosNovos: data || null,
        status: 'SUCESSO',
        traceId,
        req
      }));

      return res.status(200).json({ data, traceId });
    }

    if (req.method === 'DELETE') {
      const { data: anterior } = await supabase
        .from('financeiro_despesas')
        .select('*')
        .eq('id', despesaId)
        .single();

      const { data, error } = await supabase
        .from('financeiro_despesas')
        .update({
          ativo: false,
          deleted_at: new Date().toISOString(),
          deleted_by: usuario?.id || null,
          updated_at: new Date().toISOString(),
          atualizado_por: usuario?.id || null
        })
        .eq('id', despesaId)
        .select()
        .single();

      if (error) {
        return res.status(400).json({ message: error.message, traceId });
      }

      await registrarAuditoria(supabase, buildAuditoriaPayload({
        usuario,
        acao: 'DELECAO',
        modulo: 'FINANCEIRO',
        descricao: 'Despesa excluida',
        dadosAnteriores: anterior || null,
        dadosNovos: data || null,
        status: 'SUCESSO',
        traceId,
        req
      }));

      return res.status(200).json({ data, traceId });
    }

    return res.status(405).json({ message: 'Metodo nao permitido', traceId });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Erro interno', traceId });
  }
}
