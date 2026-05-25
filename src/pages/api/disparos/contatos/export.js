import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { buscarContatosMandatoPro } from '@/lib/disparos/mandatopro-contatos';

export const runtime = 'nodejs';

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n\r;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(contatos = []) {
  const header = ['nome', 'telefone', 'email', 'origem', 'origem_id', 'cidade', 'bairro'];
  const rows = contatos.map((contato) => [
    contato.name,
    contato.phone,
    contato.email,
    contato.source,
    contato.sourceId,
    contato.city,
    contato.neighborhood
  ]);

  return [header, ...rows]
    .map((row) => row.map(csvEscape).join(';'))
    .join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  }

  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const { disparoPro, resumo } = await buscarContatosMandatoPro(supabase, {
      origem: req.query.origem || 'eleitores',
      limit: req.query.limit || 1000,
      cidade: req.query.cidade,
      bairro: req.query.bairro,
      status: req.query.status,
      search: req.query.search,
      campanhaId: req.query.campanhaId
    });

    if (String(req.query.format || '').toLowerCase() === 'csv') {
      const csv = toCsv(disparoPro);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="mandatopro-contatos-disparo.csv"');
      return res.status(200).send(csv);
    }

    return res.status(200).json({
      success: true,
      data: disparoPro,
      resumo,
      contract: {
        name: 'Nome do contato',
        phone: 'Telefone em formato internacional sem simbolos',
        email: 'E-mail quando existir',
        source: 'Modulo de origem no MandatoPro',
        sourceId: 'ID original no MandatoPro',
        city: 'Cidade/municipio',
        neighborhood: 'Bairro'
      }
    });
  } catch (error) {
    console.error('Erro ao exportar contatos para Disparo PRO:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || 'Erro ao exportar contatos'
    });
  }
}
