// API para gerenciar configurações do sistema
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'public', 'sistema-config.json');

// Garantir que o arquivo existe
const ensureConfigFile = () => {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      const defaultConfig = {
        nomeOrgao: '',
        sigla: '',
        logo: null,
        cnpj: '',
        endereco: '',
        telefone: '',
        email: '',
        website: '',
        cargo: '',
        nomeParlamentar: '',
        corPrincipal: '#14b8a6',
        corSecundaria: '#0d9488',
        whatsapp: {
          phoneNumberId: '',
          accessToken: ''
        },
        updatedAt: new Date().toISOString()
      };
      
      const dir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    }
  } catch (error) {
    console.error('Erro ao criar arquivo de configuração:', error);
  }
};

export default function handler(req, res) {
  try {
    ensureConfigFile();

    if (req.method === 'GET') {
      // Recuperar configurações
      const config = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const data = JSON.parse(config);
      
      res.status(200).json({
        success: true,
        data
      });
    } 
    else if (req.method === 'POST') {
      // Salvar configurações
      const { tipo, dados } = req.body;

      if (!tipo || !dados) {
        return res.status(400).json({
          success: false,
          message: 'Tipo e dados são obrigatórios'
        });
      }

      const config = fs.readFileSync(CONFIG_FILE, 'utf-8');
      let data = JSON.parse(config);

      if (tipo === 'sistema') {
        // Atualizar dados do sistema
        data = {
          ...data,
          ...dados,
          updatedAt: new Date().toISOString()
        };
      } 
      else if (tipo === 'whatsapp') {
        // Atualizar configurações do WhatsApp
        data.whatsapp = {
          ...data.whatsapp,
          ...dados,
          updatedAt: new Date().toISOString()
        };
      }

      fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));

      res.status(200).json({
        success: true,
        message: 'Configuração salva com sucesso',
        data
      });
    }
    else {
      res.status(405).json({
        success: false,
        message: 'Método não permitido'
      });
    }
  } catch (error) {
    console.error('Erro na API de configurações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao processar configuração',
      error: error.message
    });
  }
}
