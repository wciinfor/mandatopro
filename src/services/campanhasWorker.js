import { FilaDisparosRepository } from '@/lib/repositories-fila-disparos';
import { createServerClient } from '@/lib/supabase-server';

/**
 * Worker encarregado de processar a fila de disparos de campanhas oficiais de forma assíncrona.
 * Preparado para execução segura em lotes e em múltiplos servidores/workers concorrentes.
 */
export class CampanhasWorker {
  constructor(channelProviderResolver) {
    this.providerResolver = channelProviderResolver;
  }

  /**
   * Executa um ciclo de processamento de lote da fila de disparos oficiais.
   * @param {number} tamanhoLote - Limite de registros a serem processados simultaneamente.
   */
  async processarProximoLote(tamanhoLote = 20) {
    const supabase = createServerClient();
    const repo = new FilaDisparosRepository(supabase);

    // 1. RESERVA: Reserva os próximos itens pendentes na fila atômica (lock de status 'processando')
    // Evita concorrência e garante que outros Workers paralelos não capturem os mesmos itens.
    const itensReservados = await repo.reservarProximosItens(tamanhoLote);
    
    if (itensReservados.length === 0) {
      return { processados: 0, sucesso: 0, falhas: 0 };
    }

    let sucessos = 0;
    let falhas = 0;

    for (const item of itensReservados) {
      try {
        const provider = this.providerResolver(item.channel || 'whatsapp');
        
        // 2. TENTATIVA: Incrementa o número de tentativas de envio no controle interno
        const proximaTentativa = (item.attempts || 0) + 1;

        // 3. ENVIO: Delega ao ChannelProvider (Mockado / Simulado nesta etapa)
        const resultadoEnvio = await provider.enviarMensagem(item.contact_id, {
          templateId: item.template_id,
          variaveis: item.variaveis_mapeadas
        });

        // 4. ATUALIZAÇÃO SUCESSO: Altera status para enviado e registra a conclusão
        await repo.atualizarStatusItem(item.id, {
          status: 'enviada',
          attempts: proximaTentativa
        });
        sucessos++;

      } catch (error) {
        // 5. REGISTRO DE ERRO: Caso falhe, captura o erro e marca a falha no log
        const proximaTentativa = (item.attempts || 0) + 1;
        const statusFinal = proximaTentativa >= 3 ? 'falhou' : 'pendente'; // Retorna para a fila se tentativas < 3
        
        await repo.atualizarStatusItem(item.id, {
          status: statusFinal,
          attempts: proximaTentativa,
          last_error: error.message || 'Erro inesperado durante envio'
        });
        falhas++;
      }
    }

    return {
      processados: itensReservados.length,
      sucessos,
      falhas
    };
  }
}
