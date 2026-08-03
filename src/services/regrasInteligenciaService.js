import { createServerClient } from '@/lib/supabase-server';

/**
 * Motor de Regras Estratégicas do MandatoPRO Live (Rule Engine)
 * Responsável por processar regras determinísticas e gerar insights acionáveis com score de confiança e recomendação.
 * Preparado para receber futuramente regras de IA Generativa.
 */
export async function processarRegrasInteligencia(supabase) {
  const agora = new Date();
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).toISOString();
  const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999).toISOString();
  const limite48h = new Date(agora.getTime() - (48 * 60 * 60 * 1000)).toISOString();
  const limite15Dias = new Date(agora.getTime() - (15 * 24 * 60 * 60 * 1000)).toISOString();

  // Executar buscas em paralelo de dados consolidados para alimentar o Motor de Regras
  const [
    { count: totalEleitores },
    { count: eleitoresMesAtual },
    { count: eleitoresMesAnterior },
    { data: eleitoresPorCidade },
    { data: liderancas },
    { data: eleitoresRecentes },
    { count: solicitacoesAtrasadas48h },
    { data: campanhas }
  ] = await Promise.all([
    supabase.from('eleitores').select('id', { count: 'exact', head: true }),
    supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', inicioMes),
    supabase.from('eleitores').select('id', { count: 'exact', head: true }).gte('created_at', inicioMesAnterior).lte('created_at', fimMesAnterior),
    supabase.from('eleitores').select('cidade, municipio, bairro'),
    supabase.from('liderancas').select('id, nome, cidade, municipio, bairro'),
    supabase.from('eleitores').select('lideranca, lideranca_id, created_at'),
    supabase.from('solicitacoes').select('id', { count: 'exact', head: true }).neq('status', 'ATENDIDO').lte('created_at', limite48h),
    supabase.from('campanhas').select('id, nome, status, data_campanha')
  ]);

  const insights = [];

  // -------------------------------------------------------------
  // REGRA 1: Queda ou Aceleração no Ritmo de Cadastros no Mês
  // -------------------------------------------------------------
  const mesAtualCount = eleitoresMesAtual || 0;
  const mesAnteriorCount = eleitoresMesAnterior || 0;

  if (mesAnteriorCount > 0) {
    const variacao = Math.round(((mesAtualCount - mesAnteriorCount) / mesAnteriorCount) * 100);
    if (variacao <= -30) {
      insights.push({
        id: 'regra-queda-cadastros',
        tipo: 'ALERTA',
        severidade: 'CRITICA',
        categoria: 'Crescimento da Base',
        titulo: 'Queda Significativa no Ritmo de Cadastros',
        descricao: `O número de novos eleitores cadastrados caiu ${Math.abs(variacao)}% em relação ao mesmo período do mês anterior.`,
        recomendacao: 'Mobilizar a equipe de campo e agendar novas ações sociais nos municípios estratégicos.',
        prioridade: 'CRITICA',
        scoreConfianca: 98,
        dataGeracao: new Date().toISOString()
      });
    } else if (variacao >= 25) {
      insights.push({
        id: 'regra-crescimento-acelerado',
        tipo: 'OPORTUNIDADE',
        severidade: 'INFORMATIVA',
        categoria: 'Crescimento da Base',
        titulo: 'Crescimento Acelerado da Base Eleitoral',
        descricao: `A base de eleitores registrou alta de +${variacao}% no mês atual, superando o desempenho anterior.`,
        recomendacao: 'Manter a cadência de ações e reforçar o suporte às lideranças mais produtivas.',
        prioridade: 'INFORMATIVA',
        scoreConfianca: 95,
        dataGeracao: new Date().toISOString()
      });
    }
  }

  // -------------------------------------------------------------
  // REGRA 2: Risco de Concentração Geográfica da Base
  // -------------------------------------------------------------
  const cidadeCountMap = new Map();
  let totalEleitoresMapeados = 0;
  (eleitoresPorCidade || []).forEach((e) => {
    const cid = String(e.cidade || e.municipio || e.bairro || '').trim().toUpperCase();
    if (cid) {
      cidadeCountMap.set(cid, (cidadeCountMap.get(cid) || 0) + 1);
      totalEleitoresMapeados++;
    }
  });

  if (totalEleitoresMapeados > 0) {
    cidadeCountMap.forEach((count, cid) => {
      const percentual = Math.round((count / totalEleitoresMapeados) * 100);
      if (percentual >= 40) {
        insights.push({
          id: `regra-concentracao-${cid}`,
          tipo: 'ALERTA',
          severidade: 'ALTA',
          categoria: 'Cobertura Territorial',
          titulo: `Alta Concentração de Eleitores em ${cid}`,
          descricao: `${cid} representa ${percentual}% de toda a base eleitoral do mandato (${count.toLocaleString('pt-BR')} eleitores).`,
          recomendacao: 'Expansão geográfica recomendada para evitar dependência excessiva de um único município.',
          prioridade: 'ALTA',
          scoreConfianca: 96,
          dataGeracao: new Date().toISOString()
        });
      }
    });
  }

  // -------------------------------------------------------------
  // REGRA 3: Lideranças em Alerta de Inatividade (>15 dias sem cadastros)
  // -------------------------------------------------------------
  const ultimaAtividadeLider = new Map();
  (eleitoresRecentes || []).forEach((e) => {
    const lidName = String(e.lideranca || '').trim();
    if (lidName) {
      const idOuNome = lidName.toLowerCase();
      if (!ultimaAtividadeLider.has(idOuNome) || new Date(e.created_at) > new Date(ultimaAtividadeLider.get(idOuNome))) {
        ultimaAtividadeLider.set(idOuNome, e.created_at);
      }
    }
  });

  (liderancas || []).forEach((l) => {
    const nomeChave = String(l.nome || '').trim().toLowerCase();
    const ultimaData = ultimaAtividadeLider.get(nomeChave);
    
    if (!ultimaData || ultimaData < limite15Dias) {
      const diasInativo = ultimaData ? Math.floor((agora.getTime() - new Date(ultimaData).getTime()) / (1000 * 60 * 60 * 24)) : 'mais de 30';
      insights.push({
        id: `regra-lider-inativo-${l.id}`,
        tipo: 'ALERTA',
        severidade: 'ALTA',
        categoria: 'Lideranças',
        titulo: `Liderança ${l.nome} com Baixa Atividade`,
        descricao: `A liderança ${l.nome} de ${l.municipio || l.cidade || 'Gabinete'} está há ${diasInativo} dias sem registrar novos eleitores.`,
        recomendacao: 'Agendar reunião de alinhamento com a liderança para identificar gargalos de atuação.',
        prioridade: 'ALTA',
        scoreConfianca: 92,
        dataGeracao: new Date().toISOString()
      });
    }
  });

  // -------------------------------------------------------------
  // REGRA 4: Gargalo de Atendimento / Solicitações Atrasadas (>48h)
  // -------------------------------------------------------------
  const pendentesAtrasadas = solicitacoesAtrasadas48h || 0;
  if (pendentesAtrasadas > 0) {
    insights.push({
      id: 'regra-solicitacoes-atrasadas',
      tipo: 'ALERTA',
      severidade: 'CRITICA',
      categoria: 'Atendimentos',
      titulo: 'Gargalo em Atendimentos e Solicitações',
      descricao: `Existem ${pendentesAtrasadas} solicitações de eleitores aguardando retorno do gabinete há mais de 48 horas.`,
      recomendacao: 'Priorizar a triagem e resposta destas demandas para preservar a satisfação do eleitorado.',
      prioridade: 'CRITICA',
      scoreConfianca: 99,
      dataGeracao: new Date().toISOString()
    });
  }

  // -------------------------------------------------------------
  // REGRA 5: Oportunidade em Municípios com Presença mas sem Liderança
  // -------------------------------------------------------------
  const municipiosLiderancas = new Set(
    (liderancas || []).map((l) => String(l.cidade || l.municipio || l.bairro || '').trim().toUpperCase()).filter(Boolean)
  );

  const municipiosSemLider = [];
  cidadeCountMap.forEach((count, cid) => {
    if (!municipiosLiderancas.has(cid) && count >= 5) {
      municipiosSemLider.push({ nome: cid, count });
    }
  });

  if (municipiosSemLider.length > 0) {
    const nomesFoco = municipiosSemLider.slice(0, 3).map((m) => m.nome).join(', ');
    insights.push({
      id: 'regra-oportunidade-expansao-lideranca',
      tipo: 'OPORTUNIDADE',
      severidade: 'MEDIA',
      categoria: 'Oportunidades',
      titulo: 'Potencial de Expansão de Lideranças',
      descricao: `Existem eleitores cadastrados em municípios como ${nomesFoco} sem nenhuma liderança formalizada.`,
      recomendacao: 'Identificar e cadastrar lideranças locais nestes municípios para estruturar o apoio.',
      prioridade: 'MEDIA',
      scoreConfianca: 90,
      dataGeracao: new Date().toISOString()
    });
  }

  // -------------------------------------------------------------
  // REGRA 6: Sucesso / Desempenho de Campanhas Ativas
  // -------------------------------------------------------------
  const campanhasAtivas = (campanhas || []).filter((c) => c.status === 'EXECUCAO' || c.status === 'PLANEJAMENTO');
  if (campanhasAtivas.length > 0) {
    insights.push({
      id: 'regra-campanhas-ativas',
      tipo: 'OPORTUNIDADE',
      severidade: 'INFORMATIVA',
      categoria: 'Campanhas',
      titulo: `${campanhasAtivas.length} Ações de Campo em Andamento`,
      descricao: `Campanhas como "${campanhasAtivas[0]?.nome || 'Ação Social'}" estão ativas na captação de demandas.`,
      recomendacao: 'Acompanhar em tempo real o preenchimento das fichas e atendimentos gerados.',
      prioridade: 'INFORMATIVA',
      scoreConfianca: 94,
      dataGeracao: new Date().toISOString()
    });
  }

  // Mapeamento numérico para ordenação rigorosa por prioridade
  const ordemPrioridade = {
    'CRITICA': 4,
    'ALTA': 3,
    'MEDIA': 2,
    'INFORMATIVA': 1
  };

  // Ordenar pela prioridade (CRITICA > ALTA > MEDIA > INFORMATIVA) e limitar aos 8 principais
  insights.sort((a, b) => (ordemPrioridade[b.prioridade] || 0) - (ordemPrioridade[a.prioridade] || 0));

  return insights.slice(0, 8);
}
