import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'data', 'logs');
const logsFile = path.join(logsDir, 'logs.json');

// Garante que o diretório de logs existe
const garantirDiretorio = () => {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
};

// Carrega todos os logs do arquivo
const carregarLogs = () => {
  garantirDiretorio();
  
  if (!fs.existsSync(logsFile)) {
    return [];
  }

  try {
    const conteudo = fs.readFileSync(logsFile, 'utf8');
    return JSON.parse(conteudo);
  } catch (error) {
    console.error('Erro ao carregar logs:', error);
    return [];
  }
};

// Salva logs no arquivo
const salvarLogs = (logs) => {
  garantirDiretorio();

  try {
    fs.writeFileSync(logsFile, JSON.stringify(logs, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Erro ao salvar logs:', error);
    return false;
  }
};

// Obtém o IP do cliente
const obterIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.socket.remoteAddress ||
         'desconhecido';
};

export default function handler(req, res) {
  // Para GET e DELETE, verifica se é admin
  if (req.method === 'GET' || req.method === 'DELETE') {
    try {
      const usuarioHeader = req.headers['usuario'];
      let usuario = {};
      
      if (usuarioHeader) {
        usuario = JSON.parse(usuarioHeader);
      }
      
      if (!usuario?.nivel || usuario.nivel !== 'ADMINISTRADOR') {
        return res.status(403).json({ 
          erro: 'Acesso negado. Apenas administradores podem acessar logs.' 
        });
      }
    } catch (e) {
      return res.status(403).json({ 
        erro: 'Erro ao validar permissões' 
      });
    }
  }

  if (req.method === 'POST') {
    // Registra novo log
    try {
      const logs = carregarLogs();
      
      const novoLog = {
        id: Date.now().toString(),
        ...req.body,
        enderecoIP: obterIP(req),
        dataRegistro: new Date().toISOString()
      };

      logs.push(novoLog);

      // Mantém apenas os últimos 50.000 logs para não sobrecarregar
      if (logs.length > 50000) {
        logs.splice(0, logs.length - 50000);
      }

      salvarLogs(logs);

      return res.status(201).json({ 
        sucesso: true,
        id: novoLog.id
      });
    } catch (error) {
      console.error('Erro ao registrar log:', error);
      return res.status(500).json({ 
        erro: 'Erro ao registrar log',
        detalhes: error.message 
      });
    }
  }

  if (req.method === 'GET') {
    // Retorna logs com filtros (admin only)
    try {
      const logs = carregarLogs();
      
      // Se nenhum log, retorna array vazio
      if (!Array.isArray(logs) || logs.length === 0) {
        return res.status(200).json({
          sucesso: true,
          logs: [],
          paginacao: {
            pagina: 1,
            limite: 50,
            total: 0,
            totalPaginas: 0
          }
        });
      }
      
      let logsFiltrados = logs;

      // Filtrar por tipo de evento
      if (req.query.tipoEvento) {
        logsFiltrados = logsFiltrados.filter(
          log => log.tipoEvento === req.query.tipoEvento
        );
      }

      // Filtrar por módulo
      if (req.query.modulo) {
        logsFiltrados = logsFiltrados.filter(
          log => log.modulo === req.query.modulo
        );
      }

      // Filtrar por usuário
      if (req.query.usuarioId) {
        logsFiltrados = logsFiltrados.filter(
          log => log.usuarioId === req.query.usuarioId
        );
      }

      // Filtrar por status
      if (req.query.status) {
        logsFiltrados = logsFiltrados.filter(
          log => log.status === req.query.status
        );
      }

      // Filtrar por data (dataInicio e dataFim em ISO format)
      if (req.query.dataInicio || req.query.dataFim) {
        const dataInicio = req.query.dataInicio ? new Date(req.query.dataInicio) : new Date(0);
        const dataFim = req.query.dataFim ? new Date(req.query.dataFim) : new Date();

        logsFiltrados = logsFiltrados.filter(log => {
          const dataLog = new Date(log.timestamp);
          return dataLog >= dataInicio && dataLog <= dataFim;
        });
      }

      // Busca por texto (descrição)
      if (req.query.busca) {
        const busca = req.query.busca.toLowerCase();
        logsFiltrados = logsFiltrados.filter(log => {
          const descricao = (log.descricao || '').toLowerCase();
          const nome = (log.usuarioNome || '').toLowerCase();
          const email = (log.usuarioEmail || '').toLowerCase();
          return descricao.includes(busca) || nome.includes(busca) || email.includes(busca);
        });
      }

      // Ordenação (mais recentes primeiro)
      logsFiltrados.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Paginação
      const pagina = parseInt(req.query.pagina) || 1;
      const limite = parseInt(req.query.limite) || 50;
      const inicio = (pagina - 1) * limite;
      const fim = inicio + limite;

      const total = logsFiltrados.length;
      const logsPaginados = logsFiltrados.slice(inicio, fim);

      return res.status(200).json({
        sucesso: true,
        logs: logsPaginados,
        paginacao: {
          pagina,
          limite,
          total,
          totalPaginas: Math.ceil(total / limite)
        }
      });
    } catch (error) {
      console.error('Erro ao recuperar logs:', error);
      return res.status(500).json({
        erro: 'Erro ao recuperar logs',
        detalhes: error.message
      });
    }
  }

  // Método DELETE para limpar logs antigos (apenas admin)
  if (req.method === 'DELETE') {
    try {
      const logs = carregarLogs();
      
      // Se diasRetencao informado, remove logs mais antigos
      if (req.query.diasRetencao) {
        const diasRetencao = parseInt(req.query.diasRetencao);
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - diasRetencao);

        const logsAntigos = logs.filter(log => new Date(log.timestamp) < dataLimite);
        const logsNovos = logs.filter(log => new Date(log.timestamp) >= dataLimite);

        salvarLogs(logsNovos);

        return res.status(200).json({
          sucesso: true,
          removidos: logsAntigos.length,
          restantes: logsNovos.length,
          mensagem: `${logsAntigos.length} logs removidos (mais antigos que ${diasRetencao} dias)`
        });
      }

      return res.status(400).json({
        erro: 'Parâmetro diasRetencao obrigatório'
      });
    } catch (error) {
      console.error('Erro ao deletar logs:', error);
      return res.status(500).json({
        erro: 'Erro ao deletar logs',
        detalhes: error.message
      });
    }
  }

  res.status(405).json({ erro: 'Método não permitido' });
}
