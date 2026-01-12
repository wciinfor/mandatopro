// Sistema de Permissões e Controle de Acesso

// Níveis de acesso
export const ROLES = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  LIDERANCA: 'LIDERANCA',
  OPERADOR: 'OPERADOR'
};

// Descrições dos níveis
export const ROLE_DESCRIPTIONS = {
  ADMINISTRADOR: 'Acesso total à plataforma',
  LIDERANCA: 'Acesso às equipes/áreas sob sua administração',
  OPERADOR: 'Apenas cadastro e visualização dos próprios registros'
};

// Módulos do sistema
export const MODULES = {
  DASHBOARD: 'dashboard',
  FUNCIONARIOS: 'funcionarios',
  CADASTROS: 'cadastros',
  EMENDAS: 'emendas',
  FINANCEIRO: 'financeiro',
  GEOLOCALIZACAO: 'geolocalizacao',
  COMUNICACAO: 'comunicacao',
  AGENDA: 'agenda',
  ANIVERSARIANTES: 'aniversariantes',
  DOCUMENTOS: 'documentos',
  SOLICITACOES: 'solicitacoes',
  USUARIOS: 'usuarios',
  JURIDICO: 'juridico',
  DISPARO_MENSAGENS: 'disparo_mensagens'
};

// Permissões por módulo
export const MODULE_PERMISSIONS = {
  [MODULES.DASHBOARD]: {
    [ROLES.ADMINISTRADOR]: { view: true, create: true, edit: true, delete: true, viewAll: true },
    [ROLES.LIDERANCA]: { view: true, create: false, edit: false, delete: false, viewAll: false },
    [ROLES.OPERADOR]: { view: true, create: false, edit: false, delete: false, viewAll: false }
  },
  [MODULES.FUNCIONARIOS]: {
    [ROLES.ADMINISTRADOR]: { view: true, create: true, edit: true, delete: true, viewAll: true },
    [ROLES.LIDERANCA]: { view: true, create: true, edit: true, delete: false, viewAll: false },
    [ROLES.OPERADOR]: { view: false, create: false, edit: false, delete: false, viewAll: false }
  },
  [MODULES.CADASTROS]: {
    [ROLES.ADMINISTRADOR]: { view: true, create: true, edit: true, delete: true, viewAll: true, editSensitive: true },
    [ROLES.LIDERANCA]: { view: true, create: true, edit: true, delete: false, viewAll: false, editSensitive: false },
    [ROLES.OPERADOR]: { view: true, create: true, edit: true, delete: false, viewAll: false, editSensitive: false }
  },
  [MODULES.EMENDAS]: {
    [ROLES.ADMINISTRADOR]: { view: true, create: true, edit: true, delete: true, viewAll: true },
    [ROLES.LIDERANCA]: { view: false, create: false, edit: false, delete: false, viewAll: false },
    [ROLES.OPERADOR]: { view: false, create: false, edit: false, delete: false, viewAll: false }
  },
  [MODULES.FINANCEIRO]: {
    [ROLES.ADMINISTRADOR]: { view: true, create: true, edit: true, delete: true, viewAll: true },
    [ROLES.LIDERANCA]: { view: false, create: false, edit: false, delete: false, viewAll: false },
    [ROLES.OPERADOR]: { view: false, create: false, edit: false, delete: false, viewAll: false }
  },
  [MODULES.GEOLOCALIZACAO]: {
    [ROLES.ADMINISTRADOR]: { view: true, create: true, edit: true, delete: true, viewAll: true },
    [ROLES.LIDERANCA]: { view: true, create: false, edit: false, delete: false, viewAll: false },
    [ROLES.OPERADOR]: { view: true, create: false, edit: false, delete: false, viewAll: false }
  },
  [MODULES.COMUNICACAO]: {
    [ROLES.ADMINISTRADOR]: { view: true, create: true, edit: true, delete: true, viewAll: true, sendMass: true },
    [ROLES.LIDERANCA]: { view: true, create: true, edit: true, delete: false, viewAll: false, sendMass: false },
    [ROLES.OPERADOR]: { view: true, create: true, edit: false, delete: false, viewAll: false, sendMass: false }
  },
  [MODULES.AGENDA]: {
    [ROLES.ADMINISTRADOR]: { view: true, create: true, edit: true, delete: true, viewAll: true },
    [ROLES.LIDERANCA]: { view: true, create: true, edit: true, delete: false, viewAll: false },
    [ROLES.OPERADOR]: { view: true, create: true, edit: true, delete: false, viewAll: false }
  },
  [MODULES.ANIVERSARIANTES]: {
    [ROLES.ADMINISTRADOR]: { view: true, create: false, edit: false, delete: false, viewAll: true },
    [ROLES.LIDERANCA]: { view: true, create: false, edit: false, delete: false, viewAll: false },
    [ROLES.OPERADOR]: { view: true, create: false, edit: false, delete: false, viewAll: false }
  },
  [MODULES.DOCUMENTOS]: {
    [ROLES.ADMINISTRADOR]: { view: true, create: true, edit: true, delete: true, viewAll: true },
    [ROLES.LIDERANCA]: { view: true, create: true, edit: true, delete: false, viewAll: false },
    [ROLES.OPERADOR]: { view: true, create: false, edit: false, delete: false, viewAll: false }
  },
  [MODULES.SOLICITACOES]: {
    [ROLES.ADMINISTRADOR]: { view: true, create: true, edit: true, delete: true, viewAll: true },
    [ROLES.LIDERANCA]: { view: true, create: true, edit: true, delete: false, viewAll: false },
    [ROLES.OPERADOR]: { view: true, create: true, edit: false, delete: false, viewAll: false }
  },
  [MODULES.USUARIOS]: {
    [ROLES.ADMINISTRADOR]: { view: true, create: true, edit: true, delete: true, viewAll: true },
    [ROLES.LIDERANCA]: { view: false, create: false, edit: false, delete: false, viewAll: false },
    [ROLES.OPERADOR]: { view: false, create: false, edit: false, delete: false, viewAll: false }
  },
  [MODULES.JURIDICO]: {
    [ROLES.ADMINISTRADOR]: { view: true, create: true, edit: true, delete: true, viewAll: true },
    [ROLES.LIDERANCA]: { view: false, create: false, edit: false, delete: false, viewAll: false },
    [ROLES.OPERADOR]: { view: false, create: false, edit: false, delete: false, viewAll: false }
  },
  [MODULES.DISPARO_MENSAGENS]: {
    [ROLES.ADMINISTRADOR]: { view: true, create: true, edit: true, delete: true, viewAll: true },
    [ROLES.LIDERANCA]: { view: true, create: true, edit: false, delete: false, viewAll: false },
    [ROLES.OPERADOR]: { view: false, create: false, edit: false, delete: false, viewAll: false }
  }
};

