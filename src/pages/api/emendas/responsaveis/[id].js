import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizarPayload(body = {}) {
  return {
    nome: body.nome,
    cargo: body.cargo,
    orgao: body.orgao,
    cpf: onlyDigits(body.cpf) || null,
    telefone: onlyDigits(body.telefone) || null,
    email: body.email || null,
    whatsapp: onlyDigits(body.whatsapp) || null,
    observacoes: body.observacoes || null,
    status: body.status || 'ATIVO',
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
        .from('responsaveis_emendas')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return res.status(200).json({ data });
    }

    if (req.method === 'PUT') {
      const payload = normalizarPayload(req.body || {});

      if (!payload.nome || !payload.cargo || !payload.orgao) {
        return res.status(400).json({ message: 'Nome, cargo e orgao sao obrigatorios' });
      }

      const { data, error } = await supabase
        .from('responsaveis_emendas')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ data });
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('responsaveis_emendas')
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
