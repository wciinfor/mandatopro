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
    const parceiroId = parseInt(id, 10);

    if (Number.isNaN(parceiroId)) {
      return res.status(400).json({ message: 'Id invalido', traceId });
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('financeiro_parceiros')
        .select('*')
        .eq('id', parceiroId)
        .single();

      if (error || !data) {
        return res.status(404).json({ message: 'Parceiro nao encontrado', traceId });
      }

      return res.status(200).json({ data, traceId });
    }

    if (req.method === 'PUT') {
      const { data: anterior } = await supabase
        .from('financeiro_parceiros')
        .select('*')
        .eq('id', parceiroId)
        .single();

      const body = req.body || {};
      const payload = {
        codigo: normalizarValor(body.codigo),
        nome: normalizarValor(body.nome),
        tipo: body.tipo ? String(body.tipo).toUpperCase() : undefined,
        cpf: normalizarValor(body.cpf),
        cnpj: normalizarValor(body.cnpj),
        email: normalizarValor(body.email),
        telefone: normalizarValor(body.telefone),
        endereco: normalizarValor(body.endereco),
        observacoes: normalizarValor(body.observacoes),
        status: body.status ? String(body.status).toUpperCase() : undefined,
        ativo: body.ativo !== undefined ? Boolean(body.ativo) : undefined,
        atualizado_por: usuario?.id || null,
        updated_at: new Date().toISOString()
      };

      Object.keys(payload).forEach((key) => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      const { data, error } = await supabase
        .from('financeiro_parceiros')
        .update(payload)
        .eq('id', parceiroId)
        .select()
        .single();

      if (error) {
        return res.status(400).json({ message: error.message, traceId });
      }

      await registrarAuditoria(supabase, buildAuditoriaPayload({
        usuario,
        acao: 'EDICAO',
        modulo: 'FINANCEIRO',
        descricao: 'Parceiro atualizado',
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
        .from('financeiro_parceiros')
        .select('*')
        .eq('id', parceiroId)
        .single();

      const { data, error } = await supabase
        .from('financeiro_parceiros')
        .update({
          ativo: false,
          deleted_at: new Date().toISOString(),
          deleted_by: usuario?.id || null,
          updated_at: new Date().toISOString(),
          atualizado_por: usuario?.id || null
        })
        .eq('id', parceiroId)
        .select()
        .single();

      if (error) {
        return res.status(400).json({ message: error.message, traceId });
      }

      await registrarAuditoria(supabase, buildAuditoriaPayload({
        usuario,
        acao: 'DELECAO',
        modulo: 'FINANCEIRO',
        descricao: 'Parceiro excluido',
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
