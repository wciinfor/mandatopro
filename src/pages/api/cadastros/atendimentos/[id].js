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
          tipo_atendimento,
          assunto,
          descricao,
          resultado,
          status,
          eleitor_id,
          eleitores!atendimentos_eleitor_id_fkey (
            id,
            nome,
            cpf
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      return res.status(200).json(data);
    } catch (error) {
      console.error('Erro ao buscar atendimento:', error);
      return res.status(404).json({ error: 'Atendimento não encontrado' });
    }
  }

  // PUT - Atualizar atendimento
  if (req.method === 'PUT') {
    try {
      const { tipoAtendimento, assunto, descricao, resultado, status } = req.body;

      const statusNormalizado = normalizeStatus(status);

      const { data, error } = await supabase
        .from('atendimentos')
        .update({
          tipo_atendimento: tipoAtendimento,
          assunto,
          descricao,
          resultado,
          status: statusNormalizado,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();

      if (error) throw error;

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