/**
 * Verifica se o usuário tem permissão para acessar um módulo
 */
export function hasModuleAccess(userRole, module) {
  if (!userRole || !module) return false;
  const permissions = MODULE_PERMISSIONS[module]?.[userRole];
  return permissions?.view || false;
}

/**
 * Verifica se o usuário tem permissão específica em um módulo
 */
export function hasPermission(userRole, module, action) {
  if (!userRole || !module || !action) return false;
  const permissions = MODULE_PERMISSIONS[module]?.[userRole];
  return permissions?.[action] || false;
}

/**
 * Verifica se o usuário pode visualizar todos os registros
 */
export function canViewAll(userRole, module) {
  return hasPermission(userRole, module, 'viewAll');
}

/**
 * Verifica se o usuário pode criar registros
 */
export function canCreate(userRole, module) {
  return hasPermission(userRole, module, 'create');
}

/**
 * Verifica se o usuário pode editar registros
 */
export function canEdit(userRole, module) {
  return hasPermission(userRole, module, 'edit');
}

/**
 * Verifica se o usuário pode deletar registros
 */
export function canDelete(userRole, module) {
  return hasPermission(userRole, module, 'delete');
}

/**
 * Verifica se o usuário pode editar dados sensíveis
 * Apenas Admin pode editar dados sensíveis em cadastros
 */
