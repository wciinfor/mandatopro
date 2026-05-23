// Dados simulados dos módulos - em produção viriam do banco de dados

// CADASTROS
export const eleitores = [
  {
    id: 1,
    nome: 'João Silva Santos',
    titulo: '1234.5678.9012',
    zona: '001',
    secao: '0123',
    telefone: '(91) 98765-4321',
    email: 'joao@email.com',
    endereco: 'Rua A, 123',
    bairro: 'Centro',
    cidade: 'Belém',
    dataNascimento: '1985-12-20',
    foto: null,
    status: 'ATIVO'
  },
  {
    id: 2,
    nome: 'Maria Costa Lima',
    titulo: '9876.5432.1098',
    zona: '002',
    secao: '0456',
    telefone: '(91) 91234-5678',
    email: 'maria@email.com',
    endereco: 'Av. B, 456',
    bairro: 'Batista Campos',
    cidade: 'Belém',
    dataNascimento: '1990-11-22',
    foto: null,
    status: 'ATIVO'
  }
];

export const liderancas = [
  {
    id: 1,
    nome: 'Carlos Oliveira',
    telefone: '(91) 99876-5432',
    email: 'carlos@email.com',
    bairro: 'Pedreira',
    cidade: 'Belém',
    redeSocial: '@carlosoliv',
    influencia: 'ALTA',
    dataNascimento: '1978-11-25',
    foto: null,
    status: 'ATIVO'
  },
  {
    id: 2,
    nome: 'Ana Paula Santos',
    telefone: '(91) 98765-1234',
    email: 'ana@email.com',
    bairro: 'Marco',
    cidade: 'Belém',
    redeSocial: '@anapaula',
    influencia: 'MÉDIA',
    dataNascimento: '1982-11-27',
    foto: null,
    status: 'ATIVO'
  }
];

export const funcionarios = [
  {
    id: 1,
    nome: 'Pedro Alves',
    cargo: 'Assessor',
    telefone: '(91) 91111-2222',
    email: 'pedro@gabinete.gov.br',
    dataNascimento: '1988-11-24',
    foto: null,
    status: 'ATIVO'
  },
  {
    id: 2,
    nome: 'Julia Fernandes',
    cargo: 'Secretária',
    telefone: '(91) 93333-4444',
    email: 'julia@gabinete.gov.br',
    dataNascimento: '1995-11-21',
    foto: null,
    status: 'ATIVO'
  }
];

export const atendimentos = [
  {
    id: 1,
    eleitor: 'João Silva Santos',
    data: '2024-11-15',
    tipo: 'Solicitação',
    assunto: 'Pedido de consulta médica',
    status: 'PENDENTE'
  },
  {
    id: 2,
    eleitor: 'Maria Costa Lima',
    data: '2024-11-16',
    tipo: 'Reclamação',
    assunto: 'Problemas com iluminação pública',
    status: 'EM_ANDAMENTO'
  },
  {
    id: 3,
    eleitor: 'Carlos Oliveira',
    data: '2024-11-17',
    tipo: 'Agradecimento',
    assunto: 'Obra concluída no bairro',
    status: 'CONCLUIDO'
  }
];

// EMENDAS
export const orgaos = [
  {
    id: 1,
    codigo: 1,
    nome: 'SECRETARIA MUNICIPAL DE SAÚDE',
    tipo: 'MUNICIPAL',
    cnpj: '12.345.678/0001-90',
    endereco: 'Av. Principal, 1000',
    municipio: 'Belém',
    uf: 'PA',
    telefone: '(91) 3333-4444',
    email: 'saude@prefeitura.gov.br',
    responsavel: 'Dr. João Silva',
    contato: '(91) 99999-8888',
    observacoes: 'Órgão principal para emendas de saúde',
    status: 'ATIVO'
  },
  {
    id: 2,
    codigo: 2,
    nome: 'SECRETARIA ESTADUAL DE EDUCAÇÃO',
    tipo: 'ESTADUAL',
    cnpj: '98.765.432/0001-10',
    endereco: 'Rua das Flores, 500',
    municipio: 'Belém',
    uf: 'PA',
    telefone: '(91) 3322-1100',
    email: 'educacao@seduc.pa.gov.br',
    responsavel: 'Profª Maria Santos',
    contato: '(91) 98888-7777',
    observacoes: 'Emendas para educação estadual',
    status: 'ATIVO'
  }
];

