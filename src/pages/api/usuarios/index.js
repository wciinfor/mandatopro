import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import { obterTenantId } from '@/lib/tenant';
import {
  gerarTraceId,
  parsePaginacao,
  registrarAuditoria,
  buildAuditoriaPayload
} from '@/lib/financeiro-utils';

export const runtime = 'nodejs';

const NIVEIS = ['ADMINISTRADOR', 'LIDERANCA', 'OPERADOR', 'ATENDENTE_CONNECT', 'SUPERVISOR_CONNECT', 'ANALISTA_META'];
const STATUS = ['ATIVO', 'INATIVO', 'BLOQUEADO'];

function isTruthy(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export default async function handler(req, res) {
  const traceId = gerarTraceId();

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAdministrador(usuario);

    if (req.method === 'GET') {
      const { search, nivel, status, include_inativos } = req.query;
      const { limit, offset } = parsePaginacao(req.query, 20, 100);
      const statusNormalizado = String(status || '').toUpperCase();
      const incluirInativos = isTruthy(include_inativos)
        || statusNormalizado === 'INATIVO'
        || statusNormalizado === 'BLOQUEADO';

      let query = supabase
        .from('usuarios')
        .select('*', { count: 'exact' })
        .order('nome', { ascending: true });

      if (!incluirInativos) {
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

      // Buscar vínculos de mandatos dos usuários retornados
      const userIds = (data || []).map(u => u.id);
      let mapaMandatos = {};
      if (userIds.length > 0) {
        const { data: vinculos } = await supabase
          .from('usuarios_mandatos')
          .select('usuario_id, mandato_id')
          .in('usuario_id', userIds);

        (vinculos || []).forEach(v => {
          if (!mapaMandatos[v.usuario_id]) mapaMandatos[v.usuario_id] = [];
          mapaMandatos[v.usuario_id].push(v.mandato_id);
        });
      }

      const usuariosComMandatos = (data || []).map(u => ({
        ...u,
        mandatos: mapaMandatos[u.id] || []
      }));

      return res.status(200).json({
        data: usuariosComMandatos,
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
      const mandatos = Array.isArray(body.mandatos) ? body.mandatos.map(Number).filter(Boolean) : [];

      if (!email || !senha || !nome) {
        return res.status(400).json({ message: 'Nome, email e senha são obrigatórios', traceId });
      }
      if (!NIVEIS.includes(nivel)) {
        return res.status(400).json({ message: 'Nível inválido', traceId });
      }
      if (!STATUS.includes(status)) {
        return res.status(400).json({ message: 'Status inválido', traceId });
      }
      if (mandatos.length === 0) {
        return res.status(400).json({ message: 'O usuário deve estar vinculado a pelo menos um mandato', traceId });
      }

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true
      });

      if (authError || !authData?.user) {
        return res.status(400).json({ message: authError?.message || 'Erro ao criar usuário', traceId });
      }

      const tenantIdCriador = obterTenantId(usuario);
      if (!tenantIdCriador) {
        return res.status(400).json({ message: 'Tenant do administrador autenticado não identificado', traceId });
      }

      const payload = {
        email,
        nome,
        nivel,
        status,
        lideranca_id: body.lideranca_id ? Number(body.lideranca_id) : null,
        tenant_id: tenantIdCriador,
        auth_user_id: authData.user.id,
        ativo: status === 'ATIVO',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: novoUsuario, error: createError } = await supabase
        .from('usuarios')
        .insert([payload])
        .select('*')
        .single();

      if (createError || !novoUsuario) {
        await supabase.auth.admin.deleteUser(authData.user.id);
        return res.status(400).json({ message: createError?.message || 'Erro ao inserir usuário', traceId });
      }

      // Gravar mandatos na tabela usuarios_mandatos
      const mandatosPayload = mandatos.map(mandato_id => ({
        usuario_id: novoUsuario.id,
        mandato_id
      }));

      await supabase.from('usuarios_mandatos').insert(mandatosPayload);

      await registrarAuditoria(supabase, buildAuditoriaPayload({
        usuario,
        acao: 'CADASTRO',
        modulo: 'USUARIOS',
        descricao: 'Usuário cadastrado com mandatos',
        dadosAnteriores: null,
        dadosNovos: { usuario_id: novoUsuario?.id, email: novoUsuario?.email, mandatos },
        status: 'SUCESSO',
        traceId,
        req
      }));

      return res.status(201).json({
        data: {
          ...novoUsuario,
          mandatos
        },
        traceId
      });
    }

    return res.status(405).json({ message: 'Método não permitido', traceId });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Erro interno', traceId });
  }
}
