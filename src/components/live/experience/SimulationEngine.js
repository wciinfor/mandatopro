/**
 * SimulationEngine para o MandatoPRO Live Demo (UX Lab)
 * Gera eventos realistas continuos e simula cenarios completos sem banco de dados.
 */

export const CENARIOS_DEMO = {
  EXCELENTE: 'Mandato Excelente',
  CRESCIMENTO: 'Mandato em Crescimento',
  ATENCAO: 'Mandato em Atenção',
  CRITICO: 'Mandato Crítico',
  ANO_ELEITORAL: 'Ano Eleitoral',
  PRIMEIRO_DIA_CAMPANHA: 'Primeiro Dia de Campanha'
};

const MUNICIPIOS_PA = ['Belém', 'Ananindeua', 'Castanhal', 'Marabá', 'Santarém', 'Parauapebas', 'Barcarena', 'Altamira'];
const LIDERANCAS_DEMO = ['João Silva', 'Maria Oliveira', 'Carlos Santos', 'Ana Souza', 'Roberto Lima'];

export function gerarDadosCenario(cenario) {
  switch (cenario) {
    case CENARIOS_DEMO.CRITICO:
      return {
        statusGeral: {
          status: 'CRITICO',
          score: 35,
          cor: 'rose',
          resumoExecutivo: 'Existem gargalos operacionais críticos que exigem intervenção direta imediata.',
          fatoresPositivos: ['Sistema operando normalmente.'],
          fatoresNegativos: ['42 solicitações atrasadas há mais de 48h.', 'Queda de 38% nos cadastros.']
        },
        eleitoresMetricas: { totalEleitores: 3420, cadastrosHoje: 3, cadastrosSemana: 18, cadastrosMes: 95, variacaoPercentual: -38 },
        radar: { indiceTendencia: 32, distribuicao: { riscos: 4, oportunidades: 1, tendencias: 1 } }
      };

    case CENARIOS_DEMO.ATENCAO:
      return {
        statusGeral: {
          status: 'ATENCAO',
          score: 64,
          cor: 'yellow',
          resumoExecutivo: 'Situação do mandato exige atenção para pontos pontuais de produção.',
          fatoresPositivos: ['Atividade regular em Belém e Ananindeua.'],
          fatoresNegativos: ['5 lideranças sem cadastros nos últimos 15 dias.']
        },
        eleitoresMetricas: { totalEleitores: 8900, cadastrosHoje: 14, cadastrosSemana: 85, cadastrosMes: 410, variacaoPercentual: -5 },
        radar: { indiceTendencia: 62, distribuicao: { riscos: 2, oportunidades: 3, tendencias: 2 } }
      };

    case CENARIOS_DEMO.ANO_ELEITORAL:
    case CENARIOS_DEMO.PRIMEIRO_DIA_CAMPANHA:
    case CENARIOS_DEMO.CRESCIMENTO:
      return {
        statusGeral: {
          status: 'MUITO_BOM',
          score: 84,
          cor: 'blue',
          resumoExecutivo: 'Ritmo acelerado de crescimento em ano eleitoral com alta adesão.',
          fatoresPositivos: ['Crescimento constante (+28% no mês).', 'Todas as regiões ativas.'],
          fatoresNegativos: ['Aumento previsto de chamados no gabinete.']
        },
        eleitoresMetricas: { totalEleitores: 15400, cadastrosHoje: 62, cadastrosSemana: 380, cadastrosMes: 1850, variacaoPercentual: 28 },
        radar: { indiceTendencia: 85, distribuicao: { riscos: 1, oportunidades: 5, tendencias: 3 } }
      };

    case CENARIOS_DEMO.EXCELENTE:
    default:
      return {
        statusGeral: {
          status: 'EXCELENTE',
          score: 96,
          cor: 'emerald',
          resumoExecutivo: 'Mandato operando com máxima eficiência e engajamento recorde da base.',
          fatoresPositivos: ['Crescimento constante (+35%).', 'Lideranças 100% ativas.', 'Zero atrasos.'],
          fatoresNegativos: []
        },
        eleitoresMetricas: { totalEleitores: 24800, cadastrosHoje: 94, cadastrosSemana: 540, cadastrosMes: 2900, variacaoPercentual: 35 },
        radar: { indiceTendencia: 95, distribuicao: { riscos: 0, oportunidades: 6, tendencias: 3 } }
      };
  }
}

export function sortearEventoDemo() {
  const mun = MUNICIPIOS_PA[Math.floor(Math.random() * MUNICIPIOS_PA.length)];
  const lid = LIDERANCAS_DEMO[Math.floor(Math.random() * LIDERANCAS_DEMO.length)];

  const tipos = [
    { tipo: 'NOVO_ELEITOR', desc: `Novo eleitor cadastrado em ${mun}`, cor: 'teal', icone: 'faUserPlus' },
    { tipo: 'NOVA_LIDERANCA', desc: `Liderança ${lid} registrou nova adesão em ${mun}`, cor: 'amber', icone: 'faUserTie' },
    { tipo: 'ATENDIMENTO_CONCLUIDO', desc: `Atendimento social concluído em ${mun}`, cor: 'emerald', icone: 'faCheckCircle' },
    { tipo: 'CAMPANHA_CRIADA', desc: `Nova ação social iniciada em ${mun}`, cor: 'purple', icone: 'faBullhorn' }
  ];

  const ev = tipos[Math.floor(Math.random() * tipos.length)];
  return {
    id: `demo-${Date.now()}-${Math.random()}`,
    ...ev,
    municipio: mun,
    lideranca: lid,
    usuario: 'Equipe Demo',
    tempoRelativo: 'agora',
    recente5Min: true,
    dataHora: new Date().toISOString()
  };
}
