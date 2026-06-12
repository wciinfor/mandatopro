import OpenAI from 'openai';
import { env }    from '../../config/env';
import { logger } from '../../utils/logger';
import type { AiAnalysisResult, ConversationCategory, AiPriority, AiSentiment } from './inbox.types';

// ──────────────────────────────────────────────────────────────
// INBOX AI SERVICE — Fase 5
//
// Wrapper para chamadas à API OpenAI.
// Constrói o prompt, chama a API e valida o retorno.
// Nunca lança erro propagado — retorna null em caso de falha.
// ──────────────────────────────────────────────────────────────

const MAX_CHARS_PER_MESSAGE = 500;
const MAX_MESSAGES          = 40;

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }
    _client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return _client;
}

// ── Tipos internos do prompt ──────────────────────────────────

interface MessageSnippet {
  direction: 'inbound' | 'outbound' | 'system' | 'ai';
  text:      string;
}

// ── Schema esperado da resposta da IA ─────────────────────────
// Usamos JSON mode para garantir resposta estruturada.

const SYSTEM_PROMPT = `
Você é um assistente especializado em análise de conversas de atendimento ao cliente.
Analise o histórico de mensagens fornecido e retorne EXCLUSIVAMENTE um JSON válido
no formato especificado. Não adicione texto fora do JSON.
Responda SEMPRE em português brasileiro.
`.trim();

function buildUserPrompt(messages: MessageSnippet[]): string {
  const history = messages
    .map((m) => {
      const role = m.direction === 'inbound'
        ? 'Cliente'
        : m.direction === 'outbound' || m.direction === 'ai'
          ? 'Atendente'
          : 'Sistema';
      return `[${role}]: ${m.text}`;
    })
    .join('\n');

  return `
Analise o seguinte histórico de conversa de atendimento:

---
${history}
---

Retorne um JSON com EXATAMENTE esta estrutura (sem campos extras):
{
  "category": "<vendas|suporte|financeiro|cancelamento|reclamacao|spam|outros>",
  "category_confidence": <número de 0.0 a 1.0>,
  "priority": "<baixa|media|alta|urgente>",
  "priority_reason": "<string curta explicando a prioridade>",
  "summary": "<resumo da conversa em 2-3 frases>",
  "key_points": ["<ponto 1>", "<ponto 2>", "<ponto 3 opcional>"],
  "next_action": "<próxima ação recomendada para o atendente>",
  "main_intent": "<intenção principal do cliente em uma frase>",
  "sentiment": "<positivo|neutro|negativo>",
  "sentiment_score": <número de -1.0 a 1.0>,
  "lead_score": <inteiro de 0 a 100>,
  "lead_score_reason": "<explicação do score em 1-2 frases>",
  "suggestions": [
    "<sugestão de resposta 1>",
    "<sugestão de resposta 2>",
    "<sugestão de resposta 3>"
  ]
}

Regras para lead_score:
- 0-20: sem interesse aparente / spam
- 21-40: interesse baixo, apenas consultando
- 41-60: interesse moderado, avaliando opções
- 61-80: interesse alto, próximo de decisão
- 81-100: comprador quente / urgente

Regras para priority:
- urgente: problema crítico, cliente em risco, financeiro bloqueado
- alta: problema ativo que impede o cliente de usar o serviço
- media: dúvida ou solicitação padrão em andamento
- baixa: curiosidade, spam, sem urgência

Retorne SOMENTE o JSON acima, sem markdown, sem explicações adicionais.
`.trim();
}

// ── Validação / parsing do JSON retornado ─────────────────────

const VALID_CATEGORIES = new Set(['vendas','suporte','financeiro','cancelamento','reclamacao','spam','outros']);
const VALID_PRIORITIES = new Set(['baixa','media','alta','urgente']);
const VALID_SENTIMENTS = new Set(['positivo','neutro','negativo']);

function parseAiResponse(raw: string): Partial<AiAnalysisResult> | null {
  let obj: Record<string, unknown>;
  try {
    // Remove possíveis blocos de código markdown caso o modelo os insira
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    obj = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    logger.warn({ raw: raw.slice(0, 200) }, 'InboxAI: resposta não é JSON válido');
    return null;
  }

  const category = VALID_CATEGORIES.has(String(obj['category']))
    ? (obj['category'] as ConversationCategory)
    : null;
  const priority = VALID_PRIORITIES.has(String(obj['priority']))
    ? (obj['priority'] as AiPriority)
    : null;
  const sentiment = VALID_SENTIMENTS.has(String(obj['sentiment']))
    ? (obj['sentiment'] as AiSentiment)
    : null;

  const clamp01  = (v: unknown) => typeof v === 'number' ? Math.max(0, Math.min(1, v)) : null;
  const clampN1  = (v: unknown) => typeof v === 'number' ? Math.max(-1, Math.min(1, v)) : null;
  const clamp100 = (v: unknown) => typeof v === 'number' ? Math.max(0, Math.min(100, Math.round(v))) : null;

  const toStringArr = (v: unknown, max: number): string[] => {
    if (!Array.isArray(v)) return [];
    return v.slice(0, max).map((s) => String(s).slice(0, 1000)).filter(Boolean);
  };

  return {
    category,
    category_confidence: clamp01(obj['category_confidence']),
    priority,
    priority_reason:     typeof obj['priority_reason']   === 'string' ? obj['priority_reason'].slice(0, 500)   : null,
    summary:             typeof obj['summary']            === 'string' ? obj['summary'].slice(0, 2000)           : null,
    key_points:          toStringArr(obj['key_points'], 5),
    next_action:         typeof obj['next_action']        === 'string' ? obj['next_action'].slice(0, 500)        : null,
    main_intent:         typeof obj['main_intent']        === 'string' ? obj['main_intent'].slice(0, 500)        : null,
    sentiment,
    sentiment_score:     clampN1(obj['sentiment_score']),
    lead_score:          clamp100(obj['lead_score']),
    lead_score_reason:   typeof obj['lead_score_reason']  === 'string' ? obj['lead_score_reason'].slice(0, 500)  : null,
    suggestions:         toStringArr(obj['suggestions'], 3),
  };
}

// ── Função pública ────────────────────────────────────────────

export interface AnalyzeConversationInput {
  messages: MessageSnippet[];
}

export async function analyzeConversation(
  input: AnalyzeConversationInput,
  modelOverride?: string,
): Promise<{ result: Partial<AiAnalysisResult>; model: string; messagesCount: number } | null> {
  const model = modelOverride ?? env.OPENAI_MODEL;

  // Limitar mensagens e tamanho
  const trimmed = input.messages
    .filter((m) => m.text?.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      direction: m.direction,
      text:      m.text.trim().slice(0, MAX_CHARS_PER_MESSAGE),
    }));

  if (trimmed.length === 0) {
    logger.warn('InboxAI: nenhuma mensagem para analisar');
    return null;
  }

  const userPrompt = buildUserPrompt(trimmed);

  try {
    const client     = getClient();
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature:     0.2,
      max_tokens:      1200,
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    if (!raw) {
      logger.warn({ model }, 'InboxAI: resposta vazia da API');
      return null;
    }

    const result = parseAiResponse(raw);
    if (!result) return null;

    logger.info(
      { model, messagesCount: trimmed.length, category: result.category, priority: result.priority },
      'InboxAI: análise concluída',
    );

    return { result, model, messagesCount: trimmed.length };
  } catch (err) {
    logger.error({ err, model }, 'InboxAI: erro na chamada à API OpenAI');
    return null;
  }
}