export const responsaveis = [
  {
    id: 1,
    codigo: 1,
    nome: 'Dr. João Silva',
    cargo: 'Secretário de Saúde',
    orgao: 'SECRETARIA MUNICIPAL DE SAÚDE',
    cpf: '123.456.789-00',
    telefone: '(91) 99999-8888',
    email: 'joao.silva@prefeitura.gov.br',
    whatsapp: '(91) 99999-8888',
    observacoes: 'Responsável principal pelas emendas de saúde',
    status: 'ATIVO'
  },
  {
    id: 2,
    codigo: 2,
    nome: 'Profª Maria Santos',
    cargo: 'Secretária de Educação',
    orgao: 'SECRETARIA ESTADUAL DE EDUCAÇÃO',
    cpf: '987.654.321-00',
    telefone: '(91) 98888-7777',
    email: 'maria.santos@seduc.pa.gov.br',
    whatsapp: '(91) 98888-7777',
    observacoes: 'Coordena projetos educacionais',
    status: 'ATIVO'
  },
  {
    id: 3,
    codigo: 3,
    nome: 'Eng. Carlos Oliveira',
    cargo: 'Diretor de Infraestrutura',
    orgao: 'SECRETARIA MUNICIPAL DE OBRAS',
    cpf: '456.789.123-00',
    telefone: '(91) 97777-6666',
    email: 'carlos.oliveira@obras.gov.br',
    whatsapp: '(91) 97777-6666',
    observacoes: 'Responsável por emendas de infraestrutura',
    status: 'ATIVO'
  }
];

export const emendas = [
  {
    id: 1,
    codigo: 'EMD-2024-001',
    numero: '001/2024',
    tipo: 'INDIVIDUAL',
    autor: 'Deputado José Santos',
    orgao: 'SECRETARIA MUNICIPAL DE SAÚDE',
    responsavel: 'Dr. João Silva',
    finalidade: 'Aquisição de equipamentos médicos',
    valorEmpenhado: 500000.00,
    valorExecutado: 350000.00,
    dataEmpenho: '2024-01-15',
    dataVencimento: '2024-12-31',
    status: 'EM_EXECUCAO',
    observacoes: 'Equipamentos em processo de licitação'
  },
  {
    id: 2,
    codigo: 'EMD-2024-002',
    numero: '002/2024',
    tipo: 'BANCADA',
    autor: 'Bancada Federal do Pará',
    orgao: 'SECRETARIA ESTADUAL DE EDUCAÇÃO',
    responsavel: 'Profª Maria Santos',
    finalidade: 'Construção de escola técnica',
    valorEmpenhado: 2000000.00,
    valorExecutado: 2000000.00,
    dataEmpenho: '2024-02-20',
    dataVencimento: '2024-11-30',
    status: 'EXECUTADA',
    observacoes: 'Obra concluída e inaugurada'
  },
  {
    id: 3,
    codigo: 'EMD-2024-003',
    numero: '003/2024',
    tipo: 'COMISSAO',
    autor: 'Comissão de Infraestrutura',
    orgao: 'SECRETARIA MUNICIPAL DE OBRAS',
    responsavel: 'Eng. Carlos Oliveira',
    finalidade: 'Pavimentação de vias urbanas',
    valorEmpenhado: 1500000.00,
    valorExecutado: 0.00,
    dataEmpenho: '2024-03-10',
    dataVencimento: '2024-12-31',
    status: 'PENDENTE',
    observacoes: 'Aguardando liberação de recursos'
  }
];

export const repasses = [
  {
    id: 1,
    codigo: 'REP-2024-001',
    emenda: 'EMD-2024-001 - 001/2024',
    parcela: 1,
    totalParcelas: 3,
    valor: 150000.00,
    dataPrevista: '2024-05-15',
    dataEfetivada: '2024-05-10',
    orgao: 'SECRETARIA MUNICIPAL DE SAÚDE',
    responsavel: 'Dr. João Silva',
    status: 'EFETIVADO',
    observacoes: 'Primeira parcela da emenda'
  },
  {
    id: 2,
    codigo: 'REP-2024-002',
    emenda: 'EMD-2024-001 - 001/2024',
    parcela: 2,
    totalParcelas: 3,
    valor: 150000.00,
    dataPrevista: '2024-08-15',
    dataEfetivada: '2024-08-12',
    orgao: 'SECRETARIA MUNICIPAL DE SAÚDE',
    responsavel: 'Dr. João Silva',
    status: 'EFETIVADO',
    observacoes: 'Segunda parcela da emenda'
  },
  {
    id: 3,
    codigo: 'REP-2024-003',
    emenda: 'EMD-2024-001 - 001/2024',
    parcela: 3,
    totalParcelas: 3,
    valor: 200000.00,
    dataPrevista: '2024-11-30',
    dataEfetivada: null,
    orgao: 'SECRETARIA MUNICIPAL DE SAÚDE',
    responsavel: 'Dr. João Silva',
    status: 'PENDENTE',
    observacoes: 'Última parcela - aguardando liberação'
  },
  {
    id: 4,
    codigo: 'REP-2024-004',
    emenda: 'EMD-2024-002 - 002/2024',
    parcela: 1,
    totalParcelas: 1,
    valor: 2000000.00,
    dataPrevista: '2024-03-01',
    dataEfetivada: '2024-02-28',
    orgao: 'SECRETARIA ESTADUAL DE EDUCAÇÃO',
    responsavel: 'Profª Maria Santos',
    status: 'EFETIVADO',
    observacoes: 'Repasse único - obra concluída'
  }
];

