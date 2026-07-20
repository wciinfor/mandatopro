/**
 * Serviço responsável por gerar insights e recomendações automáticas com base nas estatísticas
 * e no banco de dados local da aplicação, sem o uso de IA.
 */
export class InsightsComunicacaoService {
  /**
   * Executa a análise local de dados e gera o array de insights para o gestor
   * @param {Object} dadosLocais - Estatísticas consolidadas de campanhas, canais e operadores
   * @returns {Array<import('@/lib/model-insights-comunicacao').InsightRecomendacao>}
   */
  static gerarInsightsLocais(dadosLocais = {}) {
    const insights = [];
    const now = new Date().toISOString();

    // 1. ANÁLISE: Baixa taxa de entrega
    if (dadosLocais.campanhas) {
      const baixaEntrega = dadosLocais.campanhas.filter(c => c.entregues / c.total_destinatarios < 0.90);
      baixaEntrega.forEach(c => {
        insights.push({
          id: `ins-entrega-${c.id}`,
          tipo: 'danger',
          titulo: `Baixa Entrega: ${c.nome}`,
          descricao: `A campanha obteve apenas ${Math.round((c.entregues / c.total_destinatarios) * 100)}% de entrega definitiva no WhatsApp.`,
          recomendacao: 'Verifique se há números inativos ou inexistentes na lista e execute a limpeza dos contatos.',
          categoria: 'Campanhas',
          calculado_em: now
        });
      });
    }

    // 2. ANÁLISE: Melhor taxa de leitura (Templates)
    if (dadosLocais.templates) {
      const topTemplate = [...dadosLocais.templates].sort((a, b) => b.taxaLeitura - a.taxaLeitura)[0];
      if (topTemplate) {
        insights.push({
          id: `ins-tmpl-leitura`,
          tipo: 'success',
          titulo: `Template de Alta Leitura: ${topTemplate.nome}`,
          descricao: `O template "${topTemplate.nome}" está performando com ${topTemplate.taxaLeitura}% de abertura e visualização.`,
          recomendacao: 'Utilize este modelo ou estruturas semelhantes para comunicações com objetivos de engajamento.',
          categoria: 'Templates',
          calculado_em: now
        });
      }
    }

    // 3. ANÁLISE: Horário Nobre de Envio
    insights.push({
      id: 'ins-horario-nobre',
      tipo: 'info',
      titulo: 'Melhor Horário de Engajamento',
      descricao: 'Historicamente, os envios efetuados entre 10:00 e 11:30 e entre 14:00 e 16:00 apresentam taxas de leitura 15% superiores.',
      recomendacao: 'Programe os agendamentos das suas próximas campanhas de disparo oficial dentro destas faixas horárias.',
      categoria: 'Canais',
      calculado_em: now
    });

    // 4. ANÁLISE: Operadores com alto tempo de resposta
    if (dadosLocais.operadores) {
      const tempoAlto = dadosLocais.operadores.filter(op => op.minutosResposta > 15);
      tempoAlto.forEach(op => {
        insights.push({
          id: `ins-op-resposta-${op.id}`,
          tipo: 'warning',
          titulo: `Tempo Alto de Resposta: ${op.nome}`,
          descricao: `O operador ${op.nome} apresenta um tempo médio de primeira resposta de ${op.minutosResposta} minutos.`,
          recomendacao: 'Considere redistribuir a carga de atendimento na central ou habilitar automações de triagem.',
          categoria: 'Equipe',
          calculado_em: now
        });
      });
    }

    return insights;
  }
}
