import { FastifyInstance } from 'fastify';
import { verifyAuth } from '../../middleware/auth';
import { verifyWorkspace } from '../../middleware/workspace';
import { requireMinRole } from '../../middleware/role';
import { sendOk, sendCreated } from '../../utils/response';
import {
  createCampaignSchema,
  addCampaignMessageSchema,
  addContactsToCampaignSchema,
} from '../../validators/campaign.validator';
import { supabaseAdmin } from '../../config/supabase';
import { NotFoundException, ValidationException, ConflictException } from '../../utils/errors';
import { enqueueCampaignDispatch } from '../../jobs/queue';

const base      = [verifyAuth, verifyWorkspace];
const agentOnly = [...base, requireMinRole('agent')];
const adminOnly = [...base, requireMinRole('admin')];

export async function campaignRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /workspaces/:workspaceId/campaigns
  fastify.get('/', { preHandler: agentOnly }, async (request, reply) => {
    const { workspaceId } = request.workspaceCtx;
    const q               = request.query as { page?: string; limit?: string; status?: string };
    const limit           = Math.min(Number(q.limit ?? 20), 100);
    const page            = Math.max(Number(q.page ?? 1), 1);
    const offset          = (page - 1) * limit;

    let query = supabaseAdmin
      .from('campaigns')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (q.status) query = query.eq('status', q.status);

    const { data, count, error } = await query;
    if (error) throw error;

    return sendOk(reply, data, {
      pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    });
  });

  // GET /workspaces/:workspaceId/campaigns/:id
  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: agentOnly }, async (request, reply) => {
    const { workspaceId } = request.workspaceCtx;
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('*, campaign_messages(*)')
      .eq('workspace_id', workspaceId)
      .eq('id', request.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Campanha');
    return sendOk(reply, data);
  });

  // POST /workspaces/:workspaceId/campaigns
  fastify.post('/', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = createCampaignSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationException(parsed.error.flatten().fieldErrors);

    const { workspaceId, userId } = request.workspaceCtx;
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .insert({ workspace_id: workspaceId, created_by: userId, ...parsed.data })
      .select()
      .single();
    if (error) throw error;
    return sendCreated(reply, data);
  });

  // POST /workspaces/:workspaceId/campaigns/:id/messages
  fastify.post<{ Params: { id: string } }>('/:id/messages', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = addCampaignMessageSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationException(parsed.error.flatten().fieldErrors);

    const { workspaceId } = request.workspaceCtx;
    const { data, error } = await supabaseAdmin
      .from('campaign_messages')
      .insert({ workspace_id: workspaceId, campaign_id: request.params.id, ...parsed.data })
      .select()
      .single();
    if (error) throw error;
    return sendCreated(reply, data);
  });

  // POST /workspaces/:workspaceId/campaigns/:id/contacts
  fastify.post<{ Params: { id: string } }>('/:id/contacts', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = addContactsToCampaignSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationException(parsed.error.flatten().fieldErrors);

    const { workspaceId } = request.workspaceCtx;
    const campaignId      = request.params.id;

    const rows = parsed.data.contact_ids.map((contactId) => ({
      workspace_id: workspaceId,
      campaign_id:  campaignId,
      contact_id:   contactId,
      status:       'pending',
    }));

    const { data, error } = await supabaseAdmin
      .from('campaign_contacts')
      .insert(rows)
      .select();
    if (error) throw error;

    return sendCreated(reply, { added: data?.length ?? 0 });
  });

  // POST /workspaces/:workspaceId/campaigns/:id/start
  fastify.post<{ Params: { id: string } }>('/:id/start', { preHandler: adminOnly }, async (request, reply) => {
    const { workspaceId } = request.workspaceCtx;
    const campaignId      = request.params.id;

    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('status')
      .eq('id', campaignId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (!campaign) throw new NotFoundException('Campanha');
    if (!['draft', 'paused'].includes(campaign.status)) {
      throw new ConflictException(`Campanha não pode ser iniciada com status "${campaign.status}"`);
    }

    await supabaseAdmin
      .from('campaigns')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', campaignId);

    await enqueueCampaignDispatch({ campaignId, workspaceId, batchSize: 50, offsetStart: 0 });

    return sendOk(reply, { campaignId, status: 'running', message: 'Campanha iniciada.' });
  });

  // POST /workspaces/:workspaceId/campaigns/:id/pause
  fastify.post<{ Params: { id: string } }>('/:id/pause', { preHandler: adminOnly }, async (request, reply) => {
    const { workspaceId } = request.workspaceCtx;
    await supabaseAdmin
      .from('campaigns')
      .update({ status: 'paused' })
      .eq('id', request.params.id)
      .eq('workspace_id', workspaceId)
      .eq('status', 'running');
    return sendOk(reply, { message: 'Campanha pausada.' });
  });
}
