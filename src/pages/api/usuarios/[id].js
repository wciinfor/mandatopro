import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import {
  gerarTraceId,
  normalizarValor,
  registrarAuditoria,
  buildAuditoriaPayload
} from '@/lib/financeiro-utils';

export const runtime = 'nodejs';

const NIVEIS = ['ADMINISTRADOR', 'LIDERANCA', 'OPERADOR', 'ATENDENTE_CONNECT', 'SUPERVISOR_CONNECT', 'ANALISTA_META'];
const STATUS = ['ATIVO', 'INATIVO', 'BLOQUEADO'];

export default async function handler(req, res) {
  const traceId = gerarTraceId();
  const { id } = req.query;

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAdministrador(usuario);
    const usuarioId = parseInt(id, 10);

    if (Number.isNaN(usuarioId)) {
      return res.status(400).json({ message: 'Id inválido', traceId });
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', usuarioId)
        .single();

      if (error || !data) {
        return res.status(404).json({ message: 'Usuário não encontrado', traceId });
      }

      // Buscar mandatos vinculados
      const { data: vinculos } = await supabase
        .from('usuarios_mandatos')
        .select('mandato_id')
        .eq('usuario_id', usuarioId);

      const mandatos = (vinculos || []).map(v => v.mandato_id);

      return res.status(200).json({
        data: {
          ...data,
          mandatos
        },
        traceId
      });
    }

    if (req.method === 'PUT') {
      const { data: anterior } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', usuarioId)
        .single();

      if (!anterior) {
        return res.status(404).json({ message: 'Usuário não encontrado', traceId });
      }

      const body = req.body || {};
      const nivel = body.nivel ? String(body.nivel).toUpperCase() : undefined;
      const status = body.status ? String(body.status).toUpperCase() : undefined;

      if (nivel && !NIVEIS.includes(nivel)) {
        return res.status(400).json({ message: 'Nível inválido', traceId });
      }
      if (status && !STATUS.includes(status)) {
        return res.status(400).json({ message: 'Status inválido', traceId });
      }

      if (Object.prototype.hasOwnProperty.call(body, 'mandatos')) {
        const mandatos = Array.isArray(body.mandatos) ? body.mandatos.map(Number).filter(Boolean) : [];
        if (mandatos.length === 0) {
          return res.status(400).json({ message: 'O usuário deve estar vinculado a pelo menos um mandato', traceId });
        }
      }

      if (usuario?.id === usuarioId) {
        if (nivel && nivel !== 'ADMINISTRADOR') {
          return res.status(400).json({ message: 'Não é permitido reduzir o próprio nível', traceId });
        }
        if (status && status !== 'ATIVO') {
          return res.status(400).json({ message: 'Não é permitido desativar o próprio usuário', traceId });
        }
      }

      if (body.email) {
        const email = String(body.email).trim().toLowerCase();
        const authUserId = anterior.auth_user_id;

        if (!authUserId) {
          return res.status(409).json({
            message: 'Usuário sem vínculo auth_user_id. Verifique a migração 219 e o backfill.',
            traceId
          });
        }

        const { error: emailError } = await supabase.auth.admin.updateUserById(authUserId, {
          email
        });
        if (emailError) {
          return res.status(400).json({ message: emailError.message, traceId });
        }
      }

      if (body.senha) {
        const senha = String(body.senha).trim();
        if (senha.length < 6) {
          return res.status(400).json({ message: 'Senha deve ter no mínimo 6 caracteres', traceId });
        }
        const authUserId = anterior.auth_user_id;

        if (!authUserId) {
          return res.status(409).json({
            message: 'Usuário sem vínculo auth_user_id. Verifique a migração 219 e o backfill.',
            traceId
          });
        }

        const { error: senhaError } = await supabase.auth.admin.updateUserById(authUserId, {
          password: senha
        });
        if (senhaError) {
          return res.status(400).json({ message: senhaError.message, traceId });
        }
      }

      const liderancaIdInformada = Object.prototype.hasOwnProperty.call(body, 'lideranca_id');

      const payload = {
        nome: normalizarValor(body.nome),
        email: body.email ? String(body.email).trim().toLowerCase() : undefined,
        nivel: nivel || undefined,
        status: status || undefined,
        lideranca_id: liderancaIdInformada
          ? (body.lideranca_id ? Number(body.lideranca_id) : null)
          : undefined,
        ativo: status ? status === 'ATIVO' : undefined,
        updated_at: new Date().toISOString()
      };

      Object.keys(payload).forEach((key) => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      const { data, error } = await supabase
        .from('usuarios')
        .update(payload)
        .eq('id', usuarioId)
        .select()
        .single();

      if (error) {
        return res.status(400).json({ message: error.message, traceId });
      }

      // Atualizar mandatos se informados
      let mandatosResult = [];
      if (Object.prototype.hasOwnProperty.call(body, 'mandatos')) {
        const mandatos = Array.isArray(body.mandatos) ? body.mandatos.map(Number).filter(Boolean) : [];
        await supabase.from('usuarios_mandatos').delete().eq('usuario_id', usuarioId);

        if (mandatos.length > 0) {
          const mandatosPayload = mandatos.map(mandato_id => ({
            usuario_id: usuarioId,
            mandato_id
          }));
          await supabase.from('usuarios_mandatos').insert(mandatosPayload);
        }
        mandatosResult = mandatos;
      } else {
        const { data: vinculos } = await supabase
          .from('usuarios_mandatos')
          .select('mandato_id')
          .eq('usuario_id', usuarioId);
        mandatosResult = (vinculos || []).map(v => v.mandato_id);
      }

      await registrarAuditoria(supabase, buildAuditoriaPayload({
        usuario,
        acao: 'EDICAO',
        modulo: 'USUARIOS',
        descricao: 'Usuário atualizado com mandatos',
        dadosAnteriores: anterior || null,
        dadosNovos: { ...data, mandatos: mandatosResult },
        status: 'SUCESSO',
        traceId,
        req
      }));

      return res.status(200).json({
        data: {
          ...data,
          mandatos: mandatosResult
        },
        traceId
      });
    }

    if (req.method === 'DELETE') {
      const { data: anterior } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', usuarioId)
        .single();

      if (!anterior) {
        return res.status(404).json({ message: 'Usuário não encontrado', traceId });
      }

      if (usuario?.id === usuarioId) {
        return res.status(400).json({ message: 'Não é permitido desativar o próprio usuário', traceId });
      }

      const { data, error } = await supabase
        .from('usuarios')
        .update({
          status: 'INATIVO',
          ativo: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', usuarioId)
        .select()
        .single();

      if (error) {
        return res.status(400).json({ message: error.message, traceId });
      }

      await registrarAuditoria(supabase, buildAuditoriaPayload({
        usuario,
        acao: 'DELECAO',
        modulo: 'USUARIOS',
        descricao: 'Usuário desativado',
        dadosAnteriores: anterior || null,
        dadosNovos: data || null,
        status: 'SUCESSO',
        traceId,
        req
      }));

      return res.status(200).json({ data, traceId });
    }

    return res.status(405).json({ message: 'Método não permitido', traceId });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Erro interno', traceId });
  }
}
