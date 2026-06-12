import { FastifyInstance } from 'fastify';
import { verifyAuth } from '../../middleware/auth';
import { verifyWorkspace } from '../../middleware/workspace';
import { requireMinRole } from '../../middleware/role';
import { sendOk, sendCreated } from '../../utils/response';
import { createInstanceSchema, updateInstanceSchema } from '../../validators/instance.validator';
import { evolutionService } from '../../services/evolution.service';
import { supabaseAdmin } from '../../config/supabase';
import { NotFoundException, ValidationException } from '../../utils/errors';

const base      = [verifyAuth, verifyWorkspace];
const adminOnly = [...base, requireMinRole('admin')];

export async function instanceRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /workspaces/:workspaceId/instances
  fastify.get('/', { preHandler: base }, async (request, reply) => {
    const { workspaceId } = request.workspaceCtx;
    const { data, error } = await supabaseAdmin
      .from('instances')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return sendOk(reply, data);
  });

  // GET /workspaces/:workspaceId/instances/:id
  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: base }, async (request, reply) => {
    const { workspaceId } = request.workspaceCtx;
    const { data, error } = await supabaseAdmin
      .from('instances')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', request.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Instância');

    // Enriquecer com status em tempo real (não critica se Evolution estiver fora)
    try {
      const realtimeStatus = await evolutionService.getInstanceStatus(data.name);
      return sendOk(reply, { ...data, realtimeStatus });
    } catch {
      return sendOk(reply, data);
    }
  });

  // POST /workspaces/:workspaceId/instances
  fastify.post('/', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = createInstanceSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationException(parsed.error.flatten().fieldErrors);

    const { workspaceId } = request.workspaceCtx;
    const { name, apikey, provider, metadata } = parsed.data;

    // Criar na Evolution primeiro — se falhar, não persiste no banco
    await evolutionService.createInstance(name, apikey);

    const { data, error } = await supabaseAdmin
      .from('instances')
      .insert({ workspace_id: workspaceId, name, apikey, provider, metadata })
      .select()
      .single();
    if (error) throw error;

    return sendCreated(reply, data);
  });

  // PATCH /workspaces/:workspaceId/instances/:id
  fastify.patch<{ Params: { id: string } }>('/:id', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = updateInstanceSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationException(parsed.error.flatten().fieldErrors);

    const { workspaceId } = request.workspaceCtx;
    const { data, error } = await supabaseAdmin
      .from('instances')
      .update(parsed.data)
      .eq('id', request.params.id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new NotFoundException('Instância');

    return sendOk(reply, data);
  });

  // GET /workspaces/:workspaceId/instances/:id/qrcode
  fastify.get<{ Params: { id: string } }>('/:id/qrcode', { preHandler: adminOnly }, async (request, reply) => {
    const { workspaceId } = request.workspaceCtx;
    const { data: instance } = await supabaseAdmin
      .from('instances')
      .select('name')
      .eq('id', request.params.id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (!instance) throw new NotFoundException('Instância');

    const qrData = await evolutionService.getQrCode(instance.name);
    return sendOk(reply, qrData);
  });

  // DELETE /workspaces/:workspaceId/instances/:id/logout
  fastify.delete<{ Params: { id: string } }>('/:id/logout', { preHandler: adminOnly }, async (request, reply) => {
    const { workspaceId } = request.workspaceCtx;
    const { data: instance } = await supabaseAdmin
      .from('instances')
      .select('name')
      .eq('id', request.params.id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (!instance) throw new NotFoundException('Instância');

    await evolutionService.logout(instance.name);
    await supabaseAdmin
      .from('instances')
      .update({ status: 'disconnected' })
      .eq('id', request.params.id);

    return sendOk(reply, { message: 'Instância desconectada.' });
  });
}
