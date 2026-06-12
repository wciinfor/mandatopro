import { supabaseAdmin } from '../../config/supabase';
import { logger }        from '../../utils/logger';
import type { SlaPolicy } from './inbox.types';

// ──────────────────────────────────────────────────────────────
// INBOX SLA — Fase 6
//
// Responsabilidades:
//  - Calcular e persistir deadlines SLA ao criar conversas
//  - Registrar primeira resposta de agente (first_response_at)
//  - Verificar e marcar breaches periodicamente (chamado pelo worker)
//  - Criar alertas para conversas em breach
//
// Nunca lança exceção — falhas são logadas e ignoradas para não
// bloquear o fluxo principal do inbox.
// ──────────────────────────────────────────────────────────────

// ── Política SLA padrão do workspace ─────────────────────────

export async function getDefaultSlaPolicy(
  workspaceId: string,
): Promise<SlaPolicy | null> {
  const { data } = await supabaseAdmin
    .from('sla_policies')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_default', true)
    .maybeSingle();
  return (data as SlaPolicy | null);
}

// ── Inicializar deadlines SLA numa nova conversa ──────────────

export async function initSlaDeadlines(
  workspaceId:    string,
  conversationId: string,
  priority        = 0,   // prioridade numérica da conversa (0 = baixa)
): Promise<void> {
  try {
    const policy = await getDefaultSlaPolicy(workspaceId);
    if (!policy) return;

    // Mapear prioridade numérica para chave de override
    const priorityKey = String(priority);
    const overrides   = policy.priority_overrides[priorityKey] ?? {};

    const firstResponseMin = overrides.first_response ?? policy.first_response_minutes;
    const resolutionMin    = overrides.resolution    ?? policy.resolution_minutes;

    const now = new Date();
    const frDeadline  = new Date(now.getTime() + firstResponseMin * 60_000);
    const resDeadline = new Date(now.getTime() + resolutionMin * 60_000);

    await supabaseAdmin
      .from('conversations')
      .update({
        sla_policy_id:               policy.id,
        sla_first_response_deadline: frDeadline.toISOString(),
        sla_resolution_deadline:     resDeadline.toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .eq('id', conversationId);

    logger.debug(
      { conversationId, firstResponseMin, resolutionMin },
      'SLA: deadlines inicializados',
    );
  } catch (err) {
    logger.warn({ err, conversationId }, 'SLA: falha ao inicializar deadlines');
  }
}

// ── Registrar primeira resposta de agente ─────────────────────
// Chamado em sendMessage + sendMediaMessage (apenas para outbound)

export async function recordFirstResponse(
  workspaceId:    string,
  conversationId: string,
): Promise<void> {
  try {
    // Verifica se já foi registrado antes de fazer UPDATE
    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('first_response_at')
      .eq('workspace_id', workspaceId)
      .eq('id', conversationId)
      .maybeSingle();

    if (!conv || conv.first_response_at) return; // já registrado

    await supabaseAdmin
      .from('conversations')
      .update({ first_response_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('id', conversationId);

    logger.debug({ conversationId }, 'SLA: primeira resposta registrada');
  } catch (err) {
    logger.warn({ err, conversationId }, 'SLA: falha ao registrar primeira resposta');
  }
}

// ── Verificar e marcar breaches (chamado pelo worker SLA) ─────

export interface SlaBreachResult {
  workspaceId:    string;
  conversationId: string;
  breachType:     'first_response' | 'resolution';
}

export async function checkAndMarkBreaches(): Promise<SlaBreachResult[]> {
  const now    = new Date().toISOString();
  const result: SlaBreachResult[] = [];

  // ── First response breach ─────────────────────────────────
  const { data: frBreaches } = await supabaseAdmin
    .from('conversations')
    .select('id, workspace_id')
    .eq('sla_first_response_breached', false)
    .is('first_response_at', null)   // ainda não respondeu
    .not('sla_first_response_deadline', 'is', null)
    .lt('sla_first_response_deadline', now)
    .not('status', 'in', '("closed","archived")');

  if (frBreaches && frBreaches.length > 0) {
    const ids = (frBreaches as Array<{ id: string; workspace_id: string }>).map((c) => c.id);

    await supabaseAdmin
      .from('conversations')
      .update({ sla_first_response_breached: true })
      .in('id', ids);

    for (const c of frBreaches as Array<{ id: string; workspace_id: string }>) {
      result.push({ workspaceId: c.workspace_id, conversationId: c.id, breachType: 'first_response' });
    }

    logger.info({ count: ids.length }, 'SLA: first_response_breach marcado em lote');
  }

  // ── Resolution breach ─────────────────────────────────────
  const { data: resBreaches } = await supabaseAdmin
    .from('conversations')
    .select('id, workspace_id')
    .eq('sla_resolution_breached', false)
    .not('sla_resolution_deadline', 'is', null)
    .lt('sla_resolution_deadline', now)
    .not('status', 'in', '("closed","archived")');

  if (resBreaches && resBreaches.length > 0) {
    const ids = (resBreaches as Array<{ id: string; workspace_id: string }>).map((c) => c.id);

    await supabaseAdmin
      .from('conversations')
      .update({ sla_resolution_breached: true })
      .in('id', ids);

    for (const c of resBreaches as Array<{ id: string; workspace_id: string }>) {
      result.push({ workspaceId: c.workspace_id, conversationId: c.id, breachType: 'resolution' });
    }

    logger.info({ count: ids.length }, 'SLA: resolution_breach marcado em lote');
  }

  return result;
}

// ── Criar alertas para breaches detectados ────────────────────

export async function createBreachAlerts(breaches: SlaBreachResult[]): Promise<void> {
  if (breaches.length === 0) return;

  const alerts = breaches.map((b) => ({
    workspace_id:    b.workspaceId,
    alert_type:      b.breachType === 'first_response'
      ? 'sla_first_response_breach'
      : 'sla_resolution_breach',
    severity:        'warning',
    title:           b.breachType === 'first_response'
      ? 'SLA de primeira resposta vencido'
      : 'SLA de resolução vencido',
    message:         `A conversa ultrapassou o prazo de ${b.breachType === 'first_response' ? 'primeira resposta' : 'resolução'} do SLA.`,
    conversation_id: b.conversationId,
    metadata:        { conversation_id: b.conversationId },
  }));

  const { error } = await supabaseAdmin
    .from('inbox_alerts')
    .insert(alerts);

  if (error) {
    logger.warn({ error, count: alerts.length }, 'SLA: falha ao criar alertas de breach');
  }
}