export function canEditSensitive(userRole, module) {
  return hasPermission(userRole, module, 'editSensitive');
}

/**
 * Filtra registros baseado no papel do usuário
 * @param {Array} records - Lista de registros
 * @param {string} userRole - Papel do usuário
 * @param {number} userId - ID do usuário atual
 * @param {number} userLiderancaId - ID da liderança do usuário (se aplicável)
 * @param {string} module - Módulo atual
 */
export function filterRecordsByRole(records, userRole, userId, userLiderancaId, module) {
  if (canViewAll(userRole, module)) {
    return records; // Admin vê tudo
  }

  if (userRole === ROLES.LIDERANCA) {
    // Liderança vê apenas seus registros e de sua equipe
    return records.filter(record => {
      return record.criadoPor === userId || 
             record.liderancaId === userId ||
             record.liderancaId === userLiderancaId;
    });
  }

  if (userRole === ROLES.OPERADOR) {
    // Operador vê apenas seus próprios registros
    return records.filter(record => record.criadoPor === userId);
  }

  return [];
}

/**
 * Retorna mensagem de acesso negado
 */
export function getAccessDeniedMessage(userRole, action = 'acessar') {
  const roleNames = {
    [ROLES.ADMINISTRADOR]: 'Administrador',
    [ROLES.LIDERANCA]: 'Liderança',
    [ROLES.OPERADOR]: 'Operador'
  };

  return `Seu perfil (${roleNames[userRole]}) não tem permissão para ${action} este recurso.`;
}

/**
 * Verifica se o usuário é administrador
 */
export function isAdmin(userRole) {
  return userRole === ROLES.ADMINISTRADOR;
}

/**
 * Verifica se o usuário é liderança
 */
export function isLideranca(userRole) {
  return userRole === ROLES.LIDERANCA;
}

/**
 * Verifica se o usuário é operador
 */
export function isOperador(userRole) {
  return userRole === ROLES.OPERADOR;
}

/**
 * Valida se o usuário pode deletar um registro específico
 * REGRA: Apenas Admin pode deletar. Liderança e Operador NÃO podem deletar.
 */
export function canDeleteRecord(userRole) {
  return userRole === ROLES.ADMINISTRADOR;
}

/**
 * Lista de campos sensíveis que apenas Admin pode editar
 */
export const SENSITIVE_FIELDS = {
  eleitores: ['cpf', 'rg', 'tituloEleitor', 'dataNascimento'],
  liderancas: ['cpf', 'rg', 'dataNascimento'],
  funcionarios: ['cpf', 'rg', 'dataNascimento', 'salario'],
  atendimentos: ['status', 'prioridade']
};

/**
 * Verifica se um campo é sensível
 */
export function isSensitiveField(module, fieldName) {
  const moduleKey = module.toLowerCase();
  return SENSITIVE_FIELDS[moduleKey]?.includes(fieldName) || false;
}

/**
 * Retorna cor do badge baseado no papel
 */
export function getRoleColor(role) {
  const colors = {
    [ROLES.ADMINISTRADOR]: 'bg-red-100 text-red-800',
    [ROLES.LIDERANCA]: 'bg-purple-100 text-purple-800',
    [ROLES.OPERADOR]: 'bg-blue-100 text-blue-800'
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
}

/**
 * Retorna ícone baseado no papel
 */
export function getRoleIcon(role) {
  const icons = {
    [ROLES.ADMINISTRADOR]: 'faCrown',
    [ROLES.LIDERANCA]: 'faUserTie',
    [ROLES.OPERADOR]: 'faUser'
  };
  return icons[role] || 'faUser';
}
