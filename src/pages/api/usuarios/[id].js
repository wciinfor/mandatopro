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

const NIVEIS = ['ADMINISTRADOR', 'LIDERANCA', 'OPERADOR'];
const STATUS = ['ATIVO', 'INATIVO', 'BLOQUEADO'];

export default async function handler(req, res) {
  const traceId = gerarTraceId();
  const { id } = req.query;

  try {
    const usuario = obterUsuarioHeader(req);
    exigirAdmin(usuario);

    const supabase = createServerClient();
    const usuarioId = parseInt(id, 10);

    if (Number.isNaN(usuarioId)) {
      return res.status(400).json({ message: 'Id invalido', traceId });
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', usuarioId)
        .single();

      if (error || !data) {
        return res.status(404).json({ message: 'Usuario nao encontrado', traceId });
      }

      return res.status(200).json({ data, traceId });
    }

    if (req.method === 'PUT') {
      const { data: anterior } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', usuarioId)
        .single();

      if (!anterior) {
        return res.status(404).json({ message: 'Usuario nao encontrado', traceId });
      }

      const body = req.body || {};
      const nivel = body.nivel ? String(body.nivel).toUpperCase() : undefined;
      const status = body.status ? String(body.status).toUpperCase() : undefined;

      if (nivel && !NIVEIS.includes(nivel)) {
        return res.status(400).json({ message: 'Nivel invalido', traceId });
      }
      if (status && !STATUS.includes(status)) {
        return res.status(400).json({ message: 'Status invalido', traceId });
      }

      if (usuario?.id === usuarioId) {
        if (nivel && nivel !== 'ADMINISTRADOR') {
          return res.status(400).json({ message: 'Nao e permitido reduzir o proprio nivel', traceId });
        }
        if (status && status !== 'ATIVO') {
          return res.status(400).json({ message: 'Nao e permitido desativar o proprio usuario', traceId });
        }
      }

      if (body.email && anterior.auth_user_id) {
        const email = String(body.email).trim().toLowerCase();
        const { error: emailError } = await supabase.auth.admin.updateUserById(anterior.auth_user_id, {
          email
        });
        if (emailError) {
          return res.status(400).json({ message: emailError.message, traceId });
        }
      }

      if (body.senha && anterior.auth_user_id) {
        const senha = String(body.senha).trim();
        if (senha.length < 6) {
          return res.status(400).json({ message: 'Senha deve ter no minimo 6 caracteres', traceId });
        }
        const { error: senhaError } = await supabase.auth.admin.updateUserById(anterior.auth_user_id, {
          password: senha
        });
        if (senhaError) {
          return res.status(400).json({ message: senhaError.message, traceId });
        }
      }

      const payload = {
        nome: normalizarValor(body.nome),
        email: body.email ? String(body.email).trim().toLowerCase() : undefined,
        nivel: nivel || undefined,
        status: status || undefined,
        lideranca_id: body.lideranca_id ? Number(body.lideranca_id) : null,
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

      await registrarAuditoria(supabase, buildAuditoriaPayload({
        usuario,
        acao: 'EDICAO',
        modulo: 'USUARIOS',
        descricao: 'Usuario atualizado',
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
        .from('usuarios')
        .select('*')
        .eq('id', usuarioId)
        .single();

      if (!anterior) {
        return res.status(404).json({ message: 'Usuario nao encontrado', traceId });
      }

      if (usuario?.id === usuarioId) {
        return res.status(400).json({ message: 'Nao e permitido desativar o proprio usuario', traceId });
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
        descricao: 'Usuario desativado',
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
