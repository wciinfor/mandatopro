/**
 * Helper para registrar eventos de auditoria e linha de tempo (timeline) na tabela communication_audiences.
 */
export async function registrarEventoTimeline(supabase, campaignId, { tipo, descricao, metadata = {}, operador = 'Operador Geral' }) {
  try {
    // 1. Busca a campanha correspondente para obter o audience_id
    const { data: campanha, error: errCamp } = await supabase
      .from('communication_campaigns')
      .select('audience_id')
      .eq('id', campaignId)
      .single();

    if (errCamp || !campanha || !campanha.audience_id) {
      console.warn(`[TimelineHelper] Não foi possível localizar a campanha ou audience_id para campanha ${campaignId}`);
      return;
    }

    // 2. Busca a audiência atual para ler a timeline existente
    const { data: audiência, error: errAud } = await supabase
      .from('communication_audiences')
      .select('regras')
      .eq('id', campanha.audience_id)
      .single();

    if (errAud || !audiência) {
      console.warn(`[TimelineHelper] Não foi possível localizar a audiência ${campanha.audience_id}`);
      return;
    }

    const regras = audiência.regras || {};
    const timeline = Array.isArray(regras.timeline) ? regras.timeline : [];

    // 3. Adiciona o novo evento de log na linha do tempo
    const novoEvento = {
      timestamp: new Date().toISOString(),
      operador,
      tipo,
      descricao,
      metadata
    };

    const regrasAtualizadas = {
      ...regras,
      timeline: [...timeline, novoEvento]
    };

    // 4. Salva a audiência com a timeline atualizada
    const { error: errUpdate } = await supabase
      .from('communication_audiences')
      .update({ regras: regrasAtualizadas })
      .eq('id', campanha.audience_id);

    if (errUpdate) {
      console.error('[TimelineHelper] Erro ao salvar regras com nova timeline:', errUpdate);
    }
  } catch (err) {
    console.error('[TimelineHelper] Erro geral ao registrar evento de timeline:', err);
  }
}
