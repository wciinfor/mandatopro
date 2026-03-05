import { lerConfiguracoes, salvarConfiguracoes } from '@/lib/configuracoes';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  }

  try {
    const { apiKey, model, provider } = req.body || {};
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
      return res.status(400).json({ success: false, message: `API Key nao configurada (${providerLabel})` });
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
          message: 'Sem creditos na OpenAI. A IA foi desativada automaticamente.'
        });
      }

      return res.status(400).json({
        success: false,
        message,
        details: errorText
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
