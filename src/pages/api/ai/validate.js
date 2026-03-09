import crypto from 'crypto';
import { lerConfiguracoes, salvarConfiguracoes } from '@/lib/configuracoes';

export const runtime = 'nodejs';

const PLANNER_PROMPT = `Voce e um planejador de consultas do MandatoPro.\n` +
  `Responda APENAS com JSON valido.\n` +
  `Tabelas permitidas: campanhas, agenda_eventos, liderancas, eleitores, atendimentos, solicitacoes.\n` +
  `Acoes permitidas: list, search, count, none.\n` +
  `Filtros permitidos: status, municipio, cidade, bairro, data_from, data_to.\n` +
  `Use o campo search para nome/titulo/protocolo.\n` +
  `Se nao for pergunta de dados, use {"action":"none","reason":"..."}.`;

export default async function handler(req, res) {
  const traceId = crypto.randomUUID();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido', traceId });
  }

  try {
    const { apiKey, model, provider, dryRunPlanner, plannerQuestion } = req.body || {};
    const config = lerConfiguracoes();
    const selectedProvider = String(provider || config.openai?.provider || 'openai').toLowerCase();
    const token = apiKey || (selectedProvider === 'groq' ? config.openai?.groqApiKey : config.openai?.apiKey);
    const modelo = model || (selectedProvider === 'groq'
      ? (config.openai?.groqModel || 'llama-3.1-8b-instant')
      : (config.openai?.model || 'gpt-4o-mini'));
    const endpoint = selectedProvider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    const providerLabel = selectedProvider === 'groq' ? 'Groq' : 'OpenAI';

    if (!token) {
      return res.status(400).json({ success: false, message: `API Key nao configurada (${providerLabel})`, traceId });
    }

    if (dryRunPlanner) {
      const question = String(plannerQuestion || 'Liste campanhas recentes.');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          model: modelo,
          messages: [
            { role: 'system', content: PLANNER_PROMPT },
            { role: 'user', content: question }
          ],
          max_tokens: 200,
          temperature: 0
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let message = `Falha ao validar ${providerLabel}`;
        let code = '';
        try {
          const parsed = JSON.parse(errorText);
          message = parsed?.error?.message || message;
          code = parsed?.error?.code || parsed?.error?.type || '';
        } catch (error) {
          message = errorText || message;
        }

        if (selectedProvider === 'openai' && (String(code).toLowerCase() === 'insufficient_quota' || message.toLowerCase().includes('quota'))) {
          const config = lerConfiguracoes();
          config.openai = {
            ...config.openai,
            enabled: false,
            lastError: 'insufficient_quota',
            dataAtualizacao: new Date().toISOString()
          };
          salvarConfiguracoes(config);

          return res.status(400).json({
            success: false,
            message: 'Sem creditos na OpenAI. A IA foi desativada automaticamente.',
            traceId
          });
        }

        return res.status(400).json({
          success: false,
          message,
          details: errorText,
          traceId
        });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      let parsedOk = false;
      try {
        JSON.parse(content);
        parsedOk = true;
      } catch (error) {
        parsedOk = false;
      }

      return res.status(200).json({
        success: parsedOk,
        plannerOk: parsedOk,
        plannerRaw: content,
        traceId
      });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: 'system', content: 'Voce e um assistente de teste.' },
          { role: 'user', content: 'Responda apenas com a palavra OK.' }
        ],
        max_tokens: 5,
        temperature: 0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let message = `Falha ao validar ${providerLabel}`;
      let code = '';
      try {
        const parsed = JSON.parse(errorText);
        message = parsed?.error?.message || message;
        code = parsed?.error?.code || parsed?.error?.type || '';
      } catch (error) {
        message = errorText || message;
      }

      if (selectedProvider === 'openai' && (String(code).toLowerCase() === 'insufficient_quota' || message.toLowerCase().includes('quota'))) {
        const config = lerConfiguracoes();
        config.openai = {
          ...config.openai,
          enabled: false,
          lastError: 'insufficient_quota',
          dataAtualizacao: new Date().toISOString()
        };
        salvarConfiguracoes(config);

        return res.status(400).json({
          success: false,
          message: 'Sem creditos na OpenAI. A IA foi desativada automaticamente.',
          traceId
        });
      }

      return res.status(400).json({
        success: false,
        message,
        details: errorText,
        traceId
      });
    }

    return res.status(200).json({ success: true, traceId });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, traceId });
  }
}
