import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function normalizeStatus(input) {
  const allowed = new Set(['AGENDADO', 'REALIZADO', 'CANCELADO']);
  const legacyMap = {
    NAO_REALIZADO: 'CANCELADO',
    EM_PROCESSO: 'AGENDADO'
  };

  if (!input) return 'AGENDADO';

  const raw = String(input).trim().toUpperCase();
  const mapped = legacyMap[raw] || raw;
  return allowed.has(mapped) ? mapped : 'AGENDADO';
}

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'ID é obrigatório' });
  }

  // GET - Buscar atendimento por ID
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('atendimentos')
        .select(`
          id,
          protocolo,
          data_atendimento,
          data_conclusao,
          tipo_atendimento,
          assunto,
          descricao,
          resultado,
          status,
          eleitor_id,
          campanha_id,
          eleitores!atendimentos_eleitor_id_fkey (
            id,
            nome,
            cpf
          ),
          campanhas:campanhas!atendimentos_campanha_id_fkey (
            id,
            nome
          )
        `)
        .eq('id', id)
        .limit(1);

      if (error) throw error;

      const atendimento = Array.isArray(data) ? data[0] : null;
      if (!atendimento) {
        return res.status(404).json({ error: 'Atendimento não encontrado' });
      }

      // Buscar serviços separadamente para evitar falha de join
      const { data: servicos, error: erroServicos } = await supabase
        .from('atendimentos_servicos')
        .select(`
          atendimento_id,
          categorias_servicos (
            id,
            nome
          )
        `)
        .eq('atendimento_id', atendimento.id);

      if (!erroServicos && servicos) {
        atendimento.atendimentos_servicos = servicos
          .map(s => s.categorias_servicos)
          .filter(Boolean);
      } else {
        atendimento.atendimentos_servicos = [];
      }

      const { data: historico, error: erroHistorico } = await supabase
        .from('atendimentos_historico')
        .select('id, status, observacao, usuario_nome, created_at')
        .eq('atendimento_id', atendimento.id)
        .order('created_at', { ascending: true });

      if (!erroHistorico && historico) {
        atendimento.historico = historico;
      } else {
        atendimento.historico = [];
      }

      return res.status(200).json(atendimento);
    } catch (error) {
      console.error('Erro ao buscar atendimento:', error);
      return res.status(400).json({
        error: error.message || 'Erro ao buscar atendimento',
        details: error.details || null,
        hint: error.hint || null
      });
    }
  }

  // PUT - Atualizar atendimento
  if (req.method === 'PUT') {
    try {
      const {
        tipoAtendimento,
        assunto,
        descricao,
        resultado,
        status,
        dataAtendimento,
        dataConclusao,
        historicoNovos
      } = req.body;

      const statusNormalizado = normalizeStatus(status);

      const payload = {
        tipo_atendimento: tipoAtendimento,
        assunto,
        descricao,
        resultado,
        status: statusNormalizado,
        updated_at: new Date().toISOString()
      };

      if (dataAtendimento) {
        payload.data_atendimento = new Date(dataAtendimento).toISOString();
      }

      if (dataConclusao) {
        payload.data_conclusao = new Date(dataConclusao).toISOString();
      }

      const { data, error } = await supabase
        .from('atendimentos')
        .update(payload)
        .eq('id', id)
        .select();

      if (error) throw error;

      if (Array.isArray(historicoNovos) && historicoNovos.length > 0) {
        const historicoPayload = historicoNovos.map((item) => ({
          atendimento_id: id,
          status: normalizeStatus(item.status),
          observacao: item.observacao || null,
          usuario_nome: item.usuario || null,
          created_at: item.dataIso || new Date().toISOString()
        }));

        const { error: erroHistorico } = await supabase
          .from('atendimentos_historico')
          .insert(historicoPayload);

        if (erroHistorico) throw erroHistorico;
      }

      return res.status(200).json(data[0]);
    } catch (error) {
      console.error('Erro ao atualizar atendimento:', error);
      return res.status(400).json({ error: error.message });
    }
  }

  // DELETE - Deletar atendimento
  if (req.method === 'DELETE') {
    try {
      const { error } = await supabase
        .from('atendimentos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return res.status(200).json({ message: 'Atendimento deletado com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar atendimento:', error);
      return res.status(400).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
