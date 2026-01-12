import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'configuracoes.json');

// Garantir que o arquivo existe
function garantirArquivoConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({
      sistema: {},
      whatsapp: {}
    }, null, 2));
  }
}

// Ler configurações
function lerConfiguracoes() {
  garantirArquivoConfig();
  try {
    const dados = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(dados);
  } catch (error) {
    return { sistema: {}, whatsapp: {} };
  }
}

// Salvar configurações
function salvarConfiguracoes(dados) {
  garantirArquivoConfig();
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(dados, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    return false;
  }
}

export default function handler(req, res) {
  // GET: Recuperar configurações
  if (req.method === 'GET') {
    try {
      const config = lerConfiguracoes();
      return res.status(200).json({
        sucesso: true,
        dados: config.sistema || {}
      });
    } catch (error) {
      console.error('Erro ao ler configurações:', error);
      return res.status(500).json({
        sucesso: false,
        erro: 'Erro ao recuperar configurações'
      });
    }
  }

  // POST: Salvar configurações
  if (req.method === 'POST') {
    try {
      const { dados } = req.body;

      if (!dados) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Dados do sistema são obrigatórios'
        });
      }

      // Validar campos obrigatórios
      if (!dados.nomeParlamentar || !dados.cnpj) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Nome do Parlamentar e CNPJ são obrigatórios'
        });
      }

      // Ler configurações atuais
      const config = lerConfiguracoes();

      // Atualizar dados do sistema
      config.sistema = {
        ...config.sistema,
        ...dados,
        dataAtualizacao: new Date().toISOString()
      };

      // Salvar
      if (salvarConfiguracoes(config)) {
        return res.status(200).json({
          sucesso: true,
          mensagem: 'Configurações salvas com sucesso',
          dados: config.sistema
        });
      } else {
        return res.status(500).json({
          sucesso: false,
          erro: 'Erro ao salvar configurações'
        });
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      return res.status(500).json({
        sucesso: false,
        erro: 'Erro ao processar requisição'
      });
    }
  }

  res.status(405).json({ erro: 'Método não permitido' });
}
