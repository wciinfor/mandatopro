import { FastifyInstance }     from 'fastify';
import multipart               from '@fastify/multipart';
import { verifyAuth }          from '../../middleware/auth';
import { verifyWorkspace }     from '../../middleware/workspace';
import { requireMinRole }      from '../../middleware/role';
import { workspaceRateLimit }  from '../../middleware/workspace-rate-limit';
import { sendOk, sendCreated, sendNoContent } from '../../utils/response';
import { ValidationException } from '../../utils/errors';
import {
  ListConversationsQuery,
  SendMessageBody,
  UpdateStatusBody,
  AssignBody,
  TransferBody,
  CreateLabelBody,
  UpdateLabelBody,
  AddLabelBody,
  CreateQuickReplyBody,
  UpdateQuickReplyBody,
  SearchMessagesQuery,
  SendMediaBody,
  DashboardQuery,
  AlertsQuery,
  CreateSlaPolicyBody,
  UpdateSlaPolicyBody,
  CreateAutomationRuleBody,
  UpdateAutomationRuleBody,
} from './inbox.types';
import * as service from './inbox.service';

// ──────────────────────────────────────────────────────────────
// INBOX ROUTES — Fases 1 + 2 + 3
//
// Todas as rotas exigem auth + workspace.
// Prefixo registrado em api/index.ts:
//   /api/v1/workspaces/:workspaceId/inbox
// ──────────────────────────────────────────────────────────────

type ConvParams = { Params: { id: string } };

const base      = [verifyAuth, verifyWorkspace];
const agentMin  = [...base, requireMinRole('agent')];
const adminOnly = [...base, requireMinRole('admin')];
// Rotas de alta frequência também passam pelo rate limit por workspace
const agentRl   = [...agentMin, workspaceRateLimit];

