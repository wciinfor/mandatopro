/**
 * Repository de persistência de dados no Supabase para controle da Fila de Execução.
 */
export class FilaDisparosRepository {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Salva uma lista em massa de contatos na fila para execução posterior
   * @param {Array<Object>} itensFila
   */
  async criarFilaLote(itensFila) {
    const { data, error } = await this.supabase
      .from('central_atendimento_fila_disparos')
      .insert(itensFila.map(item => ({
        campaign_id: item.campaign_id,
        contact_id: item.contact_id,
        template_id: item.template_id,
        status: 'pendente',
        scheduled_at: item.scheduled_at || new Date().toISOString(),
        variaveis_mapeadas: item.variaveis_mapeadas || {},
        provider_message_id: item.provider_message_id || null,
        attempts: 0
      })))
      .select('*');

    if (error) throw error;
    return data;
  }

  /**
   * Reserva itens pendentes para processamento imediato evitando concorrência (lock de status)
   * @param {number} limite - Quantidade de itens a serem reservados
   */
  async reservarProximosItens(limite = 50) {
    const now = new Date().toISOString();
    
    // 1. Busca os próximos ids pendentes
    const { data: pendentes, error: selectErr } = await this.supabase
      .from('central_atendimento_fila_disparos')
      .select('id')
      .eq('status', 'pendente')
      .lte('scheduled_at', now)
      .limit(limite);

    if (selectErr || !pendentes || pendentes.length === 0) return [];

    const ids = pendentes.map(p => p.id);

    // 2. Atualiza o status em lote para processando
    const { data: reservados, error: updateErr } = await this.supabase
      .from('central_atendimento_fila_disparos')
      .update({
        status: 'processando',
        started_at: now
      })
      .in('id', ids)
      .select('*');

    if (updateErr) throw updateErr;
    return reservados;
  }

  /**
   * Atualiza o resultado de disparo de um item
   */
  async atualizarStatusItem(id, updates) {
    const { data, error } = await this.supabase
      .from('central_atendimento_fila_disparos')
      .update({
        status: updates.status,
        finished_at: updates.status !== 'processando' ? new Date().toISOString() : null,
        attempts: updates.attempts,
        last_error: updates.last_error || null,
        provider_message_id: updates.provider_message_id || undefined
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Localiza o item da fila através do provider_message_id recebido pelo webhook da Meta
   * e atualiza status, timestamps de entrega/leitura e possíveis erros.
   */
  async atualizarStatusPorProviderId(providerMessageId, updates) {
    const fieldsToUpdate = {
      status: updates.status,
      updated_at: new Date().toISOString()
    };

    if (updates.status === 'entregue' || updates.status === 'delivered') {
      fieldsToUpdate.status = 'entregue';
      fieldsToUpdate.delivered_at = updates.delivered_at || new Date().toISOString();
    } else if (updates.status === 'lida' || updates.status === 'read') {
      fieldsToUpdate.status = 'lida';
      fieldsToUpdate.read_at = updates.read_at || new Date().toISOString();
      if (!fieldsToUpdate.delivered_at) {
        fieldsToUpdate.delivered_at = updates.read_at || new Date().toISOString();
      }
    } else if (updates.status === 'falhou' || updates.status === 'failed') {
      fieldsToUpdate.status = 'falhou';
      fieldsToUpdate.last_error = updates.last_error || 'Erro no envio relatado pela Meta';
      fieldsToUpdate.finished_at = new Date().toISOString();
    } else if (updates.status === 'enviada' || updates.status === 'sent') {
      fieldsToUpdate.status = 'enviada';
    }

    const { data, error } = await this.supabase
      .from('central_atendimento_fila_disparos')
      .update(fieldsToUpdate)
      .eq('provider_message_id', providerMessageId)
      .select('*');

    if (error) throw error;
    return data;
  }
}
