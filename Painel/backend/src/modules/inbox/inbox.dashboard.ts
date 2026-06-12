import { supabaseAdmin } from '../../config/supabase';
import { logger }        from '../../utils/logger';
import type {
  DashboardMetrics,
  DashboardQuery,
  ConversationStatusCounts,
  AgentWorkload,
  HourlyVolume,
  DepartmentVolume,
  SlaMetrics,
  AiDashboardMetrics,
} from './inbox.types';

// ──────────────────────────────────────────────────────────────
// INBOX DASHBOARD — Fase 6
//
// Agrega métricas operacionais em uma única chamada.
// Cache em memória por workspace com TTL de 30 segundos.
// ──────────────────────────────────────────────────────────────

// ── Cache em memória ──────────────────────────────────────────

interface CacheEntry {
  data: DashboardMetrics;
  ts:   number;
}

const _cache  = new Map<string, CacheEntry>();
const TTL_MS  = 30_000;

function _getCached(key: string): DashboardMetrics | null {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > TTL_MS) { _cache.delete(key); return null; }
  return e.data;
}

function _setCache(key: string, data: DashboardMetrics): void {
  _cache.set(key, { data, ts: Date.now() });
  // Evitar vazamento de memória: limitar o cache a 200 workspaces
  if (_cache.size > 200) {
    const oldest = _cache.keys().next().value;
    if (oldest) _cache.delete(oldest);
  }
}

// ── Helpers de período ────────────────────────────────────────

function _parsePeriod(query: DashboardQuery): { from: string; to: string } {
  const to   = query.to   ? new Date(query.to)   : new Date();
  const from = query.from ? new Date(query.from)  : new Date(to.getTime() - 30 * 24 * 60 * 60_000);
  return {
    from: from.toISOString(),
    to:   to.toISOString(),
  };
}

// ── Contagem de conversas por status ─────────────────────────

async function _statusCounts(workspaceId: string): Promise<ConversationStatusCounts> {
  const { data } = await supabaseAdmin
    .from('conversations')
    .select('status')
    .eq('workspace_id', workspaceId);

  const counts: ConversationStatusCounts = { open: 0, pending: 0, waiting: 0, closed: 0, archived: 0 };
  for (const c of (data ?? []) as Array<{ status: string }>) {
    const s = c.status as keyof ConversationStatusCounts;
    if (s in counts) counts[s]++;
  }
  return counts;
}

// ── Carga de trabalho por agente ──────────────────────────────

async function _agentWorkload(workspaceId: string): Promise<{ workload: AgentWorkload[]; onlineCount: number }> {
  // Agentes ativos
  const { data: agents } = await supabaseAdmin
    .from('agents')
    .select('id, display_name, presence:agent_presence(status)')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  if (!agents || agents.length === 0) return { workload: [], onlineCount: 0 };

  const agentIds = (agents as Array<{ id: string }>).map((a) => a.id);

  // Conversas abertas por agente
  const { data: openConvs } = await supabaseAdmin
    .from('conversations')
    .select('assigned_agent_id')
    .eq('workspace_id', workspaceId)
    .in('assigned_agent_id', agentIds)
    .in('status', ['open', 'pending', 'waiting']);

  const workloadMap = new Map<string, number>();
  for (const c of (openConvs ?? []) as Array<{ assigned_agent_id: string }>) {
    workloadMap.set(c.assigned_agent_id, (workloadMap.get(c.assigned_agent_id) ?? 0) + 1);
  }

  const workload: AgentWorkload[] = (agents as Array<{
    id: string;
    display_name: string | null;
    presence: Array<{ status: string }> | { status: string } | null;
  }>).map((a) => {
    const pres      = Array.isArray(a.presence) ? a.presence[0] : a.presence;
    const is_online = pres?.status === 'online';
    return {
      agent_id:     a.id,
      display_name: a.display_name,
      open_count:   workloadMap.get(a.id) ?? 0,
      is_online,
    };
  });

  workload.sort((a, b) => b.open_count - a.open_count);

  return {
    workload,
    onlineCount: workload.filter((a) => a.is_online).length,
  };
}

// ── Métricas SLA ──────────────────────────────────────────────

async function _slaMetrics(workspaceId: string, from: string, to: string): Promise<SlaMetrics> {
  const { data: convs } = await supabaseAdmin
    .from('conversations')
    .select(
      'created_at, first_response_at, closed_at, sla_first_response_breached, sla_resolution_breached',
    )
    .eq('workspace_id', workspaceId)
    .gte('created_at', from)
    .lte('created_at', to);

  const rows = (convs ?? []) as Array<{
    created_at:                    string;
    first_response_at:             string | null;
    closed_at:                     string | null;
    sla_first_response_breached:   boolean;
    sla_resolution_breached:       boolean;
  }>;

  let frSum = 0; let frCount = 0;
  let resSum = 0; let resCount = 0;
  let frBreachCount = 0; let resBreachCount = 0;

  for (const r of rows) {
    if (r.first_response_at) {
      frSum   += (new Date(r.first_response_at).getTime() - new Date(r.created_at).getTime()) / 60_000;
      frCount++;
    }
    if (r.closed_at) {
      resSum  += (new Date(r.closed_at).getTime() - new Date(r.created_at).getTime()) / 60_000;
      resCount++;
    }
    if (r.sla_first_response_breached) frBreachCount++;
    if (r.sla_resolution_breached)     resBreachCount++;
  }

  const totalBreaches = frBreachCount + resBreachCount;
  const total         = rows.length * 2; // dois SLAs por conversa

  return {
    avg_first_response_minutes:      frCount  > 0 ? Math.round(frSum  / frCount)  : null,
    avg_resolution_minutes:          resCount > 0 ? Math.round(resSum / resCount) : null,
    sla_first_response_breach_count: frBreachCount,
    sla_resolution_breach_count:     resBreachCount,
    breach_rate_pct:                 total > 0 ? Math.round((totalBreaches / total) * 100) : 0,
  };
}