export async function inboxRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /conversations ──────────────────────────────────────
  fastify.get<{ Querystring: ListConversationsQuery }>(
    '/conversations',
    { preHandler: agentRl },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      const result = await service.listConversations(workspaceId, request.query);

      const page  = parseInt(request.query.page  ?? '1',  10) || 1;
      const limit = parseInt(request.query.limit ?? '30', 10) || 30;

      return sendOk(reply, result, {
        pagination: {
          page,
          limit,
          total:      result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    },
  );

  // ── GET /conversations/search ───────────────────────────────
  // Busca full-text em mensagens (Fase 3)
  fastify.get<{ Querystring: SearchMessagesQuery }>(
    '/conversations/search',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      const result = await service.searchMessages(workspaceId, request.query);
      const page  = result.page;
      const limit = parseInt(request.query.limit ?? '20', 10) || 20;
      return sendOk(reply, result, {
        pagination: {
          page,
          limit,
          total:      result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    },
  );

  // ── GET /conversations/:id ──────────────────────────────────
  fastify.get<ConvParams>(
    '/conversations/:id',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      const result = await service.getConversation(workspaceId, request.params.id);
      return sendOk(reply, result);
    },
  );

  // ── GET /conversations/:id/messages ────────────────────────
  fastify.get<{ Params: { id: string }; Querystring: { before?: string; limit?: string } }>(
    '/conversations/:id/messages',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      const msgs = await service.getMessages(
        workspaceId,
        request.params.id,
        request.query.before,
        parseInt(request.query.limit ?? '50', 10) || 50,
      );
      return sendOk(reply, msgs);
    },
  );

  // ── POST /conversations/:id/messages ───────────────────────
  fastify.post<{ Params: { id: string }; Body: SendMessageBody }>(
    '/conversations/:id/messages',
    { preHandler: agentRl },
    async (request, reply) => {
      const { workspaceId, userId } = request.workspaceCtx;
      const body = request.body as SendMessageBody;

      if (!body?.text?.trim()) {
        throw new ValidationException({ text: ['Campo "text" obrigatório'] });
      }

      const msg = await service.sendMessage(workspaceId, request.params.id, userId, body);
      return sendCreated(reply, msg);
    },
  );

  // ── DELETE /conversations/:id/messages/:msgId ──────────────
  // Soft-delete de mensagem (Fase 3)
  fastify.delete<{ Params: { id: string; msgId: string } }>(
    '/conversations/:id/messages/:msgId',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      const deleted = await service.softDeleteMessage(workspaceId, request.params.msgId);
      return sendOk(reply, deleted);
    },
  );

  // ── PATCH /conversations/:id/status ────────────────────────
  fastify.patch<{ Params: { id: string }; Body: UpdateStatusBody }>(
    '/conversations/:id/status',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId, role } = request.workspaceCtx;
      const body = request.body as UpdateStatusBody;

      const allowed: string[] = ['open', 'waiting', 'closed', 'archived'];
      if (!body?.status || !allowed.includes(body.status)) {
        throw new ValidationException({
          status: [`Valor inválido. Permitidos: ${allowed.join(', ')}`],
        });
      }

      const updated = await service.updateStatus(
        workspaceId,
        request.params.id,
        body.status,
        role,
      );
      return sendOk(reply, updated);
    },
  );

  // ── PATCH /conversations/:id/assign ────────────────────────
  fastify.patch<{ Params: { id: string }; Body: AssignBody }>(
    '/conversations/:id/assign',
    { preHandler: adminOnly },
    async (request, reply) => {
      const { workspaceId, userId } = request.workspaceCtx;
      const body = request.body as AssignBody;

      if (!Object.prototype.hasOwnProperty.call(body, 'agentId')) {
        throw new ValidationException({ agentId: ['Campo "agentId" obrigatório (pode ser null)'] });
      }

      const updated = await service.assignConversation(
        workspaceId,
        request.params.id,
        { agentId: body.agentId ?? null },
        userId,
      );
      return sendOk(reply, updated);
    },
  );

  // ── POST /conversations/:id/assign-me ──────────────────────
  fastify.post<ConvParams>(
    '/conversations/:id/assign-me',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId, userId } = request.workspaceCtx;
      const updated = await service.assignToMe(workspaceId, request.params.id, userId);
      return sendOk(reply, updated);
    },
  );

  // ── POST /conversations/:id/read ───────────────────────────
  fastify.post<ConvParams>(
    '/conversations/:id/read',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      await service.markRead(workspaceId, request.params.id);
      return sendOk(reply, { marked: true });
    },
  );

  // ── POST /conversations/:id/transfer ───────────────────────
  fastify.post<{ Params: { id: string }; Body: TransferBody }>(
    '/conversations/:id/transfer',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId, userId } = request.workspaceCtx;
      const body = request.body as TransferBody;

      if (!Object.prototype.hasOwnProperty.call(body, 'toAgentId')) {
        throw new ValidationException({
          toAgentId: ['Campo "toAgentId" obrigatório (pode ser null para desatribuir)'],
        });
      }

      const updated = await service.transferConversation(
        workspaceId,
        request.params.id,
        body,
        userId,
      );
      return sendOk(reply, updated);
    },
  );

  // ── GET /conversations/:id/labels ──────────────────────────
  // Fase 3 — Labels de uma conversa
  fastify.get<ConvParams>(
    '/conversations/:id/labels',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      const labels = await service.getConversationLabels(workspaceId, request.params.id);
      return sendOk(reply, { labels });
    },
  );

  // ── POST /conversations/:id/labels ─────────────────────────
  fastify.post<{ Params: { id: string }; Body: AddLabelBody }>(
    '/conversations/:id/labels',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId, userId } = request.workspaceCtx;
      const item = await service.addLabelToConversation(
        workspaceId,
        request.params.id,
        request.body as AddLabelBody,
        userId,
      );
      return sendCreated(reply, item);
    },
  );

  // ── DELETE /conversations/:id/labels/:labelId ──────────────
  fastify.delete<{ Params: { id: string; labelId: string } }>(
    '/conversations/:id/labels/:labelId',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      await service.removeLabelFromConversation(workspaceId, request.params.id, request.params.labelId);
      return sendOk(reply, { removed: true });
    },
  );

  // ── GET /unread-summary ─────────────────────────────────────
  fastify.get(
    '/unread-summary',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId, userId } = request.workspaceCtx;
      const summary = await service.getUnreadSummary(workspaceId, userId);
      return sendOk(reply, summary);
    },
  );

  // ── GET /agents ─────────────────────────────────────────────
  fastify.get(
    '/agents',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      const agents = await service.listAgents(workspaceId);
      return sendOk(reply, { agents });
    },
  );

  // ── GET /labels ─────────────────────────────────────────────
  // Fase 3 — Catálogo de labels do workspace
  fastify.get(
    '/labels',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      const labels = await service.listLabels(workspaceId);
      return sendOk(reply, { labels });
    },
  );

  // ── POST /labels ────────────────────────────────────────────
  fastify.post<{ Body: CreateLabelBody }>(
    '/labels',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      const label = await service.createLabel(workspaceId, request.body as CreateLabelBody);
      return sendCreated(reply, label);
    },
  );

  // ── PATCH /labels/:id ───────────────────────────────────────
  fastify.patch<{ Params: { id: string }; Body: UpdateLabelBody }>(
    '/labels/:id',
    { preHandler: adminOnly },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      const label = await service.updateLabel(workspaceId, request.params.id, request.body as UpdateLabelBody);
      return sendOk(reply, label);
    },
  );

  // ── DELETE /labels/:id ──────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/labels/:id',
    { preHandler: adminOnly },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      await service.deleteLabel(workspaceId, request.params.id);
      return sendOk(reply, { deleted: true });
    },
  );

  // ── GET /quick-replies ──────────────────────────────────────
  // Fase 3 — Respostas rápidas
  fastify.get<{ Querystring: { search?: string } }>(
    '/quick-replies',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      const replies = await service.listQuickReplies(workspaceId, request.query.search);
      return sendOk(reply, { replies });
    },
  );

  // ── POST /quick-replies ─────────────────────────────────────
  fastify.post<{ Body: CreateQuickReplyBody }>(
    '/quick-replies',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId, userId } = request.workspaceCtx;
      const reply_ = await service.createQuickReply(workspaceId, request.body as CreateQuickReplyBody, userId);
      return sendCreated(reply, reply_);
    },
  );

  // ── PATCH /quick-replies/:id ────────────────────────────────
  fastify.patch<{ Params: { id: string }; Body: UpdateQuickReplyBody }>(
    '/quick-replies/:id',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      const updated = await service.updateQuickReply(workspaceId, request.params.id, request.body as UpdateQuickReplyBody);
      return sendOk(reply, updated);
    },
  );

  // ── DELETE /quick-replies/:id ───────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/quick-replies/:id',
    { preHandler: adminOnly },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      await service.deleteQuickReply(workspaceId, request.params.id);
      return sendOk(reply, { deleted: true });
    },
  );

  // ── POST /conversations/:id/media ───────────────────────────
  // Fase 4 — Upload de arquivo de mídia (multipart/form-data)
  // Campo esperado: file (binário)
  // Retorna: attachment + signedUrl para preview imediato
  fastify.post<{ Params: { id: string } }>(
    '/conversations/:id/media',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId, userId } = request.workspaceCtx;
      const conversationId = request.params.id;

      const fileData = await request.file();
      if (!fileData) {
        throw new ValidationException({ file: ['Nenhum arquivo enviado'] });
      }

      // Ler buffer completo em memória
      const chunks: Buffer[] = [];
      for await (const chunk of fileData.file) {
        chunks.push(chunk as Buffer);
      }
      const buffer   = Buffer.concat(chunks);
      const mimeType = fileData.mimetype;
      const filename = fileData.filename || 'upload';

      if (buffer.length === 0) {
        throw new ValidationException({ file: ['Arquivo vazio'] });
      }

      const result = await service.uploadMedia(
        workspaceId,
        conversationId,
        userId,
        buffer,
        filename,
        mimeType,
      );

      return sendCreated(reply, result);
    },
  );

  // ── POST /conversations/:id/media/:attId/send ───────────────
  // Fase 4 — Envia mídia já upada para o contato via Evolution
  fastify.post<{ Params: { id: string; attId: string }; Body: SendMediaBody }>(
    '/conversations/:id/media/:attId/send',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId, userId } = request.workspaceCtx;
      const body: SendMediaBody = {
        attachmentId: request.params.attId,
        caption:      (request.body as SendMediaBody)?.caption,
      };

      const msg = await service.sendMediaMessage(
        workspaceId,
        request.params.id,
        userId,
        body,
      );

      return sendCreated(reply, msg);
    },
  );

  // ── GET /media/:attachmentId/url ────────────────────────────
  // Fase 4 — Gera URL assinada temporária para acesso a mídia
  // Query: download=true → TTL maior (para documentos)
  fastify.get<{
    Params: { attachmentId: string };
    Querystring: { download?: string };
  }>(
    '/media/:attachmentId/url',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId }   = request.workspaceCtx;
      const { attachmentId }  = request.params;
      const forDownload       = request.query.download === 'true';

      const result = await service.getSecureMediaUrl(workspaceId, attachmentId, forDownload);
      return sendOk(reply, result);
    },
  );

  // ── POST /conversations/:id/ai/analyze ──────────────────────
  // Fase 5 — Solicita análise de IA (enfileira job assíncrono)
  // Retorna imediatamente com status 'pending'
  fastify.post<ConvParams>(
    '/conversations/:id/ai/analyze',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId, userId } = request.workspaceCtx;
      const record = await service.requestAiAnalysis(workspaceId, request.params.id, userId);
      return sendCreated(reply, record);
    },
  );

  // ── GET /conversations/:id/ai ────────────────────────────────
  // Fase 5 — Retorna a análise IA atual da conversa
  fastify.get<ConvParams>(
    '/conversations/:id/ai',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      const analysis = await service.getAiAnalysis(workspaceId, request.params.id);
      return sendOk(reply, analysis);
    },
  );

  // ════════════════════════════════════════════════════════════
  // FASE 6 — SLA, Automações e Dashboard Operacional
  // ════════════════════════════════════════════════════════════

  // ── GET /dashboard ───────────────────────────────────────────
  // Dashboard operacional com métricas agregadas (cache 30s)
  fastify.get<{ Querystring: DashboardQuery }>(
    '/dashboard',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      const metrics = await service.getDashboard(workspaceId, request.query);
      return sendOk(reply, metrics);
    },
  );

  // ── GET /sla-policies ────────────────────────────────────────
  fastify.get(
    '/sla-policies',
    { preHandler: adminOnly },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      return sendOk(reply, await service.listSlaPolicies(workspaceId));
    },
  );

  // ── POST /sla-policies ───────────────────────────────────────
  fastify.post<{ Body: CreateSlaPolicyBody }>(
    '/sla-policies',
    { preHandler: adminOnly },
    async (request, reply) => {
      const { workspaceId, userId } = request.workspaceCtx;
      const { first_response_minutes, resolution_minutes, name } = request.body;
      if (!name?.trim()) throw new ValidationException({ name: ['Obrigatório'] });
      if (!first_response_minutes || first_response_minutes < 1)
        throw new ValidationException({ first_response_minutes: ['Deve ser >= 1'] });
      if (!resolution_minutes || resolution_minutes < 1)
        throw new ValidationException({ resolution_minutes: ['Deve ser >= 1'] });
      return sendCreated(reply, await service.createSlaPolicy(workspaceId, request.body, userId));
    },
  );

  // ── PATCH /sla-policies/:id ──────────────────────────────────
  fastify.patch<{ Params: { id: string }; Body: UpdateSlaPolicyBody }>(
    '/sla-policies/:id',
    { preHandler: adminOnly },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      return sendOk(reply, await service.updateSlaPolicy(workspaceId, request.params.id, request.body));
    },
  );

  // ── DELETE /sla-policies/:id ─────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/sla-policies/:id',
    { preHandler: adminOnly },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      await service.deleteSlaPolicy(workspaceId, request.params.id);
      return sendNoContent(reply);
    },
  );

  // ── GET /automations ─────────────────────────────────────────
  fastify.get<{ Querystring: { trigger?: string } }>(
    '/automations',
    { preHandler: adminOnly },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      return sendOk(reply, await service.listAutomationRules(workspaceId, request.query.trigger));
    },
  );

  // ── POST /automations ────────────────────────────────────────
  fastify.post<{ Body: CreateAutomationRuleBody }>(
    '/automations',
    { preHandler: adminOnly },
    async (request, reply) => {
      const { workspaceId, userId } = request.workspaceCtx;
      const { name, trigger_type, actions } = request.body;
      if (!name?.trim())       throw new ValidationException({ name: ['Obrigatório'] });
      if (!trigger_type)       throw new ValidationException({ trigger_type: ['Obrigatório'] });
      if (!actions?.length)    throw new ValidationException({ actions: ['Pelo menos uma ação obrigatória'] });
      return sendCreated(reply, await service.createAutomationRule(workspaceId, request.body, userId));
    },
  );

  // ── PATCH /automations/:id ───────────────────────────────────
  fastify.patch<{ Params: { id: string }; Body: UpdateAutomationRuleBody }>(
    '/automations/:id',
    { preHandler: adminOnly },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      return sendOk(reply, await service.updateAutomationRule(workspaceId, request.params.id, request.body));
    },
  );

  // ── DELETE /automations/:id ──────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/automations/:id',
    { preHandler: adminOnly },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      await service.deleteAutomationRule(workspaceId, request.params.id);
      return sendNoContent(reply);
    },
  );

  // ── GET /alerts ──────────────────────────────────────────────
  fastify.get<{ Querystring: AlertsQuery }>(
    '/alerts',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      const { alerts, total } = await service.getAlerts(workspaceId, request.query);
      const page  = parseInt(request.query.page  ?? '1',  10) || 1;
      const limit = parseInt(request.query.limit ?? '30', 10) || 30;
      return sendOk(reply, alerts, {
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    },
  );

  // ── POST /alerts/:id/resolve ─────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/alerts/:id/resolve',
    { preHandler: agentMin },
    async (request, reply) => {
      const { workspaceId } = request.workspaceCtx;
      await service.resolveAlert(workspaceId, request.params.id);
      return sendNoContent(reply);
    },
  );
}

