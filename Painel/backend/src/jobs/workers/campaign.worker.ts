import { Worker } from 'bullmq';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { supabaseAdmin } from '../../config/supabase';
import { evolutionService } from '../../services/evolution.service';
import { CampaignDispatchJobData, campaignDispatchQueue } from '../queue';

// ──────────────────────────────────────────────────────────────
// WORKER DE DISPARO DE CAMPANHAS
//
// Processa jobs da fila "campaign:dispatch".
// Cada job processa um lote de contatos (batchSize).
// Se ainda existirem contatos, enfileira o próximo lote.
//
// Este worker substitui gradualmente o fluxo do N8N.
// ──────────────────────────────────────────────────────────────

const connection = { url: env.REDIS_URL };

export const campaignWorker = new Worker<CampaignDispatchJobData>(
  'campaign-dispatch',
  async (job) => {
    const { campaignId, workspaceId, batchSize, offsetStart } = job.data;

    logger.info({ campaignId, offsetStart }, 'Processando lote de disparo');

    // 1. Buscar lote de contatos pendentes
    const { data: contacts, error } = await supabaseAdmin
      .from('campaign_contacts')
      .select('id, contact_id, contacts(phone)')
      .eq('campaign_id', campaignId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .range(offsetStart, offsetStart + batchSize - 1);

    if (error) {
      logger.error({ campaignId, err: error }, 'Erro ao buscar contatos do lote');
      throw error;
    }

    if (!contacts?.length) {
      // Todos os contatos processados — marcar campanha como concluída
      await supabaseAdmin
        .from('campaigns')
        .update({ status: 'completed', finished_at: new Date().toISOString() })
        .eq('id', campaignId);
      logger.info({ campaignId }, 'Campanha concluída');
      return;
    }

    // 2. Buscar instância conectada do workspace
    const { data: instance } = await supabaseAdmin
      .from('instances')
      .select('id, name')
      .eq('workspace_id', workspaceId)
      .eq('status', 'connected')
      .limit(1)
      .maybeSingle();

    if (!instance) {
      throw new Error('Nenhuma instância conectada disponível');
    }

    // 3. Buscar mensagem da campanha
    const { data: message } = await supabaseAdmin
      .from('campaign_messages')
      .select('content, media_url, media_type')
      .eq('campaign_id', campaignId)
      .eq('sequence', 1)
      .eq('is_active', true)
      .maybeSingle();

    if (!message?.content) {
      throw new Error('Campanha sem mensagem configurada');
    }

    // 4. Disparar para cada contato do lote
    for (const row of contacts) {
      // Supabase retorna joins como array; pegamos o primeiro elemento
      const contactArr = row.contacts as Array<{ phone: string }> | null;
      const phone = Array.isArray(contactArr) ? contactArr[0]?.phone : (contactArr as { phone: string } | null)?.phone;
      if (!phone) continue;

      try {
        await evolutionService.sendText(instance.name, { number: phone, text: message.content });

        await supabaseAdmin
          .from('campaign_contacts')
          .update({ status: 'success', last_attempt_at: new Date().toISOString() })
          .eq('id', row.id);

        await supabaseAdmin.from('campaign_dispatch_logs').insert({
          workspace_id: workspaceId,
          campaign_id:  campaignId,
          contact_id:   row.contact_id,
          instance_id:  instance.id,
          status:       'success',
          sent_at:      new Date().toISOString(),
        });
      } catch (err) {
        logger.warn({ phone, campaignId }, 'Falha ao enviar mensagem');
        await supabaseAdmin
          .from('campaign_contacts')
          .update({
            status:         'error',
            error_msg:      String(err),
            attempt_count:  1,
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', row.id);
      }
    }

    // 5. Re-enfileirar próximo lote se ainda houver contatos
    if (contacts.length === batchSize) {
      await campaignDispatchQueue.add('dispatch', {
        campaignId,
        workspaceId,
        batchSize,
        offsetStart: offsetStart + batchSize,
      });
    }
  },
  { connection, concurrency: 2 },
);

campaignWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Job de disparo falhou');
});

campaignWorker.on('completed', (job) => {
  logger.debug({ jobId: job.id }, 'Job de disparo concluído');
});
