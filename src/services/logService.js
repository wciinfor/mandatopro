/**
 * Serviço de Logs - Registra todas as atividades dos usuários
 * Tipos de eventos:
 * - LOGIN: Login/Logout de usuários
 * - CADASTRO: Criação de novos registros
 * - EDICAO: Edição de registros existentes
 * - DELECAO: Exclusão de registros
 * - RELATORIO: Geração de relatórios
 * - EXPORTACAO: Exportação de dados
 * - ACESSO: Acesso a páginas/módulos
 * - ERRO: Erros do sistema
 */

export const tiposEvento = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CADASTRO: 'CADASTRO',
  EDICAO: 'EDICAO',
  DELECAO: 'DELECAO',
  RELATORIO: 'RELATORIO',
  EXPORTACAO: 'EXPORTACAO',
  ACESSO: 'ACESSO',
  ERRO: 'ERRO',
  CONFIGURACAO: 'CONFIGURACAO'
};

export const registrarLog = async (evento) => {
  try {
    const response = await fetch('/api/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(evento)
    });

    if (!response.ok) {
      console.error('Erro ao registrar log:', response.statusText);
    }
    return response.ok;
  } catch (error) {
    console.error('Erro ao registrar log:', error);
    return false;
  }
};

/**
 * Cria um objeto de evento padronizado
 * @param {string} tipoEvento - Tipo do evento (LOGIN, CADASTRO, etc)
 * @param {string} modulo - Módulo onde o evento ocorreu (eleitores, liderancas, etc)
 * @param {string} descricao - Descrição da ação realizada
 * @param {object} usuario - Objeto do usuário (id, nome, email, nivel)
 * @param {object} dados - Dados adicionais (IDs afetados, valores antigos/novos, etc)
 * @param {string} status - Status da operação (SUCESSO, ERRO)
 * @returns {object} Objeto de evento formatado
 */
export const criarEvento = (tipoEvento, modulo, descricao, usuario, dados = {}, status = 'SUCESSO') => {
  return {
    tipoEvento,
    modulo,
    descricao,
    status,
    usuarioId: usuario?.id,
    usuarioNome: usuario?.nome,
    usuarioEmail: usuario?.email,
    usuarioNivel: usuario?.nivel,
    enderecoBrowser: typeof window !== 'undefined' ? window.location.href : null,
    agenteBrowser: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    enderecoIP: 'client', // Será obtido pelo servidor
    dados,
    timestamp: new Date().toISOString(),
    dataLocal: new Date().toLocaleString('pt-BR')
  };
};

/**
 * Registra login de usuário
 */
export const registrarLogin = async (usuario) => {
  const evento = criarEvento(
    tiposEvento.LOGIN,
    'AUTENTICACAO',
    `Login realizado por ${usuario.nome}`,
    usuario,
    { email: usuario.email }
  );
  return registrarLog(evento);
};

/**
 * Registra logout de usuário
 */
export const registrarLogout = async (usuario) => {
  const evento = criarEvento(
    tiposEvento.LOGOUT,
    'AUTENTICACAO',
    `Logout realizado por ${usuario.nome}`,
    usuario
  );
  return registrarLog(evento);
};

/**
 * Registra criação de registro
 */
export const registrarCadastro = async (usuario, modulo, entidade, id, dados) => {
  const evento = criarEvento(
    tiposEvento.CADASTRO,
    modulo,
    `${entidade} cadastrada(o) com sucesso`,
    usuario,
    { 
      entidadeId: id,
      entidade,
      ...dados 
    }
  );
  return registrarLog(evento);
};

/**
 * Registra edição de registro
 */
export const registrarEdicao = async (usuario, modulo, entidade, id, dadosAntigos, dadosNovos) => {
  const evento = criarEvento(
    tiposEvento.EDICAO,
    modulo,
    `${entidade} editada(o) com sucesso`,
    usuario,
    {
      entidadeId: id,
      entidade,
      mudancas: {
        antes: dadosAntigos,
        depois: dadosNovos
      }
    }
  );
  return registrarLog(evento);
};

/**
 * Registra exclusão de registro
 */
export const registrarDelecao = async (usuario, modulo, entidade, id, dadosExcluidos) => {
  const evento = criarEvento(
    tiposEvento.DELECAO,
    modulo,
    `${entidade} excluída(o) com sucesso`,
    usuario,
    {
      entidadeId: id,
      entidade,
      dadosExcluidos
    }
  );
  return registrarLog(evento);
};

/**
 * Registra geração de relatório
 */
export const registrarRelatorio = async (usuario, modulo, nomeRelatorio, filtros = {}) => {
  const evento = criarEvento(
    tiposEvento.RELATORIO,
    modulo,
    `Relatório "${nomeRelatorio}" gerado com sucesso`,
    usuario,
    {
      nomeRelatorio,
      filtros
    }
  );
  return registrarLog(evento);
};

/**
 * Registra exportação de dados
 */
export const registrarExportacao = async (usuario, modulo, formato, quantidade) => {
  const evento = criarEvento(
    tiposEvento.EXPORTACAO,
    modulo,
    `Dados exportados em formato ${formato} (${quantidade} registros)`,
    usuario,
    {
      formato,
      quantidade
    }
  );
  return registrarLog(evento);
};

/**
 * Registra acesso a módulo/página
 */
export const registrarAcesso = async (usuario, modulo, pagina) => {
  const evento = criarEvento(
    tiposEvento.ACESSO,
    modulo,
    `Acesso a ${pagina}`,
    usuario,
    { pagina }
  );
  return registrarLog(evento);
};

/**
 * Registra erro do sistema
 */
export const registrarErro = async (usuario, modulo, descricao, erro) => {
  const evento = criarEvento(
    tiposEvento.ERRO,
    modulo,
    `Erro: ${descricao}`,
    usuario,
    {
      mensagem: erro?.message,
      stack: erro?.stack
    },
    'ERRO'
  );
  return registrarLog(evento);
};

/**
 * Registra alteração de configurações
 */
export const registrarConfiguracao = async (usuario, descricao, configAnterior, configNova) => {
  const evento = criarEvento(
    tiposEvento.CONFIGURACAO,
    'SISTEMA',
    `Configuração alterada: ${descricao}`,
    usuario,
    {
      antes: configAnterior,
      depois: configNova
    }
  );
  return registrarLog(evento);
};
