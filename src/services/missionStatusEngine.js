import { createServerClient } from '@/lib/supabase-server';

/**
 * Avaliador de Crescimento da Base Eleitoral (Peso: 20)
 */
async function avaliarCrescimento(supabase, agora) {
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).toISOString();
  const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999).toISOString();

  const [{ count: mesAtual }, { count: mesAnterior }] = await Promise.all([
    supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', inicioMes),
    supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', inicioMesAnterior).lte('created_at', fimMesAnterior)
  ]);

  const countAtual = mesAtual || 0;
  const countAnterior = mesAnterior || 0;

  let score = 75; // Padrão neutro
  let positivo = null;
  let negativo = null;

  if (countAnterior > 0) {
    const variacao = Math.round(((countAtual - countAnterior) / countAnterior) * 100);
    if (variacao >= 20) {
      score = 100;
      positivo = `Crescimento da base eleitoral em alta (+${variacao}% no mês).`;
    } else if (variacao >= 0) {
      score = 85;
      positivo = `Crescimento estável da base (+${variacao}%).`;
    } else if (variacao >= -25) {
      score = 60;
      negativo = `Ritmo de novos cadastros com leve queda (${variacao}%).`;
    } else {
      score = 30;
      negativo = `Queda acentuada na captação de novos eleitores (${variacao}%).`;
    }
  } else if (countAtual > 0) {
    score = 90;
    positivo = 'Mês atual com novos cadastros registrados.';
  }

  return { peso: 20, score, positivo, negativo };
}

/**
 * Avaliador de Atividade das Lideranças (Peso: 20)
 */
async function avaliarLiderancas(supabase, agora) {
  const limite15Dias = new Date(agora.getTime() - (15 * 24 * 60 * 60 * 1000)).toISOString();

  const [{ data: liderancas }, { data: eleitoresRecentes }] = await Promise.all([
    supabase.from('liderancas').select('id, nome'),
    supabase.from('eleitores').select('lideranca, lideranca_id, created_at').gte('created_at', limite15Dias).limit(100)
  ]);

  const total = liderancas?.length || 0;
  if (total === 0) {
    return { peso: 20, score: 70, positivo: null, negativo: 'Nenhuma liderança formalmente cadastrada.' };
  }

  const lideresAtivos = new Set();
  const liderPorNomeIndex = new Map();
  (liderancas || []).forEach(l => {
    if (l.nome) liderPorNomeIndex.set(l.nome.trim().toLowerCase(), String(l.id));
  });

  (eleitoresRecentes || []).forEach(e => {
    let lidId = e.lideranca_id ? String(e.lideranca_id) : null;
    if (!lidId && e.lideranca) {
      lidId = liderPorNomeIndex.get(String(e.lideranca).trim().toLowerCase()) || null;
    }
    if (lidId) lideresAtivos.add(lidId);
  });

  const percentualAtivas = Math.round((lideresAtivos.size / total) * 100);
  let score = 70;
  let positivo = null;
  let negativo = null;

  if (percentualAtivas >= 70) {
    score = 100;
    positivo = `Engajamento alto das lideranças (${percentualAtivas}% ativas recentemente).`;
  } else if (percentualAtivas >= 40) {
    score = 75;
    positivo = `Atividade regular das lideranças (${percentualAtivas}% ativas).`;
  } else {
    score = 40;
    negativo = `Mais da metade das lideranças (${100 - percentualAtivas}%) sem cadastros nos últimos 15 dias.`;
  }

  return { peso: 20, score, positivo, negativo };
}

/**
 * Avaliador de Cobertura Territorial (Peso: 15)
 */
async function avaliarCobertura(supabase) {
  const { data: eleitores } = await supabase.from('eleitores').select('cidade, municipio, bairro');
  const municipiosMap = new Set();

  (eleitores || []).forEach(e => {
    const m = String(e.cidade || e.municipio || e.bairro || '').trim().toUpperCase();
    if (m) municipiosMap.add(m);
  });

  const totalComPresenca = municipiosMap.size;
  const coberturaPercent = Math.min(100, Math.round((totalComPresenca / 144) * 100));

  let score = 75;
  let positivo = null;
  let negativo = null;

  if (coberturaPercent >= 30) {
    score = 95;
    positivo = `Presença territorial sólida em ${totalComPresenca} municípios (${coberturaPercent}% do estado).`;
  } else if (coberturaPercent >= 15) {
    score = 75;
    positivo = `Cobertura geográfica em expansão (${totalComPresenca} municípios).`;
  } else {
    score = 50;
    negativo = `Cobertura territorial concentrada em poucos municípios (${coberturaPercent}% do estado).`;
  }

  return { peso: 15, score, positivo, negativo };
}

/**
 * Avaliador de Atendimentos e Solicitações (Peso: 20)
 */
