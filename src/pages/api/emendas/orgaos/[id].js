import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

function normalizarPayload(body = {}) {
  return {
    codigo: body.codigo ? Number.parseInt(String(body.codigo), 10) : null,
    nome: body.nome,
    tipo: body.tipo,
    cnpj: body.cnpj,
    endereco: body.endereco || null,
    municipio: body.municipio,
    uf: body.uf,
    telefone: body.telefone || null,
    email: body.email || null,
    responsavel: body.responsavel || null,
    contato: body.contato || null,
    observacoes: body.observacoes || null,
    status: body.status || 'ATIVO',
    sigla: body.sigla || null,
    updated_at: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  const { id } = req.query;
  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    if (!id) {
      return res.status(400).json({ message: 'ID obrigatorio' });
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('orgaos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return res.status(200).json({ data });
    }

    if (req.method === 'PUT') {
      const payload = normalizarPayload(req.body || {});

      if (!payload.nome || !payload.cnpj || !payload.municipio) {
        return res.status(400).json({ message: 'Nome, CNPJ e municipio sao obrigatorios' });
      }

      const { data, error } = await supabase
        .from('orgaos')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ data });
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('orgaos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ message: 'Metodo nao permitido' });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Erro interno' });
  }
}