// Funções auxiliares para cálculos
export const getDashboardStats = () => {
  // Função para calcular próximos aniversariantes
  const getProximosAniversariantes = () => {
    const hoje = new Date();
    const todasPessoas = [
      ...eleitores.map(e => ({ ...e, tipo: 'eleitor', dataNascimento: e.dataNascimento })),
      ...liderancas.map(l => ({ ...l, tipo: 'lideranca', dataNascimento: l.dataNascimento })),
      ...funcionarios.map(f => ({ ...f, tipo: 'funcionario', dataNascimento: f.dataNascimento }))
    ];

    const pessoasComAniversario = todasPessoas
      .filter(p => p.dataNascimento)
      .map(pessoa => {
        const [ano, mes, dia] = pessoa.dataNascimento.split('-').map(Number);
        const aniversarioEsteAno = new Date(hoje.getFullYear(), mes - 1, dia);
        const aniversarioProximoAno = new Date(hoje.getFullYear() + 1, mes - 1, dia);
        
        const proximoAniversario = aniversarioEsteAno >= hoje ? aniversarioEsteAno : aniversarioProximoAno;
        const diasAte = Math.ceil((proximoAniversario - hoje) / (1000 * 60 * 60 * 24));
        const idade = hoje.getFullYear() - ano + (aniversarioEsteAno < hoje ? 1 : 0);
        
        return {
          ...pessoa,
          dia,
          mes,
          proximoAniversario,
          diasAte,
          idade
        };
      })
      .sort((a, b) => a.diasAte - b.diasAte);

    return pessoasComAniversario;
  };

  const proximosAniversariantes = getProximosAniversariantes();

  return {
    // Cadastros
    totalEleitores: eleitores.length,
    eleitoresAtivos: eleitores.filter(e => e.status === 'ATIVO').length,
    eleitoresInativos: eleitores.filter(e => e.status === 'INATIVO').length,
    
    totalLiderancas: liderancas.length,
    liderancasAtivas: liderancas.filter(l => l.status === 'ATIVO').length,
    
    totalFuncionarios: funcionarios.length,
    
    totalAtendimentos: atendimentos.length,
    atendimentosPendentes: atendimentos.filter(a => a.status === 'PENDENTE').length,
    atendimentosAndamento: atendimentos.filter(a => a.status === 'EM_ANDAMENTO').length,
    atendimentosConcluidos: atendimentos.filter(a => a.status === 'CONCLUIDO').length,
    
    // Emendas
    totalEmendas: emendas.length,
    emendasAtivas: emendas.filter(e => e.status === 'EM_EXECUCAO' || e.status === 'PENDENTE').length,
    emendasExecutadas: emendas.filter(e => e.status === 'EXECUTADA').length,
    emendasEmExecucao: emendas.filter(e => e.status === 'EM_EXECUCAO').length,
    emendasPendentes: emendas.filter(e => e.status === 'PENDENTE').length,
    
    valorTotalEmpenhado: emendas.reduce((acc, e) => acc + e.valorEmpenhado, 0),
    valorTotalExecutado: emendas.reduce((acc, e) => acc + e.valorExecutado, 0),
    
    totalRepasses: repasses.length,
    repassesEfetivados: repasses.filter(r => r.status === 'EFETIVADO').length,
    repassesPendentes: repasses.filter(r => r.status === 'PENDENTE').length,
    
    totalOrgaos: orgaos.length,
    totalResponsaveis: responsaveis.length,

    // Aniversariantes
    proximosAniversariantes: proximosAniversariantes,
    aniversariantesHoje: proximosAniversariantes.filter(p => p.diasAte === 0).length,
    aniversariantesSemana: proximosAniversariantes.filter(p => p.diasAte <= 7).length,
    aniversariantesMes: proximosAniversariantes.filter(p => p.diasAte <= 30).length
  };
};
