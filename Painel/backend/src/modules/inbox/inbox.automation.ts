import { supabaseAdmin } from '../../config/supabase';
import { logger }        from '../../utils/logger';
import type { AutomationRule, AutomationCondition, AutomationAction, Conversation } from './inbox.types';

// ──────────────────────────────────────────────────────────────
// INBOX AUTOMATION — Fase 6
//
// Motor de regras automáticas de atendimento.
// Avalia condições contra a conversa e executa as ações definidas.
//
// NUNCA envia mensagem automaticamente para o cliente —
// a ação 'send_system_message' insere nota interna visível
// apenas na interface dos agentes (direction = 'system').
//
// Falhas em ações individuais são logadas mas não bloqueiam
// as demais ações da mesma regra.
// ──────────────────────────────────────────────────────────────

// ── Carregar regras ativas por trigger ────────────────────────

async function loadActiveRules(
  workspaceId: string,
  triggerType: string,
): Promise<AutomationRule[]> {
  const { data } = await supabaseAdmin
    .from('automation_rules')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('trigger_type', triggerType)
    .eq('is_active', true)
    .order('run_order', { ascending: true });
  return (data ?? []) as AutomationRule[];
}

// ── Avaliador de condições ────────────────────────────────────

function evaluateConditions(
  conditions: AutomationCondition[],
  conv:       Partial<Conversation>,
): boolean {
  if (conditions.length === 0) return true;

  return conditions.every((c) => {
    const fieldVal = (conv as Record<string, unknown>)[c.field];

    switch (c.operator) {
      case 'equals':      return fieldVal === c.value;
      case 'not_equals':  return fieldVal !== c.value;
      case 'contains':
        return typeof fieldVal === 'string'
          && fieldVal.toLowerCase().includes(String(c.value ?? '').toLowerCase());
      case 'is_null':     return fieldVal === null || fieldVal === undefined;
      case 'is_not_null': return fieldVal !== null && fieldVal !== undefined;
      case 'in':          return Array.isArray(c.value) && (c.value as unknown[]).includes(fieldVal);
      default:            return false;
    }
  });
}

// ── Executor de ações ─────────────────────────────────────────

async function executeAction(
  workspaceId:    string,
  conversationId: string,
  action:         AutomationAction,
): Promise<void> {
  switch (action.type) {
    case 'assign_to_agent':
      await supabaseAdmin
        .from('conversations')
        .update({ assigned_agent_id: action.agent_id ?? null })
        .eq('workspace_id', workspaceId)
        .eq('id', conversationId);
      break;

    case 'assign_to_department':
      if (action.department_id) {
        await supabaseAdmin
          .from('conversations')
          .update({ department_id: action.department_id })
          .eq('workspace_id', workspaceId)
          .eq('id', conversationId);
      }
      break;

    case 'change_status':
      if (action.status) {
        const patch: Record<string, unknown> = { status: action.status };
        if (action.status === 'closed') patch['closed_at'] = new Date().toISOString();
        if (action.status === 'waiting') patch['waiting_at'] = new Date().toISOString();

        await supabaseAdmin
          .from('conversations')
          .update(patch)
          .eq('workspace_id', workspaceId)
          .eq('id', conversationId);
      }
      break;

    case 'change_priority':
      if (action.priority !== undefined) {
        await supabaseAdmin
          .from('conversations')
          .update({ priority: action.priority })
          .eq('workspace_id', workspaceId)
          .eq('id', conversationId);
      }
      break;

    case 'add_label':
      if (action.label_id) {
        await supabaseAdmin
          .from('conversation_label_map')
          .upsert(
            {
              workspace_id:    workspaceId,
              conversation_id: conversationId,
              label_id:        action.label_id,
            },
            { onConflict: 'workspace_id,conversation_id,label_id' },
          );
      }
      break;

    case 'send_system_message':
      // Insere nota interna — direction='system', não enviada ao cliente
      if (action.message?.trim()) {
        await supabaseAdmin
          .from('conversation_messages')
          .insert({
            workspace_id:    workspaceId,
            conversation_id: conversationId,
            direction:       'system',
            message:         action.message.trim().slice(0, 2000),
            status:          'sent',
          });
      }
      break;

    default:
      logger.warn({ workspaceId, conversationId, actionType: action.type }, 'Automation: tipo de ação desconhecido');
  }
}

// ── Ponto de entrada público ──────────────────────────────────

export interface AutomationContext {
  conversation: Partial<Conversation>;
}

export async function triggerAutomations(
  workspaceId:    string,
  conversationId: string,
  triggerType:    string,
  ctx:            AutomationContext,
): Promise<void> {
  try {
    const rules = await loadActiveRules(workspaceId, triggerType);
    if (rules.length === 0) return;

    for (const rule of rules) {
      if (!evaluateConditions(rule.conditions, ctx.conversation)) continue;

      const actionsRun: string[] = [];
      let   success    = true;
      let   errorMsg: string | undefined;

      for (const action of rule.actions) {
        try {
          await executeAction(workspaceId, conversationId, action);
          actionsRun.push(action.type);
        } catch (err) {
          success  = false;
          errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
          logger.warn({ ruleId: rule.id, conversationId, actionType: action.type, err }, 'Automation: falha em ação');
        }
      }

      // Persiste log de execução (fire-and-forget — falha não propaga)
      supabaseAdmin
        .from('automation_executions')
        .insert({
          workspace_id:    workspaceId,
          rule_id:         rule.id,
          conversation_id: conversationId,
          actions_run:     actionsRun,
          success,
          error_message:   errorMsg ?? null,
        })
        .then()
        .catch((e: unknown) => logger.warn({ e }, 'Automation: falha ao salvar execução'));

      logger.debug(
        { ruleId: rule.id, conversationId, triggerType, actionsRun },
        'Automation: regra executada',
      );
    }
  } catch (err) {
    // Erros de automação NUNCA propagam — são sempre silenciados
    logger.warn({ workspaceId, conversationId, triggerType, err }, 'Automation: falha ao processar regras');
  }
}
