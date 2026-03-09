import { createServerClient } from '@/lib/supabase-server';
import {
  gerarTraceId,
  obterUsuarioHeader,
  exigirAdmin,
  normalizarValor,
  parsePaginacao,
  registrarAuditoria,
  buildAuditoriaPayload
} from '@/lib/financeiro-utils';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  const traceId = gerarTraceId();

  try {
    const usuario = obterUsuarioHeader(req);
    exigirAdmin(usuario);

    const supabase = createServerClient();

    if (req.method === 'GET') {
      const { search, tipo, status, categoria, parceiro_id, data_from, data_to } = req.query;
      const { limit, offset } = parsePaginacao(req.query, 20, 100);

      let query = supabase
        .from('financeiro_lancamentos')
        .select('*', { count: 'exact' })
        .eq('ativo', true)
        .order('data_lancamento', { ascending: false });

      if (tipo) query = query.eq('tipo', String(tipo).toUpperCase());
      if (status) query = query.eq('status', String(status).toUpperCase());
      if (categoria) query = query.eq('categoria', String(categoria));
      if (parceiro_id) query = query.eq('parceiro_id', parseInt(parceiro_id, 10));
      if (data_from) query = query.gte('data_lancamento', data_from);
      if (data_to) query = query.lte('data_lancamento', data_to);

      if (search && String(search).trim()) {
        const value = String(search).trim();
        query = query.or(`codigo.ilike.%${value}%,parceiro_nome.ilike.%${value}%,descricao.ilike.%${value}%`);
      }

      const { data, count, error } = await query.range(offset, offset + limit - 1);
      if (error) {
        return res.status(400).json({ message: error.message, traceId });
      }

      return res.status(200).json({
        data: data || [],
        total: count || 0,
        limit,
        offset,
        traceId
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.data_lancamento || !body.tipo || !body.valor) {
        return res.status(400).json({ message: 'Data, tipo e valor sao obrigatorios', traceId });
      }

      const payload = {
        codigo: normalizarValor(body.codigo),
        data_lancamento: body.data_lancamento,
        tipo: String(body.tipo || '').toUpperCase(),
        categoria: normalizarValor(body.categoria),
        parceiro_id: body.parceiro_id ? parseInt(body.parceiro_id, 10) : null,
        parceiro_nome: normalizarValor(body.parceiro_nome),
        valor: Number(body.valor),
        forma_pagamento: normalizarValor(body.forma_pagamento),
        descricao: normalizarValor(body.descricao),
        comprovante_url: normalizarValor(body.comprovante_url),
        status: String(body.status || 'PENDENTE').toUpperCase(),
        ativo: true,
        criado_por: usuario?.id || null,
        atualizado_por: usuario?.id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('financeiro_lancamentos')
        .insert([payload])
        .select()
        .single();

      if (error) {
        return res.status(400).json({ message: error.message, traceId });
      }

      await registrarAuditoria(supabase, buildAuditoriaPayload({
        usuario,
        acao: 'CADASTRO',
        modulo: 'FINANCEIRO',
        descricao: 'Lancamento cadastrado',
        dadosAnteriores: null,
        dadosNovos: { lancamento_id: data?.id, valor: data?.valor },
        status: 'SUCESSO',
        traceId,
        req
      }));

      return res.status(201).json({ data, traceId });
    }

    return res.status(405).json({ message: 'Metodo nao permitido', traceId });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Erro interno', traceId });
  }
}
