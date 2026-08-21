import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterContextoMandato } from '@/lib/mandato-auth';

export default async function handler(req, res) {
  const { q, excludeLiderancas } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const termo = String(q || '').trim();
  if (!termo || termo.length < 2) {
    return res.status(200).json([]);
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);
    const contextoMandato = await obterContextoMandato(req, usuario, supabase);

    const sanitizado = termo.replace(/[,()"']/g, '');
    const qDigitos = sanitizado.replace(/\D/g, '');

    const filtros = [
      `nome.ilike.%${sanitizado}%`,
      `cpf.ilike.%${sanitizado}%`
    ];

    if (qDigitos.length >= 3 && qDigitos !== sanitizado) {
      filtros.push(`cpf.ilike.%${qDigitos}%`);
    }

    let query = supabase
      .from('eleitores')
      .select('id, nome, cpf, email, telefone, celular, rg, dataNascimento, sexo, nomePai, nomeMae, naturalidade, estadoCivil, profissao, endereco, logradouro, estado, uf, municipio, cidade, bairro')
      .in('pertencimento', contextoMandato.pertencimentosPermitidos)
      .or(filtros.join(','))
      .limit(15);

    if (String(excludeLiderancas).toLowerCase() === 'true') {
      query = query.is('lideranca_id', null);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.status(200).json(data || []);
  } catch (error) {
    console.error('Erro ao buscar eleitores:', error);
    return res.status(400).json({ error: error.message });
  }
}
