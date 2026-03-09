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

const NIVEIS = ['ADMINISTRADOR', 'LIDERANCA', 'OPERADOR'];
const STATUS = ['ATIVO', 'INATIVO', 'BLOQUEADO'];

export default async function handler(req, res) {
  const traceId = gerarTraceId();

  try {
    const usuario = obterUsuarioHeader(req);
    exigirAdmin(usuario);

    const supabase = createServerClient();

    if (req.method === 'GET') {
      const { search, nivel, status, include_inativos } = req.query;
      const { limit, offset } = parsePaginacao(req.query, 20, 100);

      let query = supabase
        .from('usuarios')
        .select('*', { count: 'exact' })
        .order('nome', { ascending: true });

      if (!include_inativos) {
        query = query.eq('ativo', true);
      }
      if (nivel) query = query.eq('nivel', String(nivel).toUpperCase());
      if (status) query = query.eq('status', String(status).toUpperCase());
      if (search && String(search).trim()) {
        const value = String(search).trim();
        query = query.or(`nome.ilike.%${value}%,email.ilike.%${value}%`);
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
      const email = String(body.email || '').trim().toLowerCase();
      const senha = String(body.senha || '').trim();
      const nome = String(body.nome || '').trim();
      const nivel = String(body.nivel || '').toUpperCase();
      const status = String(body.status || 'ATIVO').toUpperCase();

      if (!email || !senha || !nome) {
        return res.status(400).json({ message: 'Nome, email e senha sao obrigatorios', traceId });
      }
      if (!NIVEIS.includes(nivel)) {
        return res.status(400).json({ message: 'Nivel invalido', traceId });
      }
      if (!STATUS.includes(status)) {
        return res.status(400).json({ message: 'Status invalido', traceId });
      }

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true
      });

      if (authError || !authData?.user) {
        return res.status(400).json({ message: authError?.message || 'Erro ao criar usuario', traceId });
      }

      const payload = {
        email,
        nome,
        nivel,
        status,
        lideranca_id: body.lideranca_id ? Number(body.lideranca_id) : null,
        auth_user_id: authData.user.id,
        ativo: status === 'ATIVO',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('usuarios')
        .insert([payload])
        .select()
        .single();

      if (error) {
        await supabase.auth.admin.deleteUser(authData.user.id);
        return res.status(400).json({ message: error.message, traceId });
      }

      await registrarAuditoria(supabase, buildAuditoriaPayload({
        usuario,
        acao: 'CADASTRO',
        modulo: 'USUARIOS',
        descricao: 'Usuario cadastrado',
        dadosAnteriores: null,
        dadosNovos: { usuario_id: data?.id, email: data?.email },
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
