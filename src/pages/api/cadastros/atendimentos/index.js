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
  // GET - Buscar todos os atendimentos
  if (req.method === 'GET') {
    try {
      const { search, status, dataInicio, dataFim } = req.query;

      let query = supabase
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
        `);

      // Filtro por status
      if (status && status !== 'TODOS') {
        query = query.eq('status', normalizeStatus(status));
      }

      // Filtro por data inicial
      if (dataInicio) {
        query = query.gte('data_atendimento', `${dataInicio}T00:00:00`);
      }

      // Filtro por data final
      if (dataFim) {
        query = query.lte('data_atendimento', `${dataFim}T23:59:59`);
      }

      // Filtro por busca (nome do eleitor, CPF ou tipo de atendimento)
      let { data, error } = await query.order('data_atendimento', { ascending: false });

      if (error) throw error;

      // Aplicar filtro de busca no resultado (case-insensitive)
      if (search) {
        const searchLower = search.toLowerCase();
        data = data.filter(at => 
          (at.eleitores?.nome?.toLowerCase() || '').includes(searchLower) ||
          (at.eleitores?.cpf || '').includes(search) ||
          (at.tipo_atendimento?.toLowerCase() || '').includes(searchLower) ||
          (at.protocolo?.toLowerCase() || '').includes(searchLower)
        );
      }

      return res.status(200).json(data || []);
    } catch (error) {
      console.error('Erro ao buscar atendimentos:', error);
      return res.status(400).json({ error: error.message });
    }
  }

  // POST - Criar novo atendimento
  if (req.method === 'POST') {
    try {
      const { eleitorId, tipoAtendimento, assunto, descricao, resultado, status, dataAtendimento } = req.body;

      const statusNormalizado = normalizeStatus(status);

      // Gerar protocolo
      const protocolo = `ATD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const { data, error } = await supabase
        .from('atendimentos')
        .insert([
          {
            protocolo,
            eleitor_id: eleitorId,
            tipo_atendimento: tipoAtendimento,
            assunto,
            descricao,
            resultado,
            status: statusNormalizado,
            data_atendimento: dataAtendimento ? new Date(dataAtendimento).toISOString() : new Date().toISOString()
          }
        ])
        .select();

      if (error) throw error;

      return res.status(201).json(data[0]);
    } catch (error) {
      console.error('Erro ao criar atendimento:', error);
      return res.status(400).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
