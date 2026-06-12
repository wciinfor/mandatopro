import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAnon, supabaseAdmin } from '../../config/supabase';
import { verifyAuth } from '../../middleware/auth';
import { sendOk, sendCreated, sendError } from '../../utils/response';
import { ValidationException } from '../../utils/errors';
import { logger } from '../../utils/logger';

const signUpSchema = z.object({
  email:          z.string().email(),
  password:       z.string().min(8, 'Mínimo 8 caracteres'),
  full_name:      z.string().min(2),
  workspace_name: z.string().min(2).optional(),
  workspace_slug: z.string().min(2).optional(),
});

const signInSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {

  // POST /auth/signup
  fastify.post('/signup', async (request, reply) => {
    const parsed = signUpSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationException(parsed.error.flatten().fieldErrors);

    const { email, password, full_name, workspace_name, workspace_slug } = parsed.data;

    const { data, error } = await supabaseAnon.auth.signUp({ email, password });
    if (error) return sendError(reply, 'SIGNUP_ERROR', error.message, 400);

    // Criar workspace inicial se informado.
    // NÃO usar RPC create_workspace_with_owner aqui: quando chamada com
    // service_role, auth.uid() retorna NULL e a função lança exceção.
    // Fazemos os 3 inserts equivalentes diretamente via supabaseAdmin.
    if (data.user && workspace_name) {
      try {
        const userId = data.user.id;
        const { data: ws } = await supabaseAdmin
          .from('workspaces')
          .insert({ name: workspace_name.trim(), slug: workspace_slug ?? null, owner_user_id: userId })
          .select('id')
          .single();

        if (ws) {
          await supabaseAdmin.from('workspace_members').insert({
            workspace_id: ws.id,
            user_id:      userId,
            role:         'owner',
            status:       'active',
          });
          await supabaseAdmin
            .from('users_profiles')
            .update({ default_workspace_id: ws.id })
            .eq('id', userId)
            .is('default_workspace_id', null);
        }
      } catch (wsErr) {
        // Não abortar o signup — usuário pode criar workspace depois
        logger.warn({ err: wsErr }, 'Falha ao criar workspace inicial no signup');
      }
    }

    return sendCreated(reply, {
      userId:  data.user?.id,
      email:   data.user?.email,
      message: 'Verifique seu e-mail para confirmar o cadastro.',
    });
  });

  // POST /auth/signin
  fastify.post('/signin', async (request, reply) => {
    const parsed = signInSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationException(parsed.error.flatten().fieldErrors);

    const { data, error } = await supabaseAnon.auth.signInWithPassword(parsed.data);
    if (error || !data.session) {
      return sendError(reply, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos', 401);
    }

    return sendOk(reply, {
      accessToken:  data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn:    data.session.expires_in,
      user: { id: data.user.id, email: data.user.email },
    });
  });

  // POST /auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationException(parsed.error.flatten().fieldErrors);

    const { data, error } = await supabaseAnon.auth.refreshSession({
      refresh_token: parsed.data.refreshToken,
    });
    if (error || !data.session) {
      return sendError(reply, 'INVALID_REFRESH_TOKEN', 'Refresh token inválido ou expirado', 401);
    }

    return sendOk(reply, {
      accessToken:  data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn:    data.session.expires_in,
    });
  });

  // GET /auth/me — requer autenticação
  fastify.get('/me', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(
      request.workspaceCtx.userId,
    );
    const { data: profile } = await supabaseAdmin
      .from('users_profiles')
      .select('*, workspaces!users_profiles_default_workspace_id_fkey(id, name, slug)')
      .eq('id', request.workspaceCtx.userId)
      .maybeSingle();

    return sendOk(reply, {
      user:    { id: authData.user?.id, email: authData.user?.email },
      profile,
    });
  });

  // POST /auth/signout
  fastify.post('/signout', { preHandler: [verifyAuth] }, async (request, reply) => {
    // admin.signOut() recebe userId, não token
    await supabaseAdmin.auth.admin.signOut(request.workspaceCtx.userId);
    return sendOk(reply, { message: 'Sessão encerrada.' });
  });
}
