import { createServerClient } from '@/lib/supabase-server';

const somenteDigitos = (valor = '') => String(valor).replace(/\D/g, '');
const mascararCpf = (valor = '') => {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11) return '';
  return `${cpf.slice(0, 3)}.***.***-${cpf.slice(-2)}`;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const protocolo = String(req.query?.protocolo || '').trim();
    const cpf = somenteDigitos(req.query?.cpf || '');
    const atendimentoIdQuery = String(req.query?.aid || '').trim();
    const eleitorIdQuery = String(req.query?.eid || '').trim();
    const possuiIdentificacaoQr = Boolean(protocolo && atendimentoIdQuery && eleitorIdQuery);

    if (!protocolo) {
      return res.status(400).json({ error: 'Informe o protocolo.' });
    }

    if (!possuiIdentificacaoQr && !cpf) {
      return res.status(400).json({ error: 'Informe protocolo e CPF.' });
    }

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
        eleitores!atendimentos_eleitor_id_fkey (
          id,
          nome,
          cpf
        )
      `)
      .eq('protocolo', protocolo)
      .limit(1);

    if (error) throw error;

    const atendimento = Array.isArray(data) ? data[0] : null;
    if (!atendimento) {
      return res.status(404).json({ error: 'Atendimento nao encontrado.' });
    }

    if (possuiIdentificacaoQr && String(atendimento.id) !== atendimentoIdQuery) {
      return res.status(404).json({ error: 'Atendimento nao encontrado.' });
    }

    const eleitorIdAtendimento = atendimento?.eleitores?.id ? String(atendimento.eleitores.id) : '';
    if (possuiIdentificacaoQr && eleitorIdAtendimento !== eleitorIdQuery) {
      return res.status(404).json({ error: 'Atendimento nao encontrado.' });
    }

    if (!possuiIdentificacaoQr) {
      const cpfAtendimento = somenteDigitos(atendimento?.eleitores?.cpf || '');
      if (!cpfAtendimento || cpfAtendimento !== cpf) {
        return res.status(404).json({ error: 'Atendimento nao encontrado.' });
      }
    }

    const { data: historico, error: historicoError } = await supabase
      .from('atendimentos_historico')
      .select('id, status, observacao, usuario_nome, created_at')
      .eq('atendimento_id', atendimento.id)
      .order('created_at', { ascending: true });

    if (historicoError) throw historicoError;

    return res.status(200).json({
      id: atendimento.id,
      protocolo: atendimento.protocolo,
      data_atendimento: atendimento.data_atendimento,
      data_conclusao: atendimento.data_conclusao,
      tipo_atendimento: atendimento.tipo_atendimento,
      assunto: atendimento.assunto,
      descricao: atendimento.descricao,
      resultado: atendimento.resultado,
      status: atendimento.status,
      eleitor: {
        id: atendimento?.eleitores?.id || null,
        nome: atendimento?.eleitores?.nome || '-',
        cpf: mascararCpf(atendimento?.eleitores?.cpf || '') || '-'
      },
      historico: Array.isArray(historico) ? historico : []
    });
  } catch (error) {
    console.error('Erro ao consultar historico publico de atendimento:', error);
    return res.status(500).json({ error: 'Erro interno ao consultar historico.' });
  }
}
