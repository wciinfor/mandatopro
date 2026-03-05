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

export function garantirArquivoConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
  }
}

export function lerConfiguracoes() {
  garantirArquivoConfig();
  try {
    const dados = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(dados);
    return {
      ...defaultConfig,
      ...parsed,
      openai: {
        ...defaultConfig.openai,
        ...(parsed.openai || {})
      }
    };
  } catch (error) {
    return { ...defaultConfig };
  }
}

export function salvarConfiguracoes(dados) {
  garantirArquivoConfig();
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(dados, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar configuracoes:', error);
    return false;
  }
}
