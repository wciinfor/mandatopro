import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

/**
 * API Handler para gerenciar ações de controle da Comunicação Oficial (Pausar, Retomar, Cancelar).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query; // campaign_id de disparos oficiais
  const { acao } = req.body || {};

  if (!id || !acao) {
    return res.status(400).json({ error: 'ID da campanha e ação são obrigatórios' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    // 1. Busca a campanha correspondente
    const { data: campanha, error: errGet } = await supabase
      .from('communication_campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (errGet || !campanha) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }

    let novoStatus = campanha.status;

    // 2. Executa a transação com base na ação selecionada
    const { registrarEventoTimeline } = require('@/lib/timeline-helper');

    if (acao === 'excluir' || req.method === 'DELETE') {
      // Regra estrita: só permite exclusão definitiva se a campanha ainda estiver na fila ou rascunho
      const statusPermitidos = ['Na Fila', 'rascunho', 'agendado'];
      if (!statusPermitidos.includes(campanha.status)) {
        return res.status(400).json({
          error: `Não é possível excluir uma campanha com status "${campanha.status}". Apenas campanhas que ainda não iniciaram processamento podem ser excluídas.`
        });
      }

      // Exclui a campanha principal (communication_campaign_items é excluído por CASCADE)
      const { error: errDelete } = await supabase
        .from('communication_campaigns')
        .delete()
        .eq('id', id)
        .eq('tenant_id', usuario.tenant_id || 1);

      if (errDelete) throw errDelete;

      return res.status(200).json({ success: true, message: 'Campanha e itens da fila excluídos com sucesso.' });

    } else if (acao === 'pausar') {
      novoStatus = 'Pausada';
      const { error: errUpdate } = await supabase
        .from('communication_campaigns')
        .update({ status: novoStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (errUpdate) throw errUpdate;

      await registrarEventoTimeline(supabase, id, {
        tipo: 'Comunicação pausada',
        descricao: 'A execução da comunicação oficial foi temporariamente pausada pelo operador.'
      });

    } else if (acao === 'retomar') {
      novoStatus = 'Na Fila';
      const { error: errUpdate } = await supabase
        .from('communication_campaigns')
        .update({ status: novoStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (errUpdate) throw errUpdate;

      await registrarEventoTimeline(supabase, id, {
        tipo: 'Comunicação retomada',
        descricao: 'A execução da comunicação oficial foi retomada e voltou para a fila de processamento.'
      });

    } else if (acao === 'cancelar') {
      novoStatus = 'Cancelada';
      
      // Atualiza status da campanha principal
      const { error: errUpdate } = await supabase
        .from('communication_campaigns')
        .update({ status: novoStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (errUpdate) throw errUpdate;

      // Altera todos os itens pendentes da fila para cancelados
      const { error: errItems } = await supabase
        .from('communication_campaign_items')
        .update({ status: 'cancelado', updated_at: new Date().toISOString() })
        .eq('campaign_id', id)
        .eq('status', 'pendente');
      
      if (errItems) {
        console.error('[AcoesComunicacaoAPI] Falha ao cancelar itens da fila:', errItems);
      }

      await registrarEventoTimeline(supabase, id, {
        tipo: 'Comunicação cancelada',
        descricao: 'Os disparos restantes da comunicação oficial foram permanentemente cancelados pelo operador.'
      });

    } else {
      return res.status(400).json({ error: 'Ação operacional desconhecida.' });
    }

    return res.status(200).json({ success: true, status: novoStatus });
  } catch (error) {
    console.error('[AcoesComunicacaoAPI] Erro ao executar ação operacional:', error);
    return res.status(500).json({ error: error.message });
  }
}
