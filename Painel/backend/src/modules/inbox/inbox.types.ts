// ──────────────────────────────────────────────────────────────
// INBOX — TIPOS CENTRAIS
// Interfaces para conversas, mensagens e presença de agentes.
// ──────────────────────────────────────────────────────────────

export type ConversationStatus = 'open' | 'pending' | 'waiting' | 'closed' | 'archived';
export type MessageDirection   = 'inbound' | 'outbound' | 'system' | 'ai';
export type MessageStatus      = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
export type AgentPresence      = 'online' | 'offline' | 'busy' | 'away' | 'dnd';

// ── Conversa ───────────────────────────────────────────────────

export interface Conversation {
  id:                 string;
  workspace_id:       string;
  contact_id:         string | null;
  instance_id:        string | null;
  status:             ConversationStatus;
  priority:           number;
  subject:            string | null;
  channel:            string;
  external_id:        string | null;
  unread_count:       number;
  last_message_at:    string | null;
  assigned_agent_id:  string | null;
  department_id:      string | null;
  closed_at:          string | null;
  waiting_at:         string | null;
  created_at:         string;
  updated_at:         string;
  // relações opcionais (join)
  contact?:           ContactSummary;
  agent?:             AgentSummary | null;
  last_message?:      MessageSummary | null;
}

export interface ContactSummary {
  id:    string;
  name:  string | null;
  phone: string;
}

export interface AgentSummary {
  id:           string;
  display_name: string | null;
  user_id:      string | null;
}

export interface MessageSummary {
  message:    string | null;
  direction:  MessageDirection;
  created_at: string;
}

// ── Mensagem ───────────────────────────────────────────────────

export interface ConversationMessage {
  id:                   string;
  workspace_id:         string;
  conversation_id:      string;
  direction:            MessageDirection;
  sender_id:            string | null;
  message:              string | null;
  media_url:            string | null;
  media_type:           string | null;
  media_attachment_id:  string | null;
  status:               MessageStatus;
  sent_at:              string | null;
  delivered_at:         string | null;
  read_at:              string | null;
  provider_message_id:  string | null;
  reply_to_message_id:  string | null;
  is_deleted:           boolean;
  edited_at:            string | null;
  metadata:             Record<string, unknown>;
  created_at:           string;
  updated_at:           string;
}

// ── Agente ─────────────────────────────────────────────────────

export interface Agent {
  id:            string;
  workspace_id:  string;
  user_id:       string | null;
  display_name:  string | null;
  department_id: string | null;
  role:          string;
  is_active:     boolean;
  presence?:     AgentPresenceRow | null;
}

export interface AgentPresenceRow {
  agent_id:     string;
  status:       AgentPresence;
  last_seen_at: string | null;
}

// ── Payload do webhook Evolution (MESSAGES_UPSERT) ─────────────

export interface EvolutionMediaMessage {
  url?:         string;
  mimetype?:    string;
  caption?:     string;
  fileName?:    string;
  fileLength?:  string | number;
  seconds?:     number;  // áudio/vídeo
  width?:       number;
  height?:      number;
}

export interface EvolutionMessagePayload {
  event:    string;
  instance: string;
  data:     {
    key: {
      remoteJid: string;
      id:        string;
      fromMe:    boolean;
    };
    message?: {
      conversation?:        string;
      extendedTextMessage?: { text?: string };
      imageMessage?:        EvolutionMediaMessage;
      videoMessage?:        EvolutionMediaMessage;
      audioMessage?:        EvolutionMediaMessage;
      documentMessage?:     EvolutionMediaMessage & { title?: string };
      stickerMessage?:      EvolutionMediaMessage;
    };
    messageType?:      string;
    messageTimestamp?: number;
    pushName?:         string;
  };
}

// ── Parâmetros de entrada dos endpoints ────────────────────────

export interface ListConversationsQuery {
  status?:       ConversationStatus;
  agentId?:      string;
  departmentId?: string;
  labelId?:      string;
  instanceId?:   string;
  unreadOnly?:   string;   // 'true'
  from?:         string;   // ISO date
  to?:           string;   // ISO date
  search?:       string;   // busca por nome/telefone do contato
  page?:         string;
  limit?:        string;
}

export interface SendMessageBody {
  text:               string;
  reply_to_message_id?: string;
}

export interface UpdateStatusBody {
  status: ConversationStatus;
}

export interface AssignBody {
  agentId: string | null;
}

// ── Resposta da listagem com metadados ─────────────────────────

export interface ConversationListResult {
  conversations: Conversation[];
  unreadTotal:   number;
}

// ── Fase 2 — novos tipos ─────────────────────────────────────

