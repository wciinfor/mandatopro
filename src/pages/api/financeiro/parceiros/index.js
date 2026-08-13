import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import { obterContextoMandato } from '@/lib/mandato-auth';
import {
  gerarTraceId,
  normalizarValor,
  parsePaginacao,
  registrarAuditoria,
  buildAuditoriaPayload
} from '@/lib/financeiro-utils';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  const traceId = gerarTraceId();

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAdministrador(usuario);

    const contextoMandato = await obterContextoMandato(req, usuario, supabase);
    const { mandatoId } = contextoMandato;

    if (req.method === 'GET') {
      const { search, tipo, status, include_inativos } = req.query;
      const { limit, offset } = parsePaginacao(req.query, 20, 100);

      let query = supabase
        .from('financeiro_parceiros')
        .select('*', { count: 'exact' })
        .order('nome', { ascending: true });

      if (mandatoId === 1) {
        query = query.or('mandato_id.eq.1,mandato_id.is.null');
      } else {
        query = query.eq('mandato_id', mandatoId);
      }

      if (!include_inativos) {
        query = query.eq('ativo', true);
      }
      if (tipo) {
        query = query.eq('tipo', String(tipo).toUpperCase());
      }
      if (status) {
        query = query.eq('status', String(status).toUpperCase());
      }
      if (search && String(search).trim()) {
        const value = String(search).trim();
        query = query.or(`nome.ilike.%${value}%,cpf.ilike.%${value}%,cnpj.ilike.%${value}%,email.ilike.%${value}%`);
      }

      const { data, count, error } = await query.range(offset, offset + limit - 1);
      if (error) {
        return res.status(400).json({ message: error.message, traceId });
      }

      const parceiros = data || [];
      const parceiroIds = parceiros.map((item) => item.id).filter(Boolean);
      let totaisMap = new Map();
      let ultimaMap = new Map();

      if (parceiroIds.length > 0) {
        let lancsQuery = supabase
          .from('financeiro_lancamentos')
          .select('parceiro_id, valor, data_lancamento, status')
          .in('parceiro_id', parceiroIds)
          .eq('ativo', true);

        if (mandatoId === 1) {
          lancsQuery = lancsQuery.or('mandato_id.eq.1,mandato_id.is.null');
        } else {
          lancsQuery = lancsQuery.eq('mandato_id', mandatoId);
        }

        const { data: lancs, error: lancError } = await lancsQuery;

        if (!lancError && lancs) {
          lancs.forEach((item) => {
            const pid = item.parceiro_id;
            if (!pid) return;
            const valor = Number(item.valor || 0);
            const current = totaisMap.get(pid) || 0;
            totaisMap.set(pid, current + valor);
            const dataAtual = item.data_lancamento ? String(item.data_lancamento) : '';
            const dataAtualISO = dataAtual ? new Date(dataAtual).toISOString() : '';
            const ultima = ultimaMap.get(pid);
            if (!ultima || dataAtualISO > ultima) {
              ultimaMap.set(pid, dataAtualISO);
            }
          });
        }
      }

      const responseData = parceiros.map((item) => ({
        ...item,
        total_doado: totaisMap.get(item.id) || 0,
        ultima_doacao: ultimaMap.get(item.id) || null
      }));

      return res.status(200).json({
        data: responseData,
        total: count || 0,
        limit,
        offset,
        traceId
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.nome || !body.tipo) {
        return res.status(400).json({ message: 'Nome e tipo sao obrigatorios', traceId });
      }

      const payload = {
        codigo: normalizarValor(body.codigo),
        nome: normalizarValor(body.nome),
        tipo: String(body.tipo || '').toUpperCase(),
        cpf: normalizarValor(body.cpf),
        cnpj: normalizarValor(body.cnpj),
        email: normalizarValor(body.email),
        telefone: normalizarValor(body.telefone),
        endereco: normalizarValor(body.endereco),
        observacoes: normalizarValor(body.observacoes),
        status: String(body.status || 'ATIVO').toUpperCase(),
        ativo: body.ativo !== false,
        mandato_id: mandatoId,
        criado_por: usuario?.id || null,
        atualizado_por: usuario?.id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('financeiro_parceiros')
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
        descricao: 'Parceiro cadastrado',
        dadosAnteriores: null,
        dadosNovos: { parceiro_id: data?.id, nome: data?.nome },
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