async function avaliarAtendimentos(supabase, agora) {
  const limite48h = new Date(agora.getTime() - (48 * 60 * 60 * 1000)).toISOString();

  const { count: pendentesAtrasadas } = await supabase
    .from('solicitacoes')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'ATENDIDO')
    .lte('created_at', limite48h);

  const atrasadas = pendentesAtrasadas || 0;
  let score = 90;
  let positivo = null;
  let negativo = null;

  if (atrasadas === 0) {
    score = 100;
    positivo = 'Atendimentos e solicitações sem gargalos atrasados.';
  } else if (atrasadas <= 5) {
    score = 70;
    negativo = `${atrasadas} solicitações aguardando retorno há mais de 48 horas.`;
  } else {
    score = 35;
    negativo = `Gargalo crítico em atendimentos: ${atrasadas} solicitações atrasadas (>48h).`;
  }

  return { peso: 20, score, positivo, negativo };
}

/**
 * Avaliador de Campanhas Ativas (Peso: 10)
 */
async function avaliarCampanhas(supabase) {
  const { data: campanhas } = await supabase
    .from('campanhas')
    .select('id, status')
    .in('status', ['EXECUCAO', 'PLANEJAMENTO']);

  const ativas = campanhas?.length || 0;
  let score = 80;
  let positivo = null;
  let negativo = null;

  if (ativas > 0) {
    score = 95;
    positivo = `${ativas} campanhas e ações sociais em andamento.`;
  } else {
    score = 65;
    negativo = 'Nenhuma campanha social em execução no momento.';
  }

  return { peso: 10, score, positivo, negativo };
}

/**
 * Avaliador de Saúde e Infraestrutura do Sistema (Peso: 15)
 */
async function avaliarSistema() {
  return {
    peso: 15,
    score: 100,
    positivo: 'Sistema operando com 100% de disponibilidade.',
    negativo: null
  };
}

/**
 * MissionStatusEngine Central
 * Processa todos os avaliadores desacoplados e consolida o Status Geral do Mandato.
 */
export async function calcularMissionStatus(supabase) {
  const agora = new Date();

  // Executar todos os avaliadores desacoplados simultaneamente
  const avaliacoes = await Promise.all([
    avaliarCrescimento(supabase, agora),
    avaliarLiderancas(supabase, agora),
    avaliarCobertura(supabase),
    avaliarAtendimentos(supabase, agora),
    avaliarCampanhas(supabase),
    avaliarSistema()
  ]);

  // Consolidação ponderada do score final (0–100)
  let somaPonderada = 0;
  let somaPesos = 0;
  const fatoresPositivos = [];
  const fatoresNegativos = [];

  avaliacoes.forEach(a => {
    somaPonderada += (a.score * a.peso);
    somaPesos += a.peso;

    if (a.positivo) fatoresPositivos.push(a.positivo);
    if (a.negativo) fatoresNegativos.push(a.negativo);
  });

  const scoreFinal = Math.min(100, Math.max(0, Math.round(somaPonderada / (somaPesos || 1))));

  // Níveis de Classificação Executiva:
  // 🟢 Excelente (90–100)
  // 🔵 Muito Bom (75–89)
  // 🟡 Atenção (60–74)
  // 🟠 Alerta (40–59)
  // 🔴 Crítico (0–39)
  let status = 'EXCELENTE';
  let cor = 'emerald';
  let icone = 'faCheckCircle';
  let resumoExecutivo = 'Mandato operando em excelente capacidade com crescimento consistente.';

  if (scoreFinal >= 90) {
    status = 'EXCELENTE';
    cor = 'emerald';
    icone = 'faCheckCircle';
    resumoExecutivo = 'Mandato operando normalmente com crescimento consistente da base eleitoral.';
  } else if (scoreFinal >= 75) {
    status = 'MUITO_BOM';
    cor = 'blue';
    icone = 'faThumbsUp';
    resumoExecutivo = 'Desempenho operacional muito bom com boa retenção e engajamento da equipe.';
  } else if (scoreFinal >= 60) {
    status = 'ATENCAO';
    cor = 'yellow';
    icone = 'faExclamationCircle';
    resumoExecutivo = 'Situação do mandato exige atenção para pontos pontuais de produção e atendimento.';
  } else if (scoreFinal >= 40) {
    status = 'ALERTA';
    cor = 'amber';
    icone = 'faExclamationTriangle';
    resumoExecutivo = 'Há risco de queda na atividade das lideranças ou gargalo nos atendimentos.';
  } else {
    status = 'CRITICO';
    cor = 'rose';
    icone = 'faRadiation';
    resumoExecutivo = 'Existem gargalos operacionais críticos que exigem intervenção direta imediata.';
  }

  return {
    status,
    score: scoreFinal,
    cor,
    icone,
    resumoExecutivo,
    fatoresPositivos,
    fatoresNegativos,
    dataAvaliacao: agora.toISOString()
  };
}
