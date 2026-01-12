// API para envio em massa de mensagens (Email, SMS, WhatsApp)
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'public', 'sistema-config.json');

// Simulação de banco de dados
const usuariosDB = {
  todos: [
    { id: 1, nome: 'João Silva', email: 'joao@example.com', telefone: '5591988889999', tipo: 'lideranca' },
    { id: 2, nome: 'Maria Costa', email: 'maria@example.com', telefone: '5591987778888', tipo: 'operador' },
    { id: 3, nome: 'Carlos Mendes', email: 'carlos@example.com', telefone: '5591986667777', tipo: 'operador' },
    { id: 4, nome: 'Ana Paula', email: 'ana@example.com', telefone: '5591985556666', tipo: 'lideranca' },
  ],
  liderancas: [
    { id: 1, nome: 'João Silva', email: 'joao@example.com', telefone: '5591988889999', tipo: 'lideranca' },
    { id: 4, nome: 'Ana Paula', email: 'ana@example.com', telefone: '5591985556666', tipo: 'lideranca' },
  ],
  operadores: [
    { id: 2, nome: 'Maria Costa', email: 'maria@example.com', telefone: '5591987778888', tipo: 'operador' },
    { id: 3, nome: 'Carlos Mendes', email: 'carlos@example.com', telefone: '5591986667777', tipo: 'operador' },
  ]
};

// Carregar configuração do WhatsApp
const carregarConfiguracao = () => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(config);
    }
  } catch (error) {
    console.error('Erro ao carregar configuração:', error);
  }
  return null;
};

// Enviar por WhatsApp
const enviarWhatsApp = async (telefone, mensagem, config) => {
  if (!config?.whatsapp?.phoneNumberId || !config?.whatsapp?.accessToken) {
    throw new Error('WhatsApp não configurado');
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${config.whatsapp.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.whatsapp.accessToken}`
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: telefone,
        type: 'text',
        text: {
          preview_url: false,
          body: mensagem
        }
      })
    });

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Erro ao enviar WhatsApp: ${error.message}`);
  }
};

// Simular envio por Email
const enviarEmail = async (email, assunto, mensagem, config) => {
  try {
    // Em produção, usar Resend, SendGrid, ou similar
    console.log(`📧 Email enviado para ${email}:`, { assunto, mensagem });
    
    return {
      success: true,
      email,
      messageId: `email_${Date.now()}`,
      status: 'enviado'
    };
  } catch (error) {
    throw new Error(`Erro ao enviar Email: ${error.message}`);
  }
};

// Simular envio por SMS
const enviarSMS = async (telefone, mensagem, config) => {
  try {
    // Em produção, usar Twilio, AWS SNS, ou similar
    console.log(`📱 SMS enviado para ${telefone}:`, { mensagem });
    
    return {
      success: true,
      telefone,
      messageId: `sms_${Date.now()}`,
      status: 'enviado'
    };
  } catch (error) {
    throw new Error(`Erro ao enviar SMS: ${error.message}`);
  }
};

// Registrar log de envio
const registrarLog = (tipo, destinatarios, canal, status, resultado) => {
  const logFile = path.join(process.cwd(), 'logs', 'disparos.log');
  const logDir = path.dirname(logFile);

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const log = {
    timestamp: new Date().toISOString(),
    tipo,
    destinatarios: destinatarios.length,
    canal,
    status,
    resultado: resultado.map(r => ({ ...r, erro: r.erro || null }))
  };

  fs.appendFileSync(logFile, JSON.stringify(log) + '\n');
  return log;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido' });
  }

  try {
    const { tipo, destinatarios, mensagem, assunto, canais } = req.body;

    // Validações
    if (!tipo || !['todos', 'liderancas', 'operadores'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de destinatário inválido'
      });
    }

    if (!mensagem || mensagem.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Mensagem não pode estar vazia'
      });
    }

    if (!canais || canais.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selecione pelo menos um canal'
      });
    }

    // Obter destinatários
    const listaDestinatarios = usuariosDB[tipo] || [];

    if (listaDestinatarios.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum destinatário encontrado'
      });
    }

    // Carregar configuração
    const config = carregarConfigacao();

    // Enviar por cada canal
    const resultados = [];
    const configWhatsApp = config;

    for (const destinatario of listaDestinatarios) {
      for (const canal of canais) {
        try {
          let resultado;

          if (canal === 'whatsapp') {
            if (!destinatario.telefone) {
              resultados.push({
                canal: 'whatsapp',
                destinatario: destinatario.nome,
                status: 'erro',
                erro: 'Telefone não disponível'
              });
              continue;
            }
            resultado = await enviarWhatsApp(destinatario.telefone, mensagem, configWhatsApp);
            resultados.push({
              canal: 'whatsapp',
              destinatario: destinatario.nome,
              contato: destinatario.telefone,
              status: 'enviado',
              messageId: resultado.messages?.[0]?.id || `wpp_${Date.now()}`
            });
          } 
          else if (canal === 'email') {
            if (!destinatario.email) {
              resultados.push({
                canal: 'email',
                destinatario: destinatario.nome,
                status: 'erro',
                erro: 'Email não disponível'
              });
              continue;
            }
            resultado = await enviarEmail(
              destinatario.email,
              assunto || 'MandatoPro - Comunicado',
              mensagem,
              configWhatsApp
            );
            resultados.push({
              canal: 'email',
              destinatario: destinatario.nome,
              contato: destinatario.email,
              status: 'enviado',
              messageId: resultado.messageId
            });
          } 
          else if (canal === 'sms') {
            if (!destinatario.telefone) {
              resultados.push({
                canal: 'sms',
                destinatario: destinatario.nome,
                status: 'erro',
                erro: 'Telefone não disponível'
              });
              continue;
            }
            resultado = await enviarSMS(destinatario.telefone, mensagem, configWhatsApp);
            resultados.push({
              canal: 'sms',
              destinatario: destinatario.nome,
              contato: destinatario.telefone,
              status: 'enviado',
              messageId: resultado.messageId
            });
          }
        } catch (error) {
          resultados.push({
            canal,
            destinatario: destinatario.nome,
            status: 'erro',
            erro: error.message
          });
        }
      }
    }

    // Contar sucessos e erros
    const sucessos = resultados.filter(r => r.status === 'enviado').length;
    const erros = resultados.filter(r => r.status === 'erro').length;

    // Registrar log
    const log = registrarLog(tipo, listaDestinatarios, canais.join(', '), sucessos > 0 ? 'sucesso' : 'erro', resultados);

    res.status(200).json({
      success: sucessos > 0,
      mensagem: `${sucessos} mensagens enviadas, ${erros} erros`,
      resumo: {
        total: resultados.length,
        sucessos,
        erros,
        destinatarios: listaDestinatarios.length,
        canais: canais,
        tipo
      },
      resultados,
      log
    });

  } catch (error) {
    console.error('Erro na API de disparo em massa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao processar disparo em massa',
      error: error.message
    });
  }
}