// ── Volume por hora (últimas 24h) ─────────────────────────────

async function _hourlyVolume(workspaceId: string): Promise<HourlyVolume[]> {
  const ago24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const now    = new Date().toISOString();

  const { data } = await supabaseAdmin
    .from('conversation_messages')
    .select('created_at')
    .eq('workspace_id', workspaceId)
    .eq('direction', 'inbound')
    .gte('created_at', ago24h)
    .lte('created_at', now)
    .limit(10_000);

  const byHour = new Map<string, number>();
  for (const m of (data ?? []) as Array<{ created_at: string }>) {
    const hour = m.created_at.slice(0, 13);  // "2026-05-08T14"
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  }

  return Array.from(byHour.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}

// ── Volume por departamento ───────────────────────────────────

async function _departmentVolume(workspaceId: string, from: string, to: string): Promise<DepartmentVolume[]> {
  const { data: convs } = await supabaseAdmin
    .from('conversations')
    .select('department_id')
    .eq('workspace_id', workspaceId)
    .gte('created_at', from)
    .lte('created_at', to);

  const countMap = new Map<string | null, number>();
  for (const c of (convs ?? []) as Array<{ department_id: string | null }>) {
    const key = c.department_id ?? null;
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  // Resolver nomes dos departamentos
  const deptIds = Array.from(countMap.keys()).filter(Boolean) as string[];
  const nameMap = new Map<string, string>();

  if (deptIds.length > 0) {
    const { data: depts } = await supabaseAdmin
      .from('departments')
      .select('id, name')
      .eq('workspace_id', workspaceId)
      .in('id', deptIds);

    for (const d of (depts ?? []) as Array<{ id: string; name: string }>) {
      nameMap.set(d.id, d.name);
    }
  }

  return Array.from(countMap.entries())
    .map(([deptId, count]) => ({
      department_id:   deptId,
      department_name: deptId ? (nameMap.get(deptId) ?? null) : null,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

// ── Métricas de IA ────────────────────────────────────────────

async function _aiMetrics(workspaceId: string, from: string, to: string): Promise<AiDashboardMetrics> {
  const { data } = await supabaseAdmin
    .from('conversation_ai_analysis')
    .select('lead_score, sentiment, sentiment_score, priority')
    .eq('workspace_id', workspaceId)
    .eq('status', 'completed')
    .gte('analyzed_at', from)
    .lte('analyzed_at', to)
    .limit(5_000);

  const rows = (data ?? []) as Array<{
    lead_score:      number | null;
    sentiment:       string | null;
    sentiment_score: number | null;
    priority:        string | null;
  }>;

  let lsSum = 0;     let lsCount = 0;
  let ssSum = 0;     let ssCount = 0;
  const sentiment  = { positivo: 0, neutro: 0, negativo: 0 };
  const aiPriority = { baixa: 0, media: 0, alta: 0, urgente: 0 };

  for (const r of rows) {
    if (r.lead_score !== null)      { lsSum += r.lead_score; lsCount++; }
    if (r.sentiment_score !== null) { ssSum += r.sentiment_score; ssCount++; }
    if (r.sentiment && r.sentiment in sentiment) {
      sentiment[r.sentiment as keyof typeof sentiment]++;
    }
    if (r.priority && r.priority in aiPriority) {
      aiPriority[r.priority as keyof typeof aiPriority]++;
    }
  }

  return {
    avg_lead_score:           lsCount > 0 ? Math.round(lsSum / lsCount) : null,
    avg_sentiment_score:      ssCount > 0 ? Math.round((ssSum / ssCount) * 100) / 100 : null,
    sentiment_distribution:   sentiment,
    ai_priority_distribution: aiPriority,
  };
}

// ── Função pública: getDashboardMetrics ───────────────────────

export async function getDashboardMetrics(
  workspaceId: string,
  query:       DashboardQuery = {},
): Promise<DashboardMetrics> {
  const period   = _parsePeriod(query);
  const cacheKey = `${workspaceId}:${period.from.slice(0, 10)}:${period.to.slice(0, 10)}`;

  const cached = _getCached(cacheKey);
  if (cached) return cached;

  // Executar todas as queries em paralelo
  const [
    statusCounts,
    { workload, onlineCount },
    sla,
    hourlyVolume,
    deptVolume,
    ai,
  ] = await Promise.all([
    _statusCounts(workspaceId),
    _agentWorkload(workspaceId),
    _slaMetrics(workspaceId, period.from, period.to),
    _hourlyVolume(workspaceId),
    _departmentVolume(workspaceId, period.from, period.to),
    _aiMetrics(workspaceId, period.from, period.to),
  ]);

  const metrics: DashboardMetrics = {
    period,
    status_counts:     statusCounts,
    agents_online:     onlineCount,
    agent_workload:    workload,
    sla,
    hourly_volume:     hourlyVolume,
    department_volume: deptVolume,
    ai,
    generated_at:      new Date().toISOString(),
  };

  _setCache(cacheKey, metrics);

  logger.debug({ workspaceId }, 'Dashboard: métricas geradas');
  return metrics;
}

/** Invalida o cache de um workspace (após ação que muda métricas). */
export function invalidateDashboardCache(workspaceId: string): void {
  for (const key of _cache.keys()) {
    if (key.startsWith(`${workspaceId}:`)) {
      _cache.delete(key);
    }
  }
}
