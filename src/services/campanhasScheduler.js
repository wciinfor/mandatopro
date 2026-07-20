import { CampanhasWorker } from './campanhasWorker';

/**
 * Scheduler / Orquestrador central que roda em background (cron-like) 
 * disparando os ciclos de processamento do Worker de campanhas.
 */
export class CampanhasScheduler {
  constructor(worker, intervaloMs = 10000) {
    this.worker = worker;
    this.intervaloMs = intervaloMs;
    this.timer = null;
    this.rodando = false;
  }

  /**
   * Inicializa o scheduler de processamento periódico em lote
   */
  iniciar() {
    if (this.rodando) return;
    this.rodando = true;
    
    const tick = async () => {
      if (!this.rodando) return;
      try {
        await this.worker.processarProximoLote();
      } catch (err) {
        console.error('[CampanhasScheduler] Erro no ciclo de processamento da fila:', err);
      } finally {
        this.timer = setTimeout(tick, this.intervaloMs);
      }
    };

    this.timer = setTimeout(tick, this.intervaloMs);
  }

  /**
   * Finaliza / Pausa o scheduler de disparos
   */
  parar() {
    this.rodando = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
