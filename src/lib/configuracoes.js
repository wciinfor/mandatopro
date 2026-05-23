import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'configuracoes.private.json');

const defaultConfig = {
  openai: {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
    groqApiKey: '',
    groqModel: 'llama-3.1-8b-instant',
    enabled: false
  }
};

function envBool(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return ['1', 'true', 'sim', 'yes', 'on'].includes(String(value).toLowerCase());
}

function aplicarFallbackEnv(config) {
  const envProvider = process.env.AI_PROVIDER || process.env.OPENAI_PROVIDER;
  const envOpenAiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  const envGroqKey = process.env.GROQ_API_KEY || process.env.GROQ_KEY;
  const envEnabled = envBool(process.env.AI_ENABLED || process.env.OPENAI_ENABLED);

  const openai = {
    ...config.openai,
    provider: config.openai?.provider || envProvider || defaultConfig.openai.provider,
    apiKey: config.openai?.apiKey || envOpenAiKey || '',
    model: config.openai?.model || process.env.OPENAI_MODEL || defaultConfig.openai.model,
    groqApiKey: config.openai?.groqApiKey || envGroqKey || '',
    groqModel: config.openai?.groqModel || process.env.GROQ_MODEL || defaultConfig.openai.groqModel
  };

  if (envProvider && !config.openai?.provider) {
    openai.provider = envProvider;
  } else if (!config.openai?.provider && envGroqKey) {
    openai.provider = 'groq';
  }

  openai.enabled = envEnabled !== undefined
    ? envEnabled
    : Boolean(config.openai?.enabled || openai.apiKey || openai.groqApiKey);

  return { ...config, openai };
}

export function garantirArquivoConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    }
    return true;
  } catch (error) {
    console.warn('Nao foi possivel criar arquivo local de configuracoes; usando variaveis de ambiente quando disponiveis.');
    return false;
  }
}

export function lerConfiguracoes() {
  try {
    garantirArquivoConfig();
    if (!fs.existsSync(CONFIG_FILE)) {
      return aplicarFallbackEnv({ ...defaultConfig });
    }
    const dados = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(dados);
    return aplicarFallbackEnv({
      ...defaultConfig,
      ...parsed,
      openai: {
        ...defaultConfig.openai,
        ...(parsed.openai || {})
      }
    });
  } catch (error) {
    return aplicarFallbackEnv({ ...defaultConfig });
  }
}

export function salvarConfiguracoes(dados) {
  try {
    garantirArquivoConfig();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(dados, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar configuracoes:', error);
    return false;
  }
}