export interface TransferBody {
  /** agentId destino — null para desatribuir */
  toAgentId: string | null;
  /** Nota opcional exibida como mensagem de sistema */
  note?:     string;
}

export interface UnreadSummary {
  workspaceTotal: number;
  agentTotal:     number;
}

export interface AgentListItem {
  id:           string;
  display_name: string | null;
  user_id:      string | null;
}

// ── Fase 3 — Labels, busca, reply-to, soft-delete, respostas rápidas ──

export interface Label {
  id:           string;
  workspace_id: string;
  name:         string;
  color:        string;
  created_at:   string;
  updated_at:   string;
}

export interface ConversationLabelMap {
  id:              string;
  workspace_id:    string;
  conversation_id: string;
  label_id:        string;
  created_by:      string | null;
  created_at:      string;
  label?:          Label;
}

export interface QuickReply {
  id:           string;
  workspace_id: string;
  shortcut:     string;
  title:        string;
  body:         string;
  category:     string | null;
  is_active:    boolean;
  created_by:   string | null;
  created_at:   string;
  updated_at:   string;
}

export interface CreateLabelBody {
  name:   string;
  color?: string;
}

export interface UpdateLabelBody {
  name?:  string;
  color?: string;
}

export interface AddLabelBody {
  labelId: string;
}

export interface CreateQuickReplyBody {
  shortcut:  string;
  title:     string;
  body:      string;
  category?: string;
}

export interface UpdateQuickReplyBody {
  shortcut?:  string;
  title?:     string;
  body?:      string;
  category?:  string;
  is_active?: boolean;
}

export interface SearchMessagesQuery {
  q:      string;
  page?:  string;
  limit?: string;
}

export interface DeleteMessageBody {
  /** apenas soft-delete — campo de confirmação intencional */
  confirm: true;
}

// ── Fase 4 — Mídia e conteúdo rico ──────────────────────────

export type MediaType = 'image' | 'video' | 'audio' | 'document';

export interface MediaAttachment {
  id:               string;
  workspace_id:     string;
  conversation_id:  string;
  message_id:       string | null;
  media_type:       MediaType;
  filename:         string;
  mime_type:        string;
  size_bytes:       number;
  storage_path:     string;
  duration_seconds: number | null;
  width:            number | null;
  height:           number | null;
  created_by:       string | null;
  created_at:       string;
}

export interface SendMediaBody {
  /** ID do attachment já upado — apenas referenciar */
  attachmentId: string;
  caption?:     string;
}

export interface MediaUploadResult {
  attachment: MediaAttachment;
  /** URL assinada temporária para preview imediato no frontend */
  signedUrl:  string;
}

// ── Fase 5 — IA Assistiva ───────────────────────────────────

export type ConversationCategory =
  | 'vendas' | 'suporte' | 'financeiro'
  | 'cancelamento' | 'reclamacao' | 'spam' | 'outros';

export type AiPriority  = 'baixa' | 'media' | 'alta' | 'urgente';
export type AiSentiment = 'positivo' | 'neutro' | 'negativo';
export type AiAnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ConversationAiAnalysis {
  id:                   string;
  workspace_id:         string;
  conversation_id:      string;
  status:               AiAnalysisStatus;
  error_message:        string | null;
  category:             ConversationCategory | null;
  category_confidence:  number | null;
  priority:             AiPriority | null;
  priority_reason:      string | null;
  summary:              string | null;
  key_points:           string[];
  next_action:          string | null;
  main_intent:          string | null;
  sentiment:            AiSentiment | null;
  sentiment_score:      number | null;
  lead_score:           number | null;
  lead_score_reason:    string | null;
  suggestions:          string[];
  model_used:           string | null;
  messages_analyzed:    number | null;
  analyzed_at:          string | null;
  created_at:           string;
  updated_at:           string;
}

/** Subconjunto de campos que a IA preenche (todos opcionais) */
export type AiAnalysisResult = Omit<
  ConversationAiAnalysis,
  'id' | 'workspace_id' | 'conversation_id' | 'status' | 'error_message'
  | 'model_used' | 'messages_analyzed' | 'analyzed_at' | 'created_at' | 'updated_at'
>;

export interface AiAnalysisJobData {
  workspaceId:    string;
  conversationId: string;
  triggeredBy:    string | null;  // userId que disparou (null = automático)
}

// ── Fase 6 — SLA, Automações e Dashboard ─────────────────────

export interface SlaPolicy {
  id:                     string;
  workspace_id:           string;
  name:                   string;
  is_default:             boolean;
  first_response_minutes: number;
  resolution_minutes:     number;
  /** Overrides por prioridade numérica: { "4": { first_response: 15, resolution: 60 } } */
  priority_overrides:     Record<string, { first_response?: number; resolution?: number }>;
  created_at:             string;
  updated_at:             string;
}

export interface CreateSlaPolicyBody {
  name:                   string;
  is_default?:            boolean;
  first_response_minutes: number;
  resolution_minutes:     number;
  priority_overrides?:    Record<string, { first_response?: number; resolution?: number }>;
}

export interface UpdateSlaPolicyBody {
  name?:                   string;
  is_default?:             boolean;
  first_response_minutes?: number;
  resolution_minutes?:     number;
  priority_overrides?:     Record<string, { first_response?: number; resolution?: number }>;
}

export type AutomationTrigger =
  | 'conversation_created'
  | 'conversation_reopened'
  | 'status_changed'
  | 'no_response_timeout'
  | 'sla_breach'
  | 'first_message'
  | 'label_added';

export interface AutomationCondition {
  field:    string;
  operator: 'equals' | 'not_equals' | 'contains' | 'is_null' | 'is_not_null' | 'in';
  value?:   unknown;
}

export interface AutomationAction {
  type:           string;
  agent_id?:      string | null;
  department_id?: string;
  label_id?:      string;
  priority?:      number;
  status?:        ConversationStatus;
  message?:       string;
}

export interface AutomationRule {
  id:           string;
  workspace_id: string;
  name:         string;
  is_active:    boolean;
  trigger_type: AutomationTrigger;
  conditions:   AutomationCondition[];
  actions:      AutomationAction[];
  run_order:    number;
  created_by:   string | null;
  created_at:   string;
  updated_at:   string;
}

export interface CreateAutomationRuleBody {
  name:         string;
  trigger_type: AutomationTrigger;
  conditions?:  AutomationCondition[];
  actions:      AutomationAction[];
  run_order?:   number;
  is_active?:   boolean;
}

export interface UpdateAutomationRuleBody {
  name?:         string;
  trigger_type?: AutomationTrigger;
  conditions?:   AutomationCondition[];
  actions?:      AutomationAction[];
  run_order?:    number;
  is_active?:    boolean;
}

export type InboxAlertType =
  | 'sla_first_response_breach'
  | 'sla_resolution_breach'
  | 'agent_overloaded'
  | 'queue_growing'
  | 'webhook_failing'
  | 'instance_disconnected';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface InboxAlert {
  id:              string;
  workspace_id:    string;
  alert_type:      InboxAlertType;
  severity:        AlertSeverity;
  title:           string;
  message:         string;
  metadata:        Record<string, unknown>;
  conversation_id: string | null;
  agent_id:        string | null;
  instance_id:     string | null;
  resolved:        boolean;
  resolved_at:     string | null;
  created_at:      string;
}

export interface CreateAlertBody {
  alert_type:      InboxAlertType;
  severity?:       AlertSeverity;
  title:           string;
  message:         string;
  metadata?:       Record<string, unknown>;
  conversation_id?: string;
  agent_id?:        string;
  instance_id?:     string;
}

export interface AlertsQuery {
  resolved?: string;
  type?:     string;
  page?:     string;
  limit?:    string;
}

// ── Dashboard ─────────────────────────────────────────────────

export interface DashboardQuery {
  from?:         string;  // ISO date, default: 30 dias atrás
  to?:           string;  // ISO date, default: agora
  departmentId?: string;
  agentId?:      string;
}

export interface ConversationStatusCounts {
  open:     number;
  pending:  number;
  waiting:  number;
  closed:   number;
  archived: number;
}

export interface AgentWorkload {
  agent_id:     string;
  display_name: string | null;
  open_count:   number;
  is_online:    boolean;
}

export interface HourlyVolume {
  hour:  string;  // "2026-05-08T14"
  count: number;
}

export interface DepartmentVolume {
  department_id:   string | null;
  department_name: string | null;
  count:           number;
}

export interface SlaMetrics {
  avg_first_response_minutes:      number | null;
  avg_resolution_minutes:          number | null;
  sla_first_response_breach_count: number;
  sla_resolution_breach_count:     number;
  breach_rate_pct:                 number;
}

export interface AiDashboardMetrics {
  avg_lead_score:          number | null;
  avg_sentiment_score:     number | null;
  sentiment_distribution:  { positivo: number; neutro: number; negativo: number };
  ai_priority_distribution: { baixa: number; media: number; alta: number; urgente: number };
}

export interface DashboardMetrics {
  period:            { from: string; to: string };
  status_counts:     ConversationStatusCounts;
  agents_online:     number;
  agent_workload:    AgentWorkload[];
  sla:               SlaMetrics;
  hourly_volume:     HourlyVolume[];
  department_volume: DepartmentVolume[];
  ai:                AiDashboardMetrics;
  generated_at:      string;
}

